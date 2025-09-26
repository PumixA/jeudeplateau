import { prisma } from '@/lib/prisma';
import { getApplicableRules } from './rules';
import { applyEffects } from './effects';

/**
 * Applique les règles "on.enterTile" pour le pion principal du joueur,
 * puis "turn.afterMove" (si tu veux étendre).
 * Utilise la même transaction `tx` que l'appelant.
 */
export async function applyTileEffectsAfterMove(
    tx: any,
    gameId: string,
    turnId: string,
    playerId: string
): Promise<{ finalPos?: { x: number; y: number } }> {
    // position actuelle du pion principal
    const player = await tx.player.findUnique({ where: { id: playerId }, select: { mainPawnId: true } });
    if (!player?.mainPawnId) return {};
    const pawn = await tx.pawn.findUnique({ where: { id: player.mainPawnId } });
    if (!pawn) return {};

    // tuile sous le pion
    const tile = await tx.tile.findFirst({ where: { gameId, x: pawn.x ?? 0, y: pawn.y ?? 0 }, select: { id: true } });
    const tileId = tile?.id;

    // 1) Règles déclenchées à l'entrée de la case
    const rulesEnter = await getApplicableRules(gameId, 'on.enterTile', playerId, tileId ?? undefined);
    const effectsEnter = rulesEnter.flatMap(r => (Array.isArray(r.effects) ? r.effects : [r.effects])) as any[];

    let result = await applyEffects(tx, gameId, turnId, playerId, effectsEnter as any);

    // (Optionnel) 2) Règles "après déplacement"
    const rulesAfter = await getApplicableRules(gameId, 'turn.afterMove', playerId, tileId ?? undefined);
    const effectsAfter = rulesAfter.flatMap(r => (Array.isArray(r.effects) ? r.effects : [r.effects])) as any[];
    const res2 = await applyEffects(tx, gameId, turnId, playerId, effectsAfter as any);

    return res2.finalPos ?? result.finalPos ? { finalPos: res2.finalPos ?? result.finalPos } : {};
}
