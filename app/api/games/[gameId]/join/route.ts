import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zJoinGame } from '@/lib/z';
import { logEvent } from '@/lib/events';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const { nickname, color } = zJoinGame.parse(await req.json());

        const res = await prisma.$transaction(async (tx) => {
            const g = await tx.game.findUnique({ where: { id: gameId } });
            if (!g) throw new Error('GAME_NOT_FOUND');

            const p = await tx.player.create({ data: { gameId, nickname, color: color ?? '#cccccc' } });
            const core = await tx.pawn.create({ data: { gameId, ownerPlayerId: p.id, kind: 'core', x: 0, y: 0 } });
            await tx.player.update({ where: { id: p.id }, data: { mainPawnId: core.id } });
            await tx.die.create({ data: { gameId, ownerPlayerId: p.id, label: 'D6', faces: [1,2,3,4,5,6] } });

            await logEvent(tx, gameId, 'PLAYER_JOINED', { nickname }, undefined, p.id);
            return { playerId: p.id };
        });

        return NextResponse.json({ ok: true, ...res });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
