import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const body = await req.json();
        const { playerId } = body as { playerId: string };

        if (!playerId) throw new Error('BAD_INPUT');

        const result = await prisma.$transaction(async (tx) => {
            const game = await tx.game.findUnique({ where: { id: gameId } });
            if (!game) throw new Error('GAME_NOT_FOUND');
            if (game.status === 'finished') throw new Error('GAME_FINISHED');

            const turn = await tx.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            // empêcher fin de tour si choix de direction en attente
            const pending = await tx.eventLog.findFirst({
                where: { gameId, type: 'MOVE_PENDING' },
                orderBy: { ts: 'desc' },
            });
            if (pending && (pending.payload as any)?.stepsLeft > 0) {
                throw new Error('MOVE_PENDING_CHOICE_REQUIRED');
            }

            // le joueur doit avoir lancé le dé
            const rolled = await tx.eventLog.count({
                where: { gameId, turnId: turn.id, actorId: playerId, type: 'ROLL_AND_MOVE' },
            });
            if (rolled === 0) throw new Error('MUST_ROLL_BEFORE_END');

            // calcul de l’ordre des joueurs "encore en jeu"
            const players = await tx.player.findMany({
                where: { gameId },
                orderBy: { id: 'asc' }, // ordre fixe V1
            });
            const alive = players.filter(p => p.isActive);

            // s’il ne reste qu’un joueur actif, on pourrait décréter la fin (optionnel V1)
            if (alive.length === 0) {
                await tx.game.update({ where: { id: gameId }, data: { status: 'finished' } });
                await tx.eventLog.create({ data: { gameId, turnId: turn.id, actorId: playerId, type: 'TURN_ENDED', payload: { finished: true } } });
                return { ok: true, finished: true };
            }

            // trouver l’index du joueur actif actuel dans la liste ordonnée
            const order = players.map(p => p.id);
            const curIdx = order.indexOf(turn.currentPlayerId);
            if (curIdx < 0) throw new Error('TURN_PLAYER_NOT_FOUND');

            // on passe au joueur suivant, en consommant les skipNextTurn tant que nécessaire
            const maxHops = players.length + 5; // sécurité anti-boucle
            let hops = 0;
            let nextIdx = (curIdx + 1) % players.length;
            let chosen: typeof players[number] | null = null;

            while (hops < maxHops) {
                const cand = players[nextIdx];

                if (cand.isActive) {
                    if (cand.skipNextTurn) {
                        // Consommer le skip et passer au suivant
                        await tx.player.update({ where: { id: cand.id }, data: { skipNextTurn: false } });
                        await tx.eventLog.create({
                            data: { gameId, turnId: turn.id, actorId: cand.id, type: 'TURN_SKIPPED', payload: { reason: 'skipNextTurn' } },
                        });
                        nextIdx = (nextIdx + 1) % players.length;
                        hops++;
                        continue;
                    } else {
                        chosen = cand;
                        break;
                    }
                } else {
                    // joueur terminé → passer
                    nextIdx = (nextIdx + 1) % players.length;
                    hops++;
                }
            }

            if (!chosen) {
                // si personne ne peut jouer → fin de partie
                await tx.game.update({ where: { id: gameId }, data: { status: 'finished' } });
                await tx.eventLog.create({ data: { gameId, turnId: turn.id, actorId: playerId, type: 'TURN_ENDED', payload: { finished: true } } });
                return { ok: true, finished: true };
            }

            // clôturer le tour courant et créer le nouveau
            await tx.eventLog.create({ data: { gameId, turnId: turn.id, actorId: playerId, type: 'TURN_ENDED', payload: {} } });

            const newTurn = await tx.turn.create({
                data: {
                    gameId,
                    index: turn.index + 1,
                    currentPlayerId: chosen.id,
                },
            });

            // nettoyer d’éventuels MOVE_PENDING obsolètes
            await tx.eventLog.deleteMany({ where: { gameId, type: 'MOVE_PENDING' } });

            return { ok: true, turnId: newTurn.id, currentPlayerId: chosen.id };
        });

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
