import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zCreateGame } from '@/lib/z';
import { logEvent } from '@/lib/events';

// Génère une seed hex compatible Edge (Web Crypto)
function randomHex(bytes = 8) {
    const arr = new Uint8Array(bytes);
    // @ts-ignore
    (globalThis.crypto || window.crypto).getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/games  → liste des parties
export async function GET() {
    try {
        const games = await prisma.game.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
                _count: { select: { players: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            ok: true,
            games: games.map(g => ({
                id: g.id,
                name: g.name,
                status: g.status,
                createdAt: g.createdAt,
                playersCount: g._count.players,
            })),
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}

// POST /api/games  → création d’une partie
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, players } = zCreateGame.parse(body);
        const seed = randomHex(8);

        const game = await prisma.$transaction(async (tx) => {
            const g = await tx.game.create({ data: { name, status: 'waiting', seed } });

            // 20 cases en ligne
            const tilesData = Array.from({ length: 20 }, (_, x) => ({
                gameId: g.id,
                x, y: 0,
                preset: x === 0 ? 'start' : x === 19 ? 'goal' : 'neutral',
                tags: x === 19 ? ['arrival'] : [],
            }));
            await tx.tile.createMany({ data: tilesData });

            // Relire pour id
            const allTiles = await tx.tile.findMany({
                where: { gameId: g.id },
                orderBy: [{ x: 'asc' }, { y: 'asc' }],
                select: { id: true, x: true, y: true },
            });

            // Connexions bidirectionnelles
            for (let i = 0; i < allTiles.length - 1; i++) {
                await tx.connection.create({
                    data: { gameId: g.id, fromTileId: allTiles[i].id, toTileId: allTiles[i + 1].id, bidir: true },
                });
            }

            // Joueurs + pion + dé
            const createdPlayers = [];
            for (const p of players) {
                const player = await tx.player.create({
                    data: { gameId: g.id, nickname: p.nickname, color: p.color ?? '#cccccc', isActive: true },
                });
                const pawn = await tx.pawn.create({ data: { gameId: g.id, ownerPlayerId: player.id, kind: 'core', x: 0, y: 0 } });
                await tx.player.update({ where: { id: player.id }, data: { mainPawnId: pawn.id } });
                await tx.die.create({ data: { gameId: g.id, ownerPlayerId: player.id, label: 'D6', faces: [1, 2, 3, 4, 5, 6] } });
                createdPlayers.push(player);
            }

            const turn = await tx.turn.create({
                data: { gameId: g.id, index: 1, currentPlayerId: createdPlayers[0].id },
            });

            await tx.game.update({ where: { id: g.id }, data: { status: 'running' } });
            await logEvent(tx, g.id, 'GAME_CREATED', { name, players: players.map((p) => p.nickname) }, turn.id);

            return g;
        });

        return NextResponse.json({ ok: true, gameId: game.id });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
