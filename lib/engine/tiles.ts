import { prisma } from '@/lib/prisma';
import { getApplicableRules } from './rules';
import { applyEffects } from './effects';
import { logEvent } from '@/lib/events';

/**
 * Applique, dans l'ordre :
 *  1) Règles DSL "on.enterTile"
 *  2) Effets de case natifs (TileEffect) sur la tuile d'arrivée (ordre croissant)
 *  3) Règles DSL "turn.afterMove"
 *
 * Tout s'exécute dans la même transaction `tx` que l'appelant.
 */
export async function applyTileEffectsAfterMove(
    tx: any,
    gameId: string,
    turnId: string,
    playerId: string
): Promise<{ finalPos?: { x: number; y: number } }> {
    // Récup pion principal
    const player = await tx.player.findUnique({
        where: { id: playerId },
        select: { mainPawnId: true },
    });
    if (!player?.mainPawnId) return {};
    const pawn = await tx.pawn.findUnique({ where: { id: player.mainPawnId } });
    if (!pawn) return {};

    // Tuile sous le pion
    const currentTile = await tx.tile.findFirst({
        where: { gameId, x: pawn.x ?? 0, y: pawn.y ?? 0 },
        select: { id: true },
    });
    const tileId = currentTile?.id;

    // 1) Règles DSL à l'entrée de la case
    const rulesEnter = await getApplicableRules(gameId, 'on.enterTile', playerId, tileId ?? undefined);
    const effectsEnter = rulesEnter.flatMap((r: any) => (Array.isArray(r.effects) ? r.effects : [r.effects])) as any[];
    let res1 = await applyEffects(tx, gameId, turnId, playerId, effectsEnter as any);

    // 2) Effets natifs de la case (TileEffect)
    await applyNativeTileEffects(tx, gameId, turnId, playerId);

    // 3) Règles DSL "après déplacement"
    const rulesAfter = await getApplicableRules(gameId, 'turn.afterMove', playerId, tileId ?? undefined);
    const effectsAfter = rulesAfter.flatMap((r: any) => (Array.isArray(r.effects) ? r.effects : [r.effects])) as any[];
    const res2 = await applyEffects(tx, gameId, turnId, playerId, effectsAfter as any);

    // Position finale si le pion a bougé suite aux effets
    const pFinal = await tx.pawn.findUnique({ where: { id: player.mainPawnId } });
    if (pFinal) {
        return { finalPos: { x: pFinal.x ?? 0, y: pFinal.y ?? 0 } };
    }
    return {};
}

/**
 * Applique les effets "natifs" définis dans la table TileEffect pour la tuile
 * où se trouve actuellement le pion principal du joueur.
 * L'ordre d'application est `order ASC`.
 */
async function applyNativeTileEffects(
    tx: any,
    gameId: string,
    turnId: string,
    playerId: string
) {
    // Pion & tuile actuelle
    const player = await tx.player.findUnique({
        where: { id: playerId },
        select: { mainPawnId: true, skipNextTurn: true },
    });
    if (!player?.mainPawnId) return;

    const pawn = await tx.pawn.findUnique({ where: { id: player.mainPawnId } });
    if (!pawn) return;

    const tile = await tx.tile.findFirst({
        where: { gameId, x: pawn.x ?? 0, y: pawn.y ?? 0 },
    });
    if (!tile) return;

    // Effets de la tuile
    const effects = await tx.tileEffect.findMany({
        where: { gameId, tileId: tile.id },
        orderBy: { order: 'asc' },
    });
    if (effects.length === 0) return;

    for (const eff of effects) {
        const kind = String(eff.kind);
        const params = eff.params ?? {};

        switch (kind) {
            case 'move': {
                const amount = Number(params?.amount ?? 0);
                if (!Number.isFinite(amount) || amount === 0) {
                    await logEvent(tx, gameId, 'EFFECT_MOVE', { playerId, tileId: tile.id, amount: 0, skipped: true }, turnId, playerId);
                    break;
                }
                await movePawnBySteps(tx, gameId, player.mainPawnId, amount);
                await logEvent(tx, gameId, 'EFFECT_MOVE', { playerId, tileId: tile.id, amount }, turnId, playerId);
                break;
            }

            case 'skipTurn': {
                await tx.player.update({
                    where: { id: playerId },
                    data: { skipNextTurn: true },
                });
                await logEvent(tx, gameId, 'EFFECT_SKIP', { playerId, tileId: tile.id }, turnId, playerId);
                break;
            }

            case 'giveItem': {
                const item = String(params?.item ?? 'token');
                // V1 : inventaire minimal via log
                await logEvent(tx, gameId, 'EFFECT_GIVE_ITEM', { playerId, tileId: tile.id, item }, turnId, playerId);
                break;
            }

            case 'takeItem': {
                const item = String(params?.item ?? 'token');
                await logEvent(tx, gameId, 'EFFECT_TAKE_ITEM', { playerId, tileId: tile.id, item }, turnId, playerId);
                break;
            }

            case 'win': {
                // marque le joueur comme "terminé"
                const p = await tx.player.findUnique({ where: { id: playerId } });
                if (p?.isActive) {
                    await tx.player.update({ where: { id: playerId }, data: { isActive: false } });
                    await logEvent(tx, gameId, 'PLAYER_FINISHED', { playerId, by: 'tileEffect', tileId: tile.id }, turnId, playerId);
                }
                break;
            }

            default: {
                // inconnu → log debug
                await logEvent(tx, gameId, 'EFFECT_UNKNOWN', { playerId, tileId: tile.id, kind, params }, turnId, playerId);
            }
        }
    }
}

/**
 * Déplace le pion principal d'un certain nombre de pas.
 * Pas positifs → on suit les arcs sortants (from → to)
 * Pas négatifs → on suit "en sens inverse" (to → from)
 * Stratégie V1 : on prend simplement la **première** connexion disponible à chaque pas.
 */
async function movePawnBySteps(
    tx: any,
    gameId: string,
    pawnId: string,
    amount: number
) {
    const step = Math.sign(amount);
    let remaining = Math.abs(amount);
    if (remaining === 0 || step === 0) return;

    let pawn = await tx.pawn.findUnique({ where: { id: pawnId } });
    if (!pawn) return;

    let current = await tx.tile.findFirst({
        where: { gameId, x: pawn.x ?? 0, y: pawn.y ?? 0 },
    });
    if (!current) return;

    while (remaining > 0 && current) {
        if (step > 0) {
            // avancer : arcs sortants
            const outs = await tx.connection.findMany({ where: { gameId, fromTileId: current.id } });
            if (outs.length === 0) break;
            const nextTileId = outs[0].toTileId;
            const to = await tx.tile.findUnique({ where: { id: nextTileId } });
            if (!to) break;
            await tx.pawn.update({ where: { id: pawnId }, data: { x: to.x, y: to.y } });
            current = to;
        } else {
            // reculer : arcs "entrants" (on les parcourt à rebours)
            const ins = await tx.connection.findMany({ where: { gameId, toTileId: current.id } });
            if (ins.length === 0) break;
            const prevTileId = ins[0].fromTileId;
            const to = await tx.tile.findUnique({ where: { id: prevTileId } });
            if (!to) break;
            await tx.pawn.update({ where: { id: pawnId }, data: { x: to.x, y: to.y } });
            current = to;
        }
        remaining -= 1;
    }
}
