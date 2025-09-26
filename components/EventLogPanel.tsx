'use client';

import { useEffect, useRef, useState } from 'react';

type EventRow = {
    id: string;
    type: string;
    ts: string;
    payload?: any;
    actor?: { nickname: string; color: string };
};

export default function EventLogPanel({
                                          gameId,
                                          pollMs = 2000,
                                          limit = 30,
                                      }: {
    gameId: string;
    pollMs?: number;
    limit?: number;
}) {
    const [rows, setRows] = useState<EventRow[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const refTimer = useRef<any>(null);

    const fetchMore = async () => {
        const url = cursor
            ? `/api/games/${gameId}/events?since=${encodeURIComponent(cursor)}`
            : `/api/games/${gameId}/events`;
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!j.ok) return;
        const items: any[] = j.events ?? [];
        if (items.length) {
            const mapped: EventRow[] = items.map((e: any) => ({
                id: e.id,
                type: e.type,
                ts: e.ts,
                payload: e.payload,
                actor: e.actor ? { nickname: e.actor.nickname, color: e.actor.color } : undefined,
            }));
            setRows((prev) => {
                const merged = [...mapped.reverse(), ...prev].slice(0, limit);
                return merged;
            });
            setCursor(items[0].id); // dernier id (le plus récent renvoyé)
        }
    };

    useEffect(() => {
        fetchMore();
        refTimer.current = setInterval(fetchMore, pollMs);
        return () => clearInterval(refTimer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId]);

    const label = (row: EventRow) => {
        const actor = row.actor ? row.actor.nickname : 'Système';
        switch (row.type) {
            case 'ROLL_AND_MOVE':
                return `${actor} a lancé le dé : ${row.payload?.rolled}`;
            case 'MOVE_PENDING':
                return `${actor} doit choisir une direction (${row.payload?.stepsLeft} pas restants)`;
            case 'EFFECT_MOVE':
                return `${actor} subit effet déplacement (${row.payload?.amount > 0 ? '+' : ''}${row.payload?.amount})`;
            case 'EFFECT_SKIP':
                return `${actor} saute un tour`;
            case 'EFFECT_GIVE_ITEM':
                return `${actor} reçoit ${row.payload?.item}`;
            case 'EFFECT_TAKE_ITEM':
                return `${actor} perd ${row.payload?.item}`;
            case 'PLAYER_FINISHED':
                return `${actor} a terminé !`;
            case 'TURN_ENDED':
                return `Fin du tour → prochain joueur`;
            case 'RULE_ADDED':
            case 'RULE_MODIFIED':
            case 'RULE_REMOVED':
                return `${actor} a modifié une règle (${row.type})`;
            case 'TILE_EDIT':
                return `${actor} a modifié le plateau`;
            default:
                return `${actor} : ${row.type}`;
        }
    };

    return (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40">
            <div className="px-3 py-2 text-sm font-medium border-b border-neutral-800">
                Journal
            </div>
            <ul className="max-h-56 overflow-auto divide-y divide-neutral-800 text-sm">
                {rows.length === 0 ? (
                    <li className="px-3 py-2 text-neutral-400">Aucun évènement.</li>
                ) : (
                    rows.map((r) => (
                        <li key={r.id} className="px-3 py-2">
                            <div className="flex items-center gap-2">
                                {r.actor?.color && (
                                    <span
                                        className="inline-block w-2.5 h-2.5 rounded-full"
                                        style={{ background: r.actor.color }}
                                    />
                                )}
                                <span>{label(r)}</span>
                            </div>
                            <div className="text-[10px] text-neutral-500">
                                {new Date(r.ts).toLocaleTimeString()}
                            </div>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}
