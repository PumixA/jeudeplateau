import { prisma } from '@/lib/prisma';

export async function getCoreContext(gameId: string, playerId?: string) {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new Error('GAME_NOT_FOUND');

    const turn = await prisma.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });

    let player = null, pawn = null;
    if (playerId) {
        player = await prisma.player.findUnique({ where: { id: playerId } });
        if (player?.mainPawnId) {
            pawn = await prisma.pawn.findUnique({ where: { id: player.mainPawnId } });
        }
    }

    return { game, turn, player, pawn };
}
