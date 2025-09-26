import type { Trigger } from './types';
import { getApplicableRules } from './rules';
import { applyEffects } from './effects';
import { prisma } from '@/lib/prisma';

export async function runTrigger(gameId: string, trigger: Trigger, opts: { turnId?: string; playerId?: string; tileId?: string } = {}) {
    // Charge les règles applicables
    const rules = await getApplicableRules(gameId, trigger, opts.playerId, opts.tileId);
    if (!rules.length) return;

    // Applique séquentiellement les règles (déjà triées par spécificité/priorité)
    for (const r of rules) {
        await applyEffects(gameId, opts.turnId, opts.playerId, r.effects);
        // V1 : pas de short-circuit; si tu veux, ajoute un effet "preventAction" qui stoppe la suite
    }
}
