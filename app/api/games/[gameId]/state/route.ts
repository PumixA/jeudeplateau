import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;

        const [game, turn, players, pawns, tiles, connections, lastEvent] = await Promise.all([
            prisma.game.findUnique({ where: { id: gameId } }),
            prisma.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } }),
            prisma.player.findMany({
                where: { gameId },
                select: { id: true, nickname: true, color: true, mainPawnId: true, isActive: true },
                orderBy: { id: 'asc' },
            }),
            prisma.pawn.findMany({ where: { gameId }, select: { id: true, ownerPlayerId: true, kind: true, x: true, y: true } }),
            prisma.tile.findMany({ where: { gameId }, select: { id: true, x: true, y: true, preset: true, tags: true } }),
            prisma.connection.findMany({ where: { gameId }, select: { id: true, fromTileId: true, toTileId: true, bidir: true } }),
            prisma.eventLog.findFirst({ where: { gameId }, orderBy: { id: 'desc' }, select: { id: true } }),
        ]);

        if (!game || !turn) throw new Error('GAME_OR_TURN_NOT_FOUND');

        const rolledThisTurn = await prisma.eventLog.count({
            where: { gameId, turnId: turn.id, actorId: turn.currentPlayerId, type: 'ROLL_AND_MOVE' },
        }).then(c => c > 0);

        const lastRollEv = await prisma.eventLog.findFirst({
            where: { gameId, turnId: turn.id, actorId: turn.currentPlayerId, type: 'ROLL_AND_MOVE' },
            orderBy: { id: 'desc' },
            select: { payload: true },
        });
        const lastRoll = typeof (lastRollEv?.payload as any)?.rolled === 'number'
            ? (lastRollEv!.payload as any).rolled as number
            : null;

        // 👉 a-t-on déjà consommé la “modif de règle/case” de ce tour ?
        const ruleOrTileChangedThisTurn = await prisma.eventLog.count({
            where: {
                gameId,
                turnId: turn.id,
                type: { in: ['RULE_ADDED','RULE_MODIFIED','RULE_REMOVED','TILE_EDIT'] },
            }
        }).then(c => c > 0);

        return NextResponse.json({
            ok: true,
            game: { id: game.id, name: game.name, status: game.status, seed: game.seed, createdAt: game.createdAt },
            turn: {
                id: turn.id,
                index: turn.index,
                currentPlayerId: turn.currentPlayerId,
                rolledThisTurn,
                lastRoll,
                ruleChangedThisTurn: ruleOrTileChangedThisTurn,
            },
            players, pawns, tiles, connections,
            cursor: lastEvent?.id ?? null,
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
