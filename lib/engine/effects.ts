import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/events';

type Tx = Parameters<typeof prisma.$transaction>[0] extends (fn: infer R) => any ? never : any; // juste pour typer vaguement `tx`

async function getMainPawn(tx: any, playerId: string) {
    const p = await tx.player.findUnique({ where: { id: playerId }, select: { mainPawnId: true } });
    if (!p?.mainPawnId) throw new Error('CORE_PAWN_MISSING');
    const pawn = await tx.pawn.findUnique({ where: { id: p.mainPawnId } });
    if (!pawn) throw new Error('CORE_PAWN_NOT_FOUND');
    return pawn;
}

async function getTrackMaxX(tx: any, gameId: string) {
    const aggr = await tx.tile.aggregate({ where: { gameId }, _max: { x: true } });
    return aggr._max.x ?? 19;
}

export type Effect =
    | { type: 'move.delta'; steps: number }
    | { type: 'dice.set'; faces: number[]; label?: string }
    | { type: 'victory.declare'; message?: string };

/**
 * Applique une liste d'effets "DSL" et journalise des événements robustes.
 * Retourne la position finale du pion principal du joueur (si déplacé).
 */
export async function applyEffects(
    tx: any,
    gameId: string,
    turnId: string,
    playerId: string,
    effects: Effect[]
): Promise<{ finalPos?: { x: number; y: number } }> {
    if (!effects || effects.length === 0) return {};

    let pawn = await getMainPawn(tx, playerId);
    let posChanged = false;

    for (const eff of effects) {
        if (!eff || typeof eff !== 'object') continue;

        if (eff.type === 'move.delta') {
            const maxX = await getTrackMaxX(tx, gameId);
            const from = { x: pawn.x ?? 0, y: pawn.y ?? 0 };
            const to = { x: Math.max(0, Math.min(from.x + (eff.steps ?? 0), maxX)), y: from.y };
            if (to.x !== from.x || to.y !== from.y) {
                await tx.pawn.update({ where: { id: pawn.id }, data: { x: to.x, y: to.y } });
                pawn = { ...pawn, ...to };
                posChanged = true;
            }
            await logEvent(tx, gameId, 'EFFECT_MOVE_DELTA', { playerId, pawnId: pawn.id, steps: eff.steps ?? 0, from, to }, turnId, playerId);
        }

        else if (eff.type === 'dice.set') {
            // on prend le dé du joueur (le premier)
            const die = await tx.die.findFirst({ where: { gameId, ownerPlayerId: playerId } });
            if (die) {
                await tx.die.update({ where: { id: die.id }, data: { faces: eff.faces ?? die.faces, label: eff.label ?? die.label } });
                await logEvent(tx, gameId, 'EFFECT_DICE_SET', { playerId, dieId: die.id, faces: eff.faces, label: eff.label }, turnId, playerId);
            }
        }

        else if (eff.type === 'victory.declare') {
            await tx.player.update({ where: { id: playerId }, data: { isActive: false } });
            await logEvent(tx, gameId, 'VICTORY_DECLARE', { playerId, message: eff.message ?? 'Victoire !' }, turnId, playerId);
        }
    }

    return posChanged ? { finalPos: { x: pawn.x ?? 0, y: pawn.y ?? 0 } } : {};
}
