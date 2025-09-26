import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const body = await req.json();

        const { playerId, action } = body as {
            playerId: string;
            action: 'addTile' | 'removeTile' | 'connect' | 'disconnect' | 'updateTile';
            x?: number; y?: number; tileId?: string;
            fromTileId?: string; toTileId?: string; bidir?: boolean;
            preset?: string; tags?: string[];
            connectToTileId?: string;
        };

        if (!playerId || !action) throw new Error('BAD_INPUT');

        const result = await prisma.$transaction(async (tx) => {
            // vérifs tour
            const turn = await tx.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            const rolled = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, actorId: playerId, type: 'ROLL_AND_MOVE' },
            });
            if (rolled === 0) throw new Error('MUST_ROLL_BEFORE_EDIT');

            const alreadyChanged = await tx.eventLog.count({
                where: {
                    gameId, turnId: turn.id,
                    type: { in: ['RULE_ADDED','RULE_MODIFIED','RULE_REMOVED','TILE_EDIT'] },
                },
            });
            if (alreadyChanged > 0) throw new Error('ALREADY_USED_CHANGE_THIS_TURN');

            let payload: any = null;

            if (action === 'addTile') {
                const { x, y, preset = 'neutral', tags = [], connectToTileId } = body as any;
                if (typeof x !== 'number' || typeof y !== 'number') throw new Error('BAD_COORDS');

                const exists = await tx.tile.findFirst({ where: { gameId, x, y } });
                if (exists) throw new Error('TILE_ALREADY_EXISTS');

                const t = await tx.tile.create({ data: { gameId, x, y, preset, tags } });

                // Connexion auto bidirectionnelle si demandé (et si la cible existe)
                if (connectToTileId) {
                    const target = await tx.tile.findUnique({ where: { id: connectToTileId } });
                    if (!target) throw new Error('CONNECT_TARGET_NOT_FOUND');

                    // anti-doublons des 2 sens
                    const existAB = await tx.connection.findFirst({ where: { gameId, fromTileId: connectToTileId, toTileId: t.id } });
                    if (!existAB) {
                        await tx.connection.create({ data: { gameId, fromTileId: connectToTileId, toTileId: t.id, bidir: true } });
                    }
                    const existBA = await tx.connection.findFirst({ where: { gameId, fromTileId: t.id, toTileId: connectToTileId } });
                    if (!existBA) {
                        await tx.connection.create({ data: { gameId, fromTileId: t.id, toTileId: connectToTileId, bidir: true } });
                    }
                }

                payload = { action, tileId: t.id, x, y, preset, tags, connectToTileId: connectToTileId ?? null };
            }

            else if (action === 'removeTile') {
                const { tileId } = body as any;
                if (!tileId) throw new Error('BAD_TILE');
                await tx.connection.deleteMany({ where: { gameId, OR: [{ fromTileId: tileId }, { toTileId: tileId }] } });
                // table optionnelle
                // @ts-ignore
                await (tx as any).tileEffect?.deleteMany?.({ where: { gameId, tileId } }).catch(()=>undefined);
                await tx.tile.delete({ where: { id: tileId } });
                payload = { action, tileId };
            }

            else if (action === 'connect') {
                const { fromTileId, toTileId, bidir = true } = body as any;
                if (!fromTileId || !toTileId) throw new Error('BAD_CONNECTION');
                const exist = await tx.connection.findFirst({ where: { gameId, fromTileId, toTileId } });
                if (!exist) {
                    await tx.connection.create({ data: { gameId, fromTileId, toTileId, bidir } });
                }
                if (bidir) {
                    const back = await tx.connection.findFirst({ where: { gameId, fromTileId: toTileId, toTileId: fromTileId } });
                    if (!back) await tx.connection.create({ data: { gameId, fromTileId: toTileId, toTileId: fromTileId, bidir } });
                }
                payload = { action, fromTileId, toTileId, bidir };
            }

            else if (action === 'disconnect') {
                const { fromTileId, toTileId } = body as any;
                if (!fromTileId || !toTileId) throw new Error('BAD_CONNECTION');
                await tx.connection.deleteMany({ where: { gameId, fromTileId, toTileId } });
                await tx.connection.deleteMany({ where: { gameId, fromTileId: toTileId, toTileId: fromTileId } });
                payload = { action, fromTileId, toTileId };
            }

            else if (action === 'updateTile') {
                const { tileId, preset, tags } = body as any;
                if (!tileId) throw new Error('BAD_TILE');
                const data: any = {};
                if (preset) data.preset = preset;
                if (tags) data.tags = tags;
                await tx.tile.update({ where: { id: tileId }, data });
                payload = { action, tileId, preset, tags };
            }

            const ev = await tx.eventLog.create({
                data: { gameId, turnId: turn.id, actorId: playerId, type: 'TILE_EDIT', payload },
            });

            return { ok: true, payload, cursor: ev.id };
        });

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
