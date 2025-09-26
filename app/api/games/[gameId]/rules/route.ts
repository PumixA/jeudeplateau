import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { zRulesMutation } from '@/lib/z';
import { logEvent } from '@/lib/events';

type Ctx = { params: Promise<{ gameId: string }> };

const EXCLUSIVE = new Set(['dice.set', 'move.set', 'victory.declare']);
function isExclusive(eff: any) { return EXCLUSIVE.has(eff?.type); }
async function lintRule(tx: any, gameId: string, incoming: any) {
    if (!incoming) return { ok: true };
    const siblings = await tx.rule.findMany({ where: { gameId, trigger: incoming.trigger, scope: incoming.scope, enabled: true } });
    const incExclusive = Array.isArray(incoming.effects) ? incoming.effects.some(isExclusive) : isExclusive(incoming.effects);
    if (!incExclusive) return { ok: true };
    for (const sib of siblings) {
        const sibEffs = Array.isArray(sib.effects) ? sib.effects : [sib.effects];
        if (!sibEffs.some(isExclusive)) continue;
        if ((sib.priority ?? 0) === (incoming.priority ?? 0) && (sib.specificity ?? 0) === (incoming.specificity ?? 0)) {
            return { ok: false, reason: 'CONFLICT_EXCLUSIVE_EFFECT' };
        }
    }
    return { ok: true };
}

// GET (liste des règles)
export async function GET(_: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const rules = await prisma.rule.findMany({
            where: { gameId },
            select: { id: true, scope: true, trigger: true, priority: true, specificity: true, enabled: true, conditions: true, effects: true },
            orderBy: { id: 'asc' },
        });
        return NextResponse.json({ ok: true, rules });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}

// POST (add/modify/remove) — 1 par tour
export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const { gameId } = await ctx.params;
        const { playerId, action, rule, ruleId } = zRulesMutation.parse(await req.json());

        const res = await prisma.$transaction(async (tx) => {
            const turn = await tx.turn.findFirst({ where: { gameId }, orderBy: { index: 'desc' } });
            if (!turn) throw new Error('TURN_NOT_FOUND');
            if (turn.currentPlayerId !== playerId) throw new Error('NOT_YOUR_TURN');

            const ruleCount = await tx.eventLog.count({ where: { gameId, turnId: turn.id, type: { in: ['RULE_ADDED','RULE_MODIFIED','RULE_REMOVED'] } } });
            const tileCount = await tx.eventLog.count({ where: { gameId, turnId: turn.id, type: 'TILE_EDIT' } });
            if (ruleCount + tileCount >= 1) throw new Error('RULE_CHANGE_QUOTA_EXCEEDED');

            let payload: any = {};

            if (action === 'add') {
                const lint = await lintRule(tx, gameId, rule);
                if (!lint.ok) throw new Error(lint.reason);
                const r = await tx.rule.create({ data: { gameId, scope: rule.scope ?? 'generic', trigger: rule.trigger ?? 'turn.afterMove', conditions: rule.conditions ?? null, effects: rule.effects ?? [], priority: rule.priority ?? 0, specificity: rule.specificity ?? 0, duration: rule.duration ?? null, enabled: rule.enabled ?? true, createdBy: playerId } });
                payload = { action, ruleId: r.id };
            } else if (action === 'modify') {
                if (!ruleId) throw new Error('RULE_ID_REQUIRED');
                const lint = await lintRule(tx, gameId, rule);
                if (!lint.ok) throw new Error(lint.reason);
                await tx.rule.update({ where: { id: ruleId }, data: { scope: rule.scope ?? undefined, trigger: rule.trigger ?? undefined, conditions: rule.conditions ?? undefined, effects: rule.effects ?? undefined, priority: rule.priority ?? undefined, specificity: rule.specificity ?? undefined, duration: rule.duration ?? undefined, enabled: rule.enabled ?? undefined } });
                payload = { action, ruleId };
            } else if (action === 'remove') {
                if (!ruleId) throw new Error('RULE_ID_REQUIRED');
                await tx.rule.delete({ where: { id: ruleId } });
                payload = { action, ruleId };
            } else {
                throw new Error('UNKNOWN_ACTION');
            }

            const ev = await logEvent(tx, gameId,
                action === 'add' ? 'RULE_ADDED' : action === 'modify' ? 'RULE_MODIFIED' : 'RULE_REMOVED',
                payload, turn.id, playerId
            );

            return { ok: true, cursor: ev.id, ...payload };
        });

        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message ?? 'ERR' }, { status: 400 });
    }
}
