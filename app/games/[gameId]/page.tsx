'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Board from '@/components/Board';
import RuleEditor from '@/components/RuleEditor';
import DiceOverlay from '@/components/DiceOverlay';
import DiceHUD from '@/components/DiceHUD';
import TileEditor from '@/components/TileEditor';
import PlayersPanel from '@/components/PlayersPanel';
import EventLogPanel from '@/components/EventLogPanel';

type State = {
    ok: boolean;
    game: { id: string; name: string; status: string; seed: string };
    turn: { id: string; index: number; currentPlayerId: string; rolledThisTurn?: boolean; lastRoll?: number | null; ruleChangedThisTurn?: boolean; pendingMove?: any };
    players: { id: string; nickname: string; color: string; mainPawnId?: string | null; isActive: boolean }[];
    pawns: { id: string; ownerPlayerId?: string | null; kind: string; x: number; y: number; id: string }[];
    tiles: { id: string; x: number; y: number; preset: string; tags: string[]; id: string }[];
    connections: { id: string; fromTileId: string; toTileId: string; bidir: boolean }[];
    cursor: string | null;
};

export default function GamePage() {
    const { gameId } = useParams<{ gameId: string }>();
    const [state, setState] = useState<State | null>(null);
    const [loading, setLoading] = useState(true);

    // Anim / HUD
    const [overridePawnPositions, setOverridePawnPositions] = useState<Record<string, { x: number; y: number }>>({});
    const [diceOpen, setDiceOpen] = useState(false);
    const [diceFinal, setDiceFinal] = useState<number | null>(null);
    const [moveBonus, setMoveBonus] = useState<number | null>(null);

    // Éditeurs
    const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
    const [tileEditorOpen, setTileEditorOpen] = useState(false);
    const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);

    const pollingRef = useRef<any>(null);
    const busyRef = useRef(false);

    const fetchState = async () => {
        if (!gameId) return;
        const res = await fetch(`/api/games/${gameId}/state`, { cache: 'no-store' });
        const data = await res.json();
        if (data.ok) setState(data);
        setLoading(false);
    };

    useEffect(() => {
        if (!gameId) return;
        fetchState();
        pollingRef.current = setInterval(fetchState, 1500);
        return () => clearInterval(pollingRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId]);

    const ready = !!state && !loading;

    const currentPlayer = ready ? state!.players.find(p => p.id === state!.turn.currentPlayerId) : undefined;
    const rolledThisTurn = !!(ready && state!.turn.rolledThisTurn);
    const ruleChangedThisTurn = !!(ready && state!.turn.ruleChangedThisTurn);
    const lastRoll = ready ? (state!.turn.lastRoll ?? null) : null;
    const gameFinished = ready ? state!.game.status === 'finished' : false;

    const tMap = useMemo(() => new Map((state?.tiles ?? []).map(t => [t.id, t])), [state?.tiles]);

    useEffect(() => { if (ready) setMoveBonus(null); }, [ready, state?.turn.currentPlayerId, state?.turn.index]);

    const animatePawnToTile = async (pawnId: string, toTileId: string) => {
        const pawn = state?.pawns.find(p => p.id === pawnId);
        const to = tMap.get(toTileId);
        if (!pawn || !to) return;
        setOverridePawnPositions(prev => ({ ...prev, [pawnId]: { x: to.x, y: to.y } }));
        await new Promise(r => setTimeout(r, 220));
        setOverridePawnPositions(prev => { const copy = { ...prev }; delete copy[pawnId]; return copy; });
    };

    const handleRollClick = async () => {
        if (!ready || !currentPlayer || rolledThisTurn || busyRef.current || gameFinished) return;
        busyRef.current = true;
        setDiceOpen(true); setDiceFinal(null);
        try {
            const r = await fetch(`/api/games/${gameId}/roll`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: currentPlayer.id }),
            });
            const j = await r.json().catch(()=>({}));
            if (!r.ok || !j.ok) throw new Error(j.error || 'Impossible de lancer le dé.');
            setDiceFinal(j.rolled);
            await new Promise(r => setTimeout(r, 350));
            setDiceOpen(false);
            await fetchState();
        } catch (e: any) {
            alert(e.message || 'Erreur de lancer.');
        } finally {
            setDiceFinal(null);
            busyRef.current = false;
        }
    };

    const handleEndTurnClick = async () => {
        if (!ready || !currentPlayer || busyRef.current || gameFinished) return;
        if (!rolledThisTurn) { alert('Tu dois lancer le dé avant de finir ton tour.'); return; }
        // blocage si un choix de direction est en attente
        if (hasPendingMove) { alert('Choisis une direction avant de finir ton tour.'); return; }

        busyRef.current = true;
        try {
            const r = await fetch(`/api/games/${gameId}/end-turn`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: currentPlayer.id }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.ok) throw new Error(j.error || 'Impossible de terminer le tour.');
            setMoveBonus(null); setSelectedTileIds([]); setTileEditorOpen(false);
            await fetchState();
        } catch (e: any) { alert(e.message); } finally { busyRef.current = false; }
    };

    // --- Direction options, calculées dans le référentiel du Board (même bounds/size) ---
    const pending = (state?.turn?.pendingMove ?? null) as (null | { pawnId: string; currentTileId: string; stepsLeft: number });
    const hasPendingMove = !!(pending && pending.stepsLeft > 0);

    const { minX, minY, size } = useMemo(() => {
        const xs = (state?.tiles ?? []).map(t => t.x);
        const ys = (state?.tiles ?? []).map(t => t.y);
        return { minX: xs.length ? Math.min(...xs) : 0, minY: ys.length ? Math.min(...ys) : 0, size: 56 };
    }, [state?.tiles]);

    const directionOptions = useMemo(() => {
        if (!ready || !pending || pending.stepsLeft <= 0) return [];
        const outs = (state!.connections ?? []).filter(c => c.fromTileId === pending.currentTileId).map(c => c.toTileId);
        if (outs.length <= 1) return [];
        return outs.map(tid => {
            const t = tMap.get(tid)!;
            const x = (t.x - minX) * size + size / 2;
            const y = (t.y - minY) * size + size / 2;
            return { tileId: tid, x, y };
        });
    }, [ready, pending, state?.connections, tMap, minX, minY, size]);

    const overlayDirections = (
        directionOptions.length > 1 && !tileEditorOpen ? (
            <div className="absolute inset-0 pointer-events-none">
                {directionOptions.map(o => (
                    <button
                        key={o.tileId}
                        className="absolute pointer-events-auto w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-lg border border-white/20"
                        style={{ left: o.x - 14, top: o.y - 14 }}
                        title="Aller ici"
                        onClick={async (e) => {
                            e.stopPropagation();
                            const r = await fetch(`/api/games/${gameId}/move/choose`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ playerId: state!.turn.currentPlayerId, toTileId: o.tileId }),
                            });
                            const j = await r.json().catch(()=>({}));
                            if (r.ok && j.ok && j.pendingMove?.pawnId && j.pendingMove?.currentTileId) {
                                await animatePawnToTile(j.pendingMove.pawnId, j.pendingMove.currentTileId);
                            }
                            await fetchState();
                        }}
                    >
                        Go
                    </button>
                ))}
            </div>
        ) : null
    );

    return (
        <div className="p-4 space-y-4 relative">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">{ready ? state!.game.name : 'Chargement…'}</h1>
                    <p className="text-sm text-neutral-400 flex items-center gap-2">
                        {!ready ? 'Initialisation…' : gameFinished ? 'Partie terminée 🎉' : (
                            <>
                                Tour #{state!.turn.index} — Joueur actif :
                                <strong style={{ color: (state!.players.find(p => p.id === state!.turn.currentPlayerId)?.color) }}>
                                    {state!.players.find(p => p.id === state!.turn.currentPlayerId)?.nickname}
                                </strong>
                                {rolledThisTurn ? ' • dé lancé ✅' : ' • dé non lancé'}
                                {state!.turn.lastRoll != null && (
                                    <span className="inline-flex items-center gap-1 text-neutral-100 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-md">
                    🎲 <strong>{state!.turn.lastRoll}</strong>
                  </span>
                                )}
                                {ruleChangedThisTurn && (
                                    <span className="inline-flex items-center gap-1 text-neutral-200 bg-emerald-800/40 border border-emerald-700 px-2 py-0.5 rounded-md">
                    ⚙️ modification utilisée
                  </span>
                                )}
                            </>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        id="btn-roll"
                        type="button"
                        onClick={handleRollClick}
                        disabled={!ready || rolledThisTurn || busyRef.current || gameFinished}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                        🎲 Lancer le dé
                    </button>
                    <button
                        id="btn-tile"
                        type="button"
                        onClick={() => setTileEditorOpen(true)}
                        disabled={!ready || !rolledThisTurn || ruleChangedThisTurn || gameFinished}
                        className="px-4 py-2 rounded-lg bg-sky-700 text-white hover:bg-sky-600 disabled:opacity-50"
                    >
                        🧱 Plateau (1/tour)
                    </button>
                    <button
                        id="btn-rule"
                        type="button"
                        onClick={() => setRuleEditorOpen(true)}
                        disabled={!ready || !rolledThisTurn || ruleChangedThisTurn || gameFinished}
                        className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                        📜 Règle (1/tour)
                    </button>
                    <button
                        id="btn-end"
                        type="button"
                        onClick={handleEndTurnClick}
                        disabled={!ready || !rolledThisTurn || busyRef.current || gameFinished || hasPendingMove}
                        className="px-4 py-2 rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 disabled:opacity-50"
                        title={
                            gameFinished ? 'Partie terminée'
                                : hasPendingMove ? 'Choisis une direction avant de finir'
                                    : (!rolledThisTurn ? 'Lance d’abord le dé' : 'Finir le tour')
                        }
                    >
                        ➡️ Fin du tour
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 relative">
                    {!ready ? (
                        <div className="h-[70vh] rounded-lg border border-neutral-800 bg-neutral-900/40 flex items-center justify-center text-neutral-300">
                            Chargement…
                        </div>
                    ) : (
                        <>
                            <Board
                                tiles={state!.tiles}
                                connections={state!.connections}
                                pawns={state!.pawns}
                                players={state!.players}
                                overridePawnPositions={overridePawnPositions}
                                highlightPlayerId={gameFinished ? undefined : state!.turn.currentPlayerId}
                                selectable={tileEditorOpen}
                                selectedTileIds={selectedTileIds}
                                onTileClick={(id) =>
                                    setSelectedTileIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                                }
                                childrenOverlay={overlayDirections}
                            />

                            {tileEditorOpen && (
                                <TileEditor
                                    gameId={state!.game.id}
                                    currentPlayerId={state!.turn.currentPlayerId}
                                    tiles={state!.tiles}
                                    selectedTileIds={selectedTileIds}
                                    onSelectTile={(id) =>
                                        setSelectedTileIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
                                    }
                                    onClose={() => { setTileEditorOpen(false); setSelectedTileIds([]); }}
                                    onSaved={fetchState}
                                />
                            )}
                        </>
                    )}
                </div>

                <div className="space-y-4">
                    {ready && (
                        <>
                            <PlayersPanel
                                players={state!.players}
                                currentPlayerId={state!.turn.currentPlayerId}
                            />
                            <EventLogPanel gameId={state!.game.id} />
                        </>
                    )}
                </div>
            </div>

            <footer className="text-xs text-neutral-400">
                {ready
                    ? <>Seed: {state!.game.seed} — {state!.players.length} joueurs — {state!.pawns.length} pions — Statut: {state!.game.status}</>
                    : <>Préparation…</>}
            </footer>

            <RuleEditor
                gameId={state?.game.id ?? ''}
                currentPlayerId={state?.turn.currentPlayerId ?? ''}
                open={ruleEditorOpen}
                onClose={() => setRuleEditorOpen(false)}
                onSaved={fetchState}
            />
            <DiceOverlay
                open={diceOpen && !gameFinished}
                finalValue={diceFinal}
                onClose={() => { setDiceOpen(false); setDiceFinal(null); }}
                floating
            />
            <DiceHUD
                visible={!gameFinished}
                lastRoll={lastRoll}
                moveBonus={moveBonus}
            />
        </div>
    );
}
