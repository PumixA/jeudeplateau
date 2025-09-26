import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

// (Optionnel) GET pour debug rapide d'une partie
export async function GET(_: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const game = await prisma.game.findUnique({ where: { id: gameId } });
        if (!game) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
        return NextResponse.json({ ok: true, game });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}

export async function DELETE(_: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;

        await prisma.$transaction(async (tx) => {
            // Purge des logs d'événements en premier (souvent le plus volumineux)
            await tx.eventLog.deleteMany({ where: { gameId } });

            // Purge des objets dépendants (si certains modèles n'existent pas, on ignore silencieusement)
            // Règles
            await tx.rule.deleteMany({ where: { gameId } }).catch(() => {});
            // Dés éventuels
            await tx.die.deleteMany({ where: { gameId } }).catch(() => {});
            // Effets de cases (si tu as un modèle TileEffect)
            // NB: ton routeur de tiles y fait référence, donc on le tente ici aussi
            // @ts-ignore - ignorer si ton client Prisma n'a pas ce modèle
            await (tx as any).tileEffect?.deleteMany?.({ where: { gameId } }).catch(() => {});
            // Inventaire / ressources (si présents dans ton schéma)
            // @ts-ignore
            await (tx as any).inventoryItem?.deleteMany?.({ where: { gameId } }).catch(() => {});
            // @ts-ignore
            await (tx as any).playerResource?.deleteMany?.({ where: { gameId } }).catch(() => {});

            // Connexions -> Pions -> Tours -> Joueurs -> Cases (ordre pour FK)
            await tx.connection.deleteMany({ where: { gameId } });
            await tx.pawn.deleteMany({ where: { gameId } });
            await tx.turn.deleteMany({ where: { gameId } });
            await tx.player.deleteMany({ where: { gameId } });
            await tx.tile.deleteMany({ where: { gameId } });

            // Enfin, la partie
            await tx.game.delete({ where: { id: gameId } });
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
