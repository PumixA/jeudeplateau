// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
    const seed = crypto.randomBytes(8).toString('hex');

    const game = await prisma.game.create({
        data: { name: 'Partie locale #1', status: 'waiting', seed },
    });

    // 20 cases en ligne + start/goal
    const tiles = [];
    for (let x = 0; x < 20; x++) {
        tiles.push({
            gameId: game.id,
            x,
            y: 0,
            preset: x === 0 ? 'start' : x === 19 ? 'goal' : 'neutral',
            tags: x === 19 ? ['arrival'] : [],
        });
    }
    await prisma.tile.createMany({ data: tiles });

    const allTiles = await prisma.tile.findMany({ where: { gameId: game.id }, orderBy: [{ x: 'asc' }] });

    // Connexions bidirectionnelles
    const conns = [];
    for (let i = 0; i < allTiles.length - 1; i++) {
        conns.push({
            gameId: game.id,
            fromTileId: allTiles[i].id,
            toTileId: allTiles[i + 1].id,
            bidir: true,
        });
    }
    await prisma.connection.createMany({ data: conns });

    // 2 joueurs de test + pion core + D6
    const p1 = await prisma.player.create({ data: { gameId: game.id, nickname: 'Joueur 1', color: '#ff6666' } });
    const p2 = await prisma.player.create({ data: { gameId: game.id, nickname: 'Joueur 2', color: '#66aaff' } });

    const startTile = allTiles[0];

    const core1 = await prisma.pawn.create({ data: { gameId: game.id, ownerPlayerId: p1.id, kind: 'core', x: startTile.x, y: startTile.y } });
    const core2 = await prisma.pawn.create({ data: { gameId: game.id, ownerPlayerId: p2.id, kind: 'core', x: startTile.x, y: startTile.y } });

    await prisma.player.update({ where: { id: p1.id }, data: { mainPawnId: core1.id } });
    await prisma.player.update({ where: { id: p2.id }, data: { mainPawnId: core2.id } });

    const faces = [1,2,3,4,5,6];
    await prisma.die.create({ data: { gameId: game.id, ownerPlayerId: p1.id, label: 'D6', faces } });
    await prisma.die.create({ data: { gameId: game.id, ownerPlayerId: p2.id, label: 'D6', faces } });

    console.log('Seed OK → Game:', game.id);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
