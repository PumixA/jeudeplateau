import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zEndTurn } from '@/lib/z';
import { logEvent } from '@/lib/events';
import { runTrigger } from '@/lib/engine/triggers';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const { playerId } = zEndTurn.parse(await req.json());

        const res = await prisma.$transaction(async (tx) => {
            const turn = await tx.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            // Règle: lancer obligatoire avant fin de tour
            const rolled = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, actorId: playerId, type: 'ROLL_AND_MOVE' },
            });
            if (rolled === 0) throw new Error('MUST_ROLL_BEFORE_END_TURN');

            await runTrigger(gameId, 'turn.end', { turnId: turn.id, playerId });

            // Liste ordonnée des joueurs + liste des actifs
            const playersAll = await tx.player.findMany({ where: { gameId }, orderBy: { id: 'asc' } });
            const actives = playersAll.filter(p => p.isActive);

            // Trouver le "suivant actif" en gardant l'ordre fixe (par id)
            let next = null as (typeof playersAll)[number] | null;

            if (actives.length > 0) {
                // Si le joueur courant est encore actif, on cherche le premier actif avec id > current; sinon on prend le premier actif
                // (si le courant est devenu inactif au lancer, on prendra juste le premier actif)
                for (const p of actives) {
                    if (p.id > playerId) { next = p; break; }
                }
                if (!next) next = actives[0];
            }

            // Clore le tour courant
            await tx.turn.update({ where: { id: turn.id }, data: { endedAt: new Date() } });

            if (!next) {
                // Plus aucun joueur actif → partie terminée
                await tx.game.update({ where: { id: gameId }, data: { status: 'finished' } });
                const ev = await logEvent(tx, gameId, 'GAME_FINISHED', { reason: 'NO_ACTIVE_PLAYERS' }, turn.id, playerId);
                return { gameFinished: true, cursor: ev.id };
            }

            // Nouveau tour pour le prochain joueur actif
            const nextTurn = await tx.turn.create({
                data: { gameId, index: turn.index + 1, currentPlayerId: next.id },
            });

            const ev = await logEvent(
                tx,
                gameId,
                'END_TURN',
                { from: playerId, to: next.id, turnIndex: nextTurn.index },
                nextTurn.id,
                playerId
            );

            await runTrigger(gameId, 'turn.start', { turnId: nextTurn.id, playerId: next.id });

            return { nextPlayerId: next.id, turnIndex: nextTurn.index, cursor: ev.id };
        });

        return NextResponse.json({ ok: true, ...res });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
