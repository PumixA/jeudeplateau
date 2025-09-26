import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;

        const [game, turn, players, pawns, tiles, connections, lastEvent, pending] = await Promise.all([
            prisma.game.findUnique({ where: { id: gameId } }),

            prisma.turn.findFirst({
                where: { gameId },
                orderBy: { index: 'desc' }, // OK: Turn a bien 'index'
            }),

            prisma.player.findMany({
                where: { gameId },
                orderBy: { id: 'asc' }, // ⚠️ Player n'a pas createdAt → on trie par id
            }),

            prisma.pawn.findMany({ where: { gameId } }),
            prisma.tile.findMany({ where: { gameId } }),
            prisma.connection.findMany({ where: { gameId } }),

            prisma.eventLog.findFirst({
                where: { gameId },
                orderBy: { ts: 'desc' }, // ⚠️ EventLog → utiliser 'ts' (pas createdAt)
            }),

            prisma.eventLog.findFirst({
                where: { gameId, type: 'MOVE_PENDING' },
                orderBy: { ts: 'desc' }, // ⚠️ idem
            }),
        ]);

        const rolledThisTurn = !!(turn && await prisma.eventLog.count({
            where: { gameId, turnId: turn.id, type: 'ROLL_AND_MOVE' },
        }));

        const lastRollEvent = turn ? await prisma.eventLog.findFirst({
            where: { gameId, turnId: turn.id, type: 'ROLL_AND_MOVE' },
            orderBy: { ts: 'desc' }, // ⚠️ ts
        }) : null;

        const ruleChangedThisTurn = !!(turn && await prisma.eventLog.count({
            where: {
                gameId, turnId: turn.id,
                type: { in: ['RULE_ADDED','RULE_MODIFIED','RULE_REMOVED','TILE_EDIT'] }
            }
        }));

        const pendingMove = pending ? (pending.payload as any) : null;

        return NextResponse.json({
            ok: true,
            game,
            turn: turn ? {
                id: turn.id,
                index: turn.index,
                currentPlayerId: turn.currentPlayerId,
                rolledThisTurn,
                lastRoll: lastRollEvent ? (lastRollEvent.payload as any)?.rolled ?? null : null,
                ruleChangedThisTurn,
                pendingMove, // { pawnId, currentTileId, stepsLeft } | null
            } : null,
            players, pawns, tiles, connections,
            cursor: lastEvent?.id ?? null,
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
