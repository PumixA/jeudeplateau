import { prisma } from './prisma';

export async function ensureGameRunning(gameId: string) {
    const g = await prisma.game.findUnique({ where: { id: gameId } });
    if (!g) throw new Error('GAME_NOT_FOUND');
    if (g.status !== 'running' && g.status !== 'waiting') throw new Error('GAME_NOT_RUNNING');
    return g;
}

export async function ensurePlayerInGame(gameId: string, playerId: string) {
    const p = await prisma.player.findFirst({ where: { id: playerId, gameId } });
    if (!p) throw new Error('PLAYER_NOT_IN_GAME');
    return p;
}

export async function getCurrentTurn(gameId: string) {
    return prisma.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
}

export function assertOneRuleChangePerTurn(ruleChangesCountThisTurn: number) {
    if (ruleChangesCountThisTurn >= 1) throw new Error('RULE_CHANGE_QUOTA_EXCEEDED');
}
