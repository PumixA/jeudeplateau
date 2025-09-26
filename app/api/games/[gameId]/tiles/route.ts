import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zTileMutation } from '@/lib/z';
import { logEvent } from '@/lib/events';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const { playerId, op, data } = zTileMutation.parse(await req.json());

        const res = await prisma.$transaction(async (tx) => {
            const turn = await tx.turn.findFirst({
                where: { gameId },
                orderBy: { index: 'desc' },
            });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            // Vérifie le quota (1 modif max par tour : règle OU case)
            const ruleCount = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, type: { in: ['RULE_ADDED', 'RULE_MODIFIED', 'RULE_REMOVED'] } },
            });
            const tileCount = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, type: 'TILE_EDIT' },
            });
            if (ruleCount + tileCount >= 1) throw new Error('TILE_CHANGE_QUOTA_EXCEEDED');

            let result: any;

            if (op === 'add') {
                result = await tx.tile.create({ data: { gameId, ...data } });
            } else if (op === 'update') {
                if (!data.id) throw new Error('MISSING_TILE_ID');
                result = await tx.tile.update({ where: { id: data.id }, data });
            } else if (op === 'delete') {
                if (!data.id) throw new Error('MISSING_TILE_ID');
                result = await tx.tile.delete({ where: { id: data.id } });
            } else {
                throw new Error('UNKNOWN_OP');
            }

            const ev = await logEvent(
                tx,
                gameId,
                'TILE_EDIT',
                { op, data, result },
                turn.id,
                playerId
            );

            return { ok: true, cursor: ev.id, tile: result };
        });

        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e.message ?? 'ERR' },
            { status: 400 }
        );
    }
}
