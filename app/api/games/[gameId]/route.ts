import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

// DELETE /api/games/:gameId → supprime totalement la partie (et ses dépendances)
export async function DELETE(_: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params; // ✅ pas de React.use ici

        await prisma.$transaction(async (tx) => {
            // Journaux & règles
            await tx.eventLog.deleteMany({ where: { gameId } });
            await tx.rule.deleteMany({ where: { gameId } });

            // Ressources & inventaire
            await tx.playerResource.deleteMany({ where: { gameId } });
            await tx.resourceDef.deleteMany({ where: { gameId } });
            await tx.inventoryItem.deleteMany({ where: { gameId } });

            // Connexions / effets / tuiles
            await tx.connection.deleteMany({ where: { gameId } });
            await tx.tileEffect.deleteMany({ where: { gameId } });
            await tx.tile.deleteMany({ where: { gameId } });

            // Pions / dés / joueurs
            await tx.pawn.deleteMany({ where: { gameId } });
            await tx.die.deleteMany({ where: { gameId } });
            await tx.player.deleteMany({ where: { gameId } });

            // Tours
            await tx.turn.deleteMany({ where: { gameId } });

            // Enfin, la partie
            await tx.game.delete({ where: { id: gameId } });
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
