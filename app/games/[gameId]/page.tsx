'use client';

import { useEffect, useRef, useState } from 'react';
import Board from '@/components/Board';
import RuleEditor from '@/components/RuleEditor';
import DiceOverlay from '@/components/DiceOverlay';

type State = {
    ok: boolean;
    game: { id: string; name: string; status: string; seed: string };
    turn: { id: string; index: number; currentPlayerId: string; rolledThisTurn?: boolean; lastRoll?: number | null; ruleChangedThisTurn?: boolean };
    players: { id: string; nickname: string; color: string; mainPawnId?: string | null; isActive: boolean }[];
    pawns: { id: string; ownerPlayerId?: string | null; kind: string; x: number; y: number }[];
    tiles: { id: string; x: number; y: number; preset: string; tags: string[] }[];
    connections: { id: string; fromTileId: string; toTileId: string; bidir: boolean }[];
    cursor: string | null;
};

export default function GamePage({ params }: { params: { gameId: string } }) {
    const gameId = params.gameId;
    const [state, setState] = useState<State | null>(null);
    const [loading, setLoading] = useState(true);

    // Anim
    const [overridePawnPositions, setOverridePawnPositions] = useState<Record<string, { x: number; y: number }>>({});
    const [diceOpen, setDiceOpen] = useState(false);
    const [diceFinal, setDiceFinal] = useState<number | null>(null);

    // Rule editor
    const [editorOpen, setEditorOpen] = useState(false);

    const pollingRef = useRef<any>(null);
    const busyRef = useRef(false);

    const fetchState = async () => {
        const res = await fetch(`/api/games/${gameId}/state`, { cache: 'no-store' });
        const data = await res.json();
        if (data.ok) setState(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchState();
        pollingRef.current = setInterval(fetchState, 1500);
        return () => clearInterval(pollingRef.current);
    }, [gameId]);

    const currentPlayer = state?.players.find(p => p.id === state?.turn.currentPlayerId);
    const rolledThisTurn = !!state?.turn.rolledThisTurn;
    const ruleChangedThisTurn = !!state?.turn.ruleChangedThisTurn;
    const lastRoll = state?.turn.lastRoll ?? null;
    const gameFinished = state?.game.status === 'finished';

    const animatePawnStepByStep = async (pawnId: string, fromX: number, toX: number, y = 0) => {
        const step = fromX < toX ? 1 : -1;
        for (let x = fromX + step; (step > 0 ? x <= toX : x >= toX); x += step) {
            setOverridePawnPositions(prev => ({ ...prev, [pawnId]: { x, y } }));
            await new Promise(r => setTimeout(r, 220));
        }
        await new Promise(r => setTimeout(r, 120));
        setOverridePawnPositions(prev => {
            const copy = { ...prev };
            delete copy[pawnId];
            return copy;
        });
    };

    const handleRollClick = async () => {
        if (!state || !currentPlayer || rolledThisTurn || busyRef.current || gameFinished) return;
        busyRef.current = true;
        setDiceOpen(true);
        setDiceFinal(null);

        try {
            const corePawn = state.pawns.find(p => p.ownerPlayerId === currentPlayer.id && p.kind === 'core');
            const startX = corePawn?.x ?? 0;

            const r = await fetch(`/api/games/${gameId}/roll`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: currentPlayer.id }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.ok) throw new Error(j.error || 'Impossible de lancer le dé.');

            const rolled = j.rolled as number;
            const to = j.to as { x: number; y: number };
            setDiceFinal(rolled);
            await new Promise(r => setTimeout(r, 350));
            setDiceOpen(false);

            if (corePawn) {
                await animatePawnStepByStep(corePawn.id, startX, to.x, to.y);
            }
            await fetchState();
        } catch (e: any) {
            alert(e.message || 'Erreur de lancer.');
        } finally {
            setDiceFinal(null);
            busyRef.current = false;
        }
    };

    const handleEndTurnClick = async () => {
        if (!state || !currentPlayer || busyRef.current || gameFinished) return;
        if (!rolledThisTurn) {
            alert('Tu dois lancer le dé avant de finir ton tour.');
            return;
        }
        busyRef.current = true;
        try {
            const r = await fetch(`/api/games/${gameId}/end-turn`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: currentPlayer.id }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.ok) throw new Error(j.error || 'Impossible de terminer le tour.');
            await fetchState();
        } catch (e: any) {
            alert(e.message);
        } finally {
            busyRef.current = false;
        }
    };

    if (loading || !state) {
        return <div className="p-6 text-sm text-neutral-300">Chargement de la partie…</div>;
    }

    const ruleBtnDisabled = !rolledThisTurn || ruleChangedThisTurn || gameFinished;
    const ruleBtnTitle = gameFinished
        ? 'Partie terminée'
        : !rolledThisTurn
            ? 'Lance d’abord le dé (puis tu pourras changer 1 règle).'
            : ruleChangedThisTurn
                ? 'La modification de règle a déjà été utilisée ce tour.'
                : 'Ajouter / modifier / supprimer une règle';

    return (
        <div className="p-4 space-y-4 relative">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold">{state.game.name}</h1>
                    <p className="text-sm text-neutral-400 flex items-center gap-2">
                        {gameFinished ? (
                            <>Partie terminée 🎉</>
                        ) : (
                            <>
                                Tour #{state.turn.index} — Joueur actif :
                                <strong style={{ color: currentPlayer?.color }}>{currentPlayer?.nickname}</strong>
                                {rolledThisTurn ? ' • dé lancé ✅' : ' • dé non lancé'}
                                {lastRoll != null && (
                                    <span className="inline-flex items-center gap-1 text-neutral-100 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-md">
                    🎲 <strong>{lastRoll}</strong>
                  </span>
                                )}
                                {ruleChangedThisTurn && (
                                    <span className="inline-flex items-center gap-1 text-neutral-200 bg-emerald-800/40 border border-emerald-700 px-2 py-0.5 rounded-md">
                    📜 règle modifiée (quota atteint)
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
                        disabled={rolledThisTurn || busyRef.current || gameFinished}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                        title={gameFinished ? 'Partie terminée' : (rolledThisTurn ? 'Déjà lancé ce tour' : 'Lancer le dé')}
                    >
                        🎲 Lancer le dé
                    </button>
                    <button
                        id="btn-rule"
                        type="button"
                        onClick={() => setEditorOpen(true)}
                        disabled={ruleBtnDisabled}
                        className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
                        title={ruleBtnTitle}
                    >
                        📜 Règle (1/tour)
                    </button>
                    <button
                        id="btn-end"
                        type="button"
                        onClick={handleEndTurnClick}
                        disabled={!rolledThisTurn || busyRef.current || gameFinished}
                        className="px-4 py-2 rounded-lg bg-neutral-700 text-white hover:bg-neutral-600 disabled:opacity-50"
                        title={gameFinished ? 'Partie terminée' : (!rolledThisTurn ? 'Lance d’abord le dé' : 'Finir le tour')}
                    >
                        ➡️ Fin du tour
                    </button>
                </div>
            </header>

            <Board
                tiles={state.tiles}
                pawns={state.pawns}
                players={state.players}
                overridePawnPositions={overridePawnPositions}
                highlightPlayerId={gameFinished ? undefined : state.turn.currentPlayerId}
            />

            <footer className="text-xs text-neutral-400">
                Seed: {state.game.seed} — {state.players.length} joueurs — {state.pawns.length} pions — Statut: {state.game.status}
            </footer>

            <RuleEditor
                gameId={state.game.id}
                currentPlayerId={state.turn.currentPlayerId}
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                onSaved={fetchState}
            />

            <DiceOverlay
                open={diceOpen && !gameFinished}
                finalValue={diceFinal}
                onClose={() => { setDiceOpen(false); setDiceFinal(null); }}
                floating
            />
        </div>
    );
}
