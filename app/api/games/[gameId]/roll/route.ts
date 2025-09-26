import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zRoll } from '@/lib/z';
import { logEvent } from '@/lib/events';

type Ctx = { params: Promise<{ gameId: string }> };

function hashToFloat(s: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 1_000_000) / 1_000_000;
}

async function nextTiles(tx: any, gameId: string, fromTileId: string) {
    const edges = await tx.connection.findMany({ where: { gameId, fromTileId } });
    return edges.map((e: any) => e.toTileId);
}

async function tileAt(tx: any, gameId: string, x: number, y: number) {
    return tx.tile.findFirst({ where: { gameId, x, y } });
}

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const { playerId } = zRoll.parse(await req.json());

        const res = await prisma.$transaction(async (tx) => {
            const game = await tx.game.findUnique({ where: { id: gameId } });
            if (!game) throw new Error('GAME_NOT_FOUND');

            const turn = await tx.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            const player = await tx.player.findUnique({ where: { id: playerId } });
            if (!player?.isActive) throw new Error('PLAYER_INACTIVE');

            const already = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, actorId: playerId, type: 'ROLL_AND_MOVE' },
            });
            if (already > 0) throw new Error('ALREADY_ROLLED_THIS_TURN');

            // core pawn & case courante
            if (!player.mainPawnId) throw new Error('CORE_PAWN_MISSING');
            const pawn = await tx.pawn.findUnique({ where: { id: player.mainPawnId } });
            if (!pawn) throw new Error('CORE_PAWN_NOT_FOUND');

            const fromTile = await tileAt(tx, gameId, pawn.x ?? 0, pawn.y ?? 0);
            if (!fromTile) throw new Error('NO_TILE_UNDER_PAWN');

            const die = await tx.die.findFirst({ where: { gameId, ownerPlayerId: playerId } });
            if (!die) throw new Error('NO_DIE');

            const eventsCount = await tx.eventLog.count({ where: { gameId } });
            const seedVariant = game.seed + eventsCount.toString(16);

            const faces: number[] = (die.faces as any) ?? [1,2,3,4,5,6];
            const idx = Math.floor(hashToFloat(seedVariant) * faces.length);
            const rolled = faces[idx];

            // journaliser le lancer
            await logEvent(
                tx, gameId, 'ROLL_AND_MOVE',
                { playerId, die: die.label, faces, rolled },
                turn.id, playerId
            );

            // prépare un MOVE_PENDING (ne déplace pas tout de suite)
            const choices = await nextTiles(tx, gameId, fromTile.id);
            // auto-avance si 0 ou 1 choix jusqu’à tomber sur un embranchement ou épuiser les steps
            let stepsLeft = rolled;
            let currentTileId = fromTile.id;

            while (stepsLeft > 0) {
                const outs = await nextTiles(tx, gameId, currentTileId);
                if (outs.length === 0) break;
                if (outs.length > 1) {
                    // on stoppe pour demander un choix
                    break;
                }
                // une seule sortie → avance d’1
                currentTileId = outs[0];
                stepsLeft -= 1;
                // update pawn position à chaque step auto
                const t = await tx.tile.findUnique({ where: { id: currentTileId } });
                await tx.pawn.update({ where: { id: pawn.id }, data: { x: t.x, y: t.y } });
            }

            const pendingPayload = { pawnId: pawn.id, currentTileId, stepsLeft };
            await tx.eventLog.create({
                data: {
                    gameId, turnId: turn.id, actorId: playerId,
                    type: 'MOVE_PENDING',
                    payload: pendingPayload,
                }
            });

            return { ok: true, rolled, pendingMove: pendingPayload };
        });

        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
