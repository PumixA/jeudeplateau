import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const since = req.nextUrl.searchParams.get('since');

        const where: any = { gameId };
        if (since) where.id = { gt: since };

        const events = await prisma.eventLog.findMany({
            where,
            orderBy: { id: 'asc' },
            take: 100,
        });

        return NextResponse.json({ ok: true, events, cursor: events.at(-1)?.id ?? since ?? null });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
