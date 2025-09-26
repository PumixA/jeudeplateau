import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyTileEffectsAfterMove } from '@/lib/engine/tiles';
import { logEvent } from '@/lib/events';

type Ctx = { params: Promise<{ gameId: string }> };

async function nextTiles(tx: any, gameId: string, fromTileId: string) {
    const edges = await tx.connection.findMany({ where: { gameId, fromTileId } });
    return edges.map((e: any) => e.toTileId);
}

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const { playerId, toTileId } = await req.json();

        const out = await prisma.$transaction(async (tx) => {
            const turn = await tx.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            const pending = await tx.eventLog.findFirst({
                where: { gameId, type: 'MOVE_PENDING' },
                orderBy: { ts: 'desc' }, // ⚠️ ts (pas createdAt)
            });
            if (!pending) throw new Error('NO_PENDING_MOVE');

            const payload = pending.payload as any;
            let { pawnId, currentTileId, stepsLeft } = payload;
            if (!pawnId || stepsLeft <= 0) throw new Error('INVALID_PENDING');

            // vérifier choix valide
            const outs = await nextTiles(tx, gameId, currentTileId);
            if (outs.length <= 1) throw new Error('NO_CHOICE_EXPECTED');
            if (!outs.includes(toTileId)) throw new Error('INVALID_CHOICE');

            // avancer d'1
            const t = await tx.tile.findUnique({ where: { id: toTileId } });
            if (!t) throw new Error('DEST_TILE_NOT_FOUND');
            await tx.pawn.update({ where: { id: pawnId }, data: { x: t.x, y: t.y } });
            stepsLeft -= 1;
            currentTileId = toTileId;

            // auto suite si 1 seule sortie
            while (stepsLeft > 0) {
                const outs2 = await nextTiles(tx, gameId, currentTileId);
                if (outs2.length !== 1) break;
                const t2 = await tx.tile.findUnique({ where: { id: outs2[0] } });
                await tx.pawn.update({ where: { id: pawnId }, data: { x: t2.x, y: t2.y } });
                currentTileId = outs2[0];
                stepsLeft -= 1;
            }

            // nouveau MOVE_PENDING
            await tx.eventLog.create({
                data: {
                    gameId, turnId: turn.id, actorId: playerId,
                    type: 'MOVE_PENDING',
                    payload: { pawnId, currentTileId, stepsLeft },
                }
            });

            // fin de mouvement → effets & victoire
            let finished = false;
            if (stepsLeft === 0) {
                const player = await tx.player.findUnique({ where: { id: playerId } });
                await applyTileEffectsAfterMove(tx, gameId, turn.id, playerId);

                const tileAtDest = await tx.tile.findUnique({ where: { id: currentTileId } });
                const isArrival = tileAtDest?.preset === 'goal' || (tileAtDest?.tags as any)?.includes?.('arrival');
                if (isArrival && player?.isActive) {
                    await tx.player.update({ where: { id: playerId }, data: { isActive: false } });
                    await logEvent(tx, gameId, 'PLAYER_FINISHED', { playerId, position: { x: tileAtDest!.x, y: tileAtDest!.y } }, turn.id, playerId);
                }
                finished = true;
            }

            return { ok: true, pendingMove: { pawnId, currentTileId, stepsLeft }, finished };
        });

        return NextResponse.json(out);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
