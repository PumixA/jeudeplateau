'use client';

import { useEffect, useMemo, useState } from 'react';

type Rule = {
    id: string;
    scope: 'generic' | 'player' | 'tile';
    trigger: string;
    priority?: number | null;
    specificity?: number | null;
    enabled: boolean;
    conditions?: any | null;
    effects: any;
};

export default function RuleEditor({
                                       gameId,
                                       currentPlayerId,
                                       open,
                                       onClose,
                                       onSaved,
                                   }: {
    gameId: string;
    currentPlayerId: string;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [rules, setRules] = useState<Rule[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [action, setAction] = useState<'add'|'modify'|'remove'>('add');
    const [selectedRuleId, setSelectedRuleId] = useState<string>('');

    const [trigger, setTrigger] = useState<string>('on.enterTile');
    const [scope, setScope] = useState<'generic'|'player'|'tile'>('generic');
    const [priority, setPriority] = useState<number>(0);
    const [specificity, setSpecificity] = useState<number>(0);
    const [enabled, setEnabled] = useState<boolean>(true);

    const [condText, setCondText] = useState<string>('');

    type EffectForm = { type: 'dice.set'|'move.delta'|'victory.declare'; value?: string; steps?: number; message?: string };
    const [effects, setEffects] = useState<EffectForm[]>([]);

    useEffect(() => {
        if (!open) return;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/games/${gameId}/rules`, { cache: 'no-store' });
                const j = await res.json();
                if (j.ok) setRules(j.rules);
            } finally {
                setLoading(false);
            }
        })();
    }, [open, gameId]);

    useEffect(() => {
        if (action === 'add') return;
        const r = rules.find(x => x.id === selectedRuleId);
        if (!r) return;
        setTrigger(r.trigger);
        setScope(r.scope);
        setPriority(r.priority ?? 0);
        setSpecificity(r.specificity ?? 0);
        setEnabled(r.enabled);
        setCondText(r.conditions ? JSON.stringify(r.conditions, null, 2) : '');
        const arr = Array.isArray(r.effects) ? r.effects : [r.effects];
        const ef: EffectForm[] = arr.map((e: any) => {
            if (e.type === 'dice.set') return { type: 'dice.set', value: (e.faces ?? []).join(',') };
            if (e.type === 'move.delta') return { type: 'move.delta', steps: e.steps ?? 0 };
            if (e.type === 'victory.declare') return { type: 'victory.declare', message: e.message ?? 'Victoire !' };
            return { type: 'move.delta', steps: 0 };
        });
        setEffects(ef);
    }, [action, selectedRuleId, rules]);

    const addEffect = () => setEffects(prev => [...prev, { type: 'move.delta', steps: 1 }]);
    const updateEffect = (i: number, patch: Partial<EffectForm>) =>
        setEffects(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));
    const removeEffect = (i: number) => setEffects(prev => prev.filter((_, idx) => idx !== i));

    const canSubmit = useMemo(() => {
        if (action === 'remove') return !!selectedRuleId;
        if (action === 'modify') return !!selectedRuleId;
        return trigger && scope && effects.length > 0;
    }, [action, selectedRuleId, trigger, scope, effects.length]);

    // 🎯 P R E S E T S
    const applyPresetBonusEnterTile = () => {
        setAction('add');
        setTrigger('on.enterTile');
        setScope('generic');
        setPriority(0);
        setSpecificity(0);
        setEnabled(true);
        setCondText('');
        setEffects([{ type: 'move.delta', steps: 1 }]);
    };

    const submit = async () => {
        try {
            setError(null);
            const payload: any = { action, playerId: currentPlayerId };

            if (action === 'remove') {
                payload.ruleId = selectedRuleId;
            } else {
                const rule: any = { scope, trigger, priority, specificity, enabled };
                if (condText.trim().length) {
                    try {
                        rule.conditions = JSON.parse(condText);
                    } catch {
                        throw new Error('Conditions : JSON invalide.');
                    }
                }
                const effs = effects.map(e => {
                    if (e.type === 'dice.set') {
                        const faces = (e.value ?? '')
                            .split(',')
                            .map(s => parseInt(s.trim(), 10))
                            .filter(n => Number.isFinite(n));
                        if (!faces.length) throw new Error('Effet “Dé → faces” : entre au moins un entier.');
                        return { type: 'dice.set', faces };
                    }
                    if (e.type === 'move.delta') {
                        const steps = Number(e.steps ?? 0);
                        if (!Number.isFinite(steps)) throw new Error('Effet “Déplacement” : steps invalide.');
                        return { type: 'move.delta', steps };
                    }
                    if (e.type === 'victory.declare') {
                        return { type: 'victory.declare', message: e.message ?? 'Victoire !' };
                    }
                    return null;
                }).filter(Boolean);
                rule.effects = effs;
                if (action === 'modify') (payload as any).ruleId = selectedRuleId;
                (payload as any).rule = rule;
            }

            const res = await fetch(`/api/games/${gameId}/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.ok) throw new Error(j.error || 'Impossible de valider la règle.');
            onSaved();
            onClose();
            alert('Règle appliquée ✔️'); // feedback simple et évident
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue.');
        }
    };

    if (!open) return null;

    const humanSummary =
        action === 'remove' ? 'Tu vas SUPPRIMER la règle sélectionnée.'
            : `Quand « ${trigger} » se produit, cette règle s’applique sur « ${scope} » et exécute ${effects.length} effet(s).`;

    return (
        <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="absolute inset-0 p-4 flex items-center justify-center">
                <div className="w-full max-w-3xl rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-100 shadow-2xl">
                    <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Configurer une règle (1 max par tour)</h3>
                        <button onClick={onClose} className="text-sm px-3 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Fermer</button>
                    </div>

                    <div className="p-4 grid md:grid-cols-3 gap-4">
                        {/* Colonne gauche : intentions + presets */}
                        <div className="md:col-span-1 space-y-3">
                            <div>
                                <div className="text-xs text-neutral-400 mb-1">Action</div>
                                <div className="flex gap-2">
                                    <label className="flex items-center gap-1">
                                        <input type="radio" checked={action==='add'} onChange={()=>setAction('add')} /> Ajouter
                                    </label>
                                    <label className="flex items-center gap-1">
                                        <input type="radio" checked={action==='modify'} onChange={()=>setAction('modify')} /> Modifier
                                    </label>
                                    <label className="flex items-center gap-1">
                                        <input type="radio" checked={action==='remove'} onChange={()=>setAction('remove')} /> Supprimer
                                    </label>
                                </div>
                            </div>

                            {(action==='modify' || action==='remove') && (
                                <div>
                                    <div className="text-xs text-neutral-400 mb-1">Choisir une règle</div>
                                    <select
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                        value={selectedRuleId}
                                        onChange={e => setSelectedRuleId(e.target.value)}
                                    >
                                        <option value="">— Sélectionner —</option>
                                        {rules.map(r => (
                                            <option key={r.id} value={r.id}>
                                                [{r.scope}] {r.trigger} — {Array.isArray(r.effects) ? r.effects.map((e:any)=>e.type).join(',') : (r.effects?.type ?? 'effets')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Preset rapide très clair */}
                            {action === 'add' && (
                                <div className="mt-3">
                                    <div className="text-xs text-neutral-400 mb-1">Presets rapides</div>
                                    <button
                                        onClick={applyPresetBonusEnterTile}
                                        className="w-full text-left text-sm px-3 py-2 rounded-md bg-emerald-700/30 border border-emerald-600 hover:bg-emerald-700/40"
                                        title="Ajoute automatiquement un bonus de +1 case à chaque entrée de case pour tous les joueurs."
                                    >
                                        ✅ Bonus simple : <strong>+1 case à chaque entrée de case</strong> (tous joueurs)
                                    </button>
                                </div>
                            )}

                            <div className="text-xs text-neutral-400">
                                <p className="mb-2">👉 <strong>But :</strong> définis quand la règle s’applique (déclencheur + conditions) et ce qu’elle fait (effets).</p>
                            </div>
                        </div>

                        {/* Colonne droite : formulaire */}
                        <div className="md:col-span-2 space-y-4">
                            {action !== 'remove' && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-neutral-400">Déclencheur</label>
                                            <select
                                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                                value={trigger}
                                                onChange={e=>setTrigger(e.target.value)}
                                            >
                                                <option value="on.enterTile">on.enterTile (arrivée sur case)</option>
                                                <option value="turn.start">turn.start (début de tour)</option>
                                                <option value="turn.afterMove">turn.afterMove (après déplacement)</option>
                                                <option value="turn.end">turn.end (fin de tour)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-neutral-400">Portée</label>
                                            <select
                                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                                value={scope}
                                                onChange={e=>setScope(e.target.value as any)}
                                            >
                                                <option value="generic">generic (tous)</option>
                                                <option value="player">player (joueur)</option>
                                                <option value="tile">tile (case)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-neutral-400">Priorité</label>
                                            <input className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm" type="number" value={priority} onChange={e=>setPriority(parseInt(e.target.value,10)||0)} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-neutral-400">Spécificité</label>
                                            <input className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm" type="number" value={specificity} onChange={e=>setSpecificity(parseInt(e.target.value,10)||0)} />
                                        </div>
                                        <label className="flex items-center gap-2">
                                            <input id="enabled" type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />
                                            <span className="text-xs text-neutral-300">Active</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-xs text-neutral-400">Conditions (optionnel, JSON)</label>
                                        <textarea
                                            className="w-full min-h-[84px] bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                            placeholder='Ex: {"playerId":"..."}'
                                            value={condText}
                                            onChange={e=>setCondText(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs text-neutral-400">Effets</label>
                                            <button onClick={addEffect} className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">+ Ajouter un effet</button>
                                        </div>

                                        <div className="mt-2 space-y-2">
                                            {effects.length === 0 && (
                                                <div className="text-xs text-neutral-500">Aucun effet. Ajoute au moins un effet (ex: déplacement +1).</div>
                                            )}
                                            {effects.map((e, i) => (
                                                <div key={i} className="rounded border border-neutral-800 bg-neutral-900/40 p-2 grid grid-cols-5 gap-2">
                                                    <select
                                                        className="col-span-2 bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                                        value={e.type}
                                                        onChange={ev => updateEffect(i, { type: ev.target.value as any })}
                                                    >
                                                        <option value="dice.set">Dé → fixer faces</option>
                                                        <option value="move.delta">Déplacement → +/− cases</option>
                                                        <option value="victory.declare">Victoire → déclarer</option>
                                                    </select>

                                                    {e.type === 'dice.set' && (
                                                        <input
                                                            className="col-span-2 bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                                            placeholder="Faces (ex: 1,2,3,3,6)"
                                                            value={e.value ?? ''}
                                                            onChange={ev => updateEffect(i, { value: ev.target.value })}
                                                        />
                                                    )}
                                                    {e.type === 'move.delta' && (
                                                        <input
                                                            className="col-span-2 bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                                            type="number"
                                                            placeholder="Steps (ex: 2 ou -1)"
                                                            value={e.steps ?? 1}
                                                            onChange={ev => updateEffect(i, { steps: parseInt(ev.target.value,10)||0 })}
                                                        />
                                                    )}
                                                    {e.type === 'victory.declare' && (
                                                        <input
                                                            className="col-span-2 bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm"
                                                            placeholder="Message (ex: GG !)"
                                                            value={e.message ?? 'Victoire !'}
                                                            onChange={ev => updateEffect(i, { message: ev.target.value })}
                                                        />
                                                    )}

                                                    <button
                                                        className="text-sm rounded bg-red-600 hover:bg-red-500 px-2 py-1"
                                                        onClick={() => removeEffect(i)}
                                                    >
                                                        Suppr
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && <div className="text-sm text-red-400">{error}</div>}

                            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                                <button onClick={onClose} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Annuler</button>
                                <button
                                    onClick={submit}
                                    disabled={!canSubmit}
                                    className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                                >
                                    Valider la règle
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-4 py-3 border-t border-neutral-800 text-xs text-neutral-300">
                        <strong>Résumé :</strong> {humanSummary}
                    </div>
                </div>
            </div>
        </div>
    );
}
