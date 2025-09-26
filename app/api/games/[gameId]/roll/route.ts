import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zRoll } from '@/lib/z';
import { logEvent } from '@/lib/events';
import { applyTileEffectsAfterMove } from '@/lib/engine/tiles';

type Ctx = { params: Promise<{ gameId: string }> };

function hashToFloat(s: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h % 1_000_000) / 1_000_000;
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

            // joueur actif ?
            const player = await tx.player.findUnique({ where: { id: playerId } });
            if (!player?.isActive) throw new Error('PLAYER_INACTIVE');

            // déjà lancé ce tour ?
            const already = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, actorId: playerId, type: 'ROLL_AND_MOVE' },
            });
            if (already > 0) throw new Error('ALREADY_ROLLED_THIS_TURN');

            const die = await tx.die.findFirst({ where: { gameId, ownerPlayerId: playerId } });
            if (!die) throw new Error('NO_DIE');

            const eventsCount = await tx.eventLog.count({ where: { gameId } });
            const seedVariant = game.seed + eventsCount.toString(16);

            const faces: number[] = (die.faces as any) ?? [1,2,3,4,5,6];
            const idx = Math.floor(hashToFloat(seedVariant) * faces.length);
            const rolled = faces[idx];

            // pion principal
            if (!player.mainPawnId) throw new Error('CORE_PAWN_MISSING');
            const core = await tx.pawn.findUnique({ where: { id: player.mainPawnId } });
            if (!core) throw new Error('CORE_PAWN_NOT_FOUND');

            // déplacement de base
            const maxX = await tx.tile.aggregate({ where: { gameId }, _max: { x: true } });
            const targetX = Math.min((core.x ?? 0) + rolled, maxX._max.x ?? 19);
            await tx.pawn.update({ where: { id: core.id }, data: { x: targetX, y: 0 } });

            // journaliser le lancer+move initial
            const ev = await logEvent(
                tx, gameId, 'ROLL_AND_MOVE',
                { playerId, die: die.label, faces, rolled, to: { x: targetX, y: 0 } },
                turn.id, playerId
            );

            // appliquer effets de tuiles/règles AVEC LA MEME TX
            await applyTileEffectsAfterMove(tx, gameId, turn.id, playerId);

            // relire position finale après effets
            const finalPawn = await tx.pawn.findUnique({ where: { id: core.id }, select: { x: true, y: true } });
            const finalTo = { x: finalPawn?.x ?? targetX, y: finalPawn?.y ?? 0 };

            // arrivée ? rendre inactif si case goal/arrival
            const tileAtDest = await tx.tile.findFirst({
                where: { gameId, x: finalTo.x, y: finalTo.y },
                select: { preset: true, tags: true },
            });
            const isArrival = !!tileAtDest && (tileAtDest.preset === 'goal' || (tileAtDest.tags as any)?.includes?.('arrival'));
            if (isArrival && player.isActive) {
                await tx.player.update({ where: { id: playerId }, data: { isActive: false } });
                await logEvent(tx, gameId, 'PLAYER_FINISHED', { playerId, position: finalTo }, turn.id, playerId);
            }

            return { rolled, to: finalTo, cursor: ev.id };
        });

        return NextResponse.json({ ok: true, ...res });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
