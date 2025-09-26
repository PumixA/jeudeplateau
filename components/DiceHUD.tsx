'use client';

export default function DiceHUD({
                                    lastRoll,
                                    moveBonus,     // ex: +1 si une règle a ajouté 1 case, -1 si piège, etc.
                                    visible,
                                }: {
    lastRoll: number | null;
    moveBonus?: number | null;
    visible: boolean;
}) {
    if (!visible || lastRoll == null) return null;

    const bonusText =
        typeof moveBonus === 'number' && moveBonus !== 0
            ? (moveBonus > 0 ? `+${moveBonus}` : `${moveBonus}`)
            : null;

    return (
        <div className="fixed z-30 right-4 bottom-4">
            <div className="rounded-xl bg-neutral-900 text-neutral-100 shadow-2xl border border-neutral-700 px-3 py-2 flex items-center gap-3">
                <span className="text-xs text-neutral-400">Résultat</span>
                <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xl font-bold">
                    {lastRoll}
                </div>
                {bonusText && (
                    <span
                        title="Bonus/Malus de déplacement total appliqué par des règles"
                        className="text-sm px-2 py-1 rounded-md border"
                        style={{
                            background: 'rgba(16,185,129,0.12)',
                            borderColor: 'rgba(16,185,129,0.35)',
                            color: moveBonus > 0 ? '#10b981' : '#f97316',
                        }}
                    >
            {bonusText}
          </span>
                )}
            </div>
        </div>
    );
}
