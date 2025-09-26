import { prisma as prismaGlobal } from './prisma';

// Le client peut être le prisma global ou un tx de transaction
type Prismaish = typeof prismaGlobal | any;

export async function logEvent(
    client: Prismaish,
    gameId: string,
    type: string,
    payload: unknown,
    turnId?: string,
    actorId?: string
) {
    const c = client ?? prismaGlobal;
    const ev = await c.eventLog.create({
        data: {
            gameId,
            type,
            payload: payload as any,
            turnId: turnId ?? null,
            actorId: actorId ?? null,
        },
    });
    return { id: ev.id, ts: ev.ts.toISOString() };
}

export async function logEventGlobal(
    gameId: string,
    type: string,
    payload: unknown,
    turnId?: string,
    actorId?: string
) {
    return logEvent(prismaGlobal, gameId, type, payload, turnId, actorId);
}
