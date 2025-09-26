import { prisma } from '@/lib/prisma';
import type { RuleDSL, Trigger } from './types';
import { evalCondition, buildEvalContext } from './conditions';

export async function fetchActiveRules(gameId: string, trigger: Trigger) {
    const rules = await prisma.rule.findMany({
        where: { gameId, enabled: true, trigger },
        orderBy: { createdAt: 'asc' }
    });
    return rules.map(r => ({
        id: r.id,
        scope: r.scope,
        trigger: r.trigger as Trigger,
        conditions: r.conditions ?? null,
        effects: Array.isArray(r.effects) ? r.effects : [r.effects],
        priority: r.priority ?? 0,
        specificity: r.specificity ?? 0,
        enabled: r.enabled,
    } as RuleDSL));
}

export async function getApplicableRules(gameId: string, trigger: Trigger, playerId?: string, tileId?: string) {
    const all = await fetchActiveRules(gameId, trigger);
    const ctx = await buildEvalContext(gameId, playerId, tileId);
    const passing: RuleDSL[] = [];
    for (const r of all) {
        const ok = await evalCondition(r.conditions, ctx);
        if (ok) passing.push(r);
    }
    // Tri final : spécificité DESC, priorité DESC, puis ancienneté (déjà id asc)
    return passing.sort((a, b) => {
        if ((b.specificity ?? 0) !== (a.specificity ?? 0)) return (b.specificity ?? 0) - (a.specificity ?? 0);
        if ((b.priority ?? 0) !== (a.priority ?? 0))       return (b.priority ?? 0) - (a.priority ?? 0);
        return 0;
    });
}
