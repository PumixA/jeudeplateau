'use client';

type Player = {
    id: string;
    nickname: string;
    color: string;
    isActive: boolean;
    mainPawnId?: string | null;
    skipNextTurn?: boolean; // 👈
};

export default function PlayersPanel({
                                         players,
                                         currentPlayerId,
                                     }: {
    players: Player[];
    currentPlayerId?: string;
}) {
    return (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40">
            <div className="px-3 py-2 text-sm font-medium border-b border-neutral-800">
                Joueurs
            </div>
            <ul className="max-h-56 overflow-auto divide-y divide-neutral-800">
                {players.map((p) => {
                    const activeTurn = p.id === currentPlayerId;
                    return (
                        <li key={p.id} className="flex items-center justify-between px-3 py-2">
                            <div className="flex items-center gap-2">
                <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: p.color }}
                    title={p.color}
                />
                                <span className={activeTurn ? 'font-semibold' : ''}>
                  {p.nickname}
                </span>
                            </div>
                            <div className="text-xs text-neutral-400 flex items-center gap-2">
                                {activeTurn ? '⏳ à jouer' : p.isActive ? 'en jeu' : '✅ terminé'}
                                {p.skipNextTurn && p.isActive && (
                                    <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px]">
                    ⏭ saute ce tour
                  </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
