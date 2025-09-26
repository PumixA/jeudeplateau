'use client';

import { useMemo, useState } from 'react';

type Tile = { id: string; x: number; y: number; preset: string; tags: string[] };

export default function TileEditor({
                                       gameId,
                                       currentPlayerId,
                                       tiles,
                                       selectedTileIds,
                                       onSelectTile,
                                       onClose,
                                       onSaved,
                                   }: {
    gameId: string;
    currentPlayerId: string;
    tiles: Tile[];
    selectedTileIds: string[];
    onSelectTile: (id: string) => void;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [preset, setPreset] = useState('neutral');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [pos, setPos] = useState({ x: 24, y: 24 });
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [autoConnect, setAutoConnect] = useState(true);

    const byId = useMemo(() => new Map(tiles.map(t => [t.id, t])), [tiles]);
    const selectedTiles = selectedTileIds.map(id => byId.get(id)).filter(Boolean) as Tile[];

    const startDrag = (e: React.MouseEvent) => {
        setDragging(true);
        setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    };
    const onDrag = (e: React.MouseEvent) => {
        if (dragging) setPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const stopDrag = () => setDragging(false);

    const post = async (body: any) => {
        setBusy(true); setError(null);
        try {
            const r = await fetch(`/api/games/${gameId}/tiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: currentPlayerId, ...body }),
            });
            const j = await r.json().catch(()=>({}));
            if (!r.ok || !j.ok) throw new Error(j.error || 'Erreur');
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Erreur');
        } finally {
            setBusy(false);
        }
    };

    const addTileAdjacent = async (base: Tile, dx: number, dy: number) => {
        const body: any = { action: 'addTile', x: base.x + dx, y: base.y + dy, preset: 'neutral', tags: [] };
        if (autoConnect) body.connectToTileId = base.id; // 👈 envoi du lien auto
        await post(body);
    };

    const removeSelectedTile = async () => {
        if (selectedTileIds.length !== 1) return setError('Sélectionne 1 case.');
        await post({ action: 'removeTile', tileId: selectedTileIds[0] });
    };

    const connectSelected = async () => {
        if (selectedTileIds.length !== 2) return setError('Sélectionne 2 cases.');
        await post({ action: 'connect', fromTileId: selectedTileIds[0], toTileId: selectedTileIds[1], bidir: true });
    };

    const disconnectSelected = async () => {
        if (selectedTileIds.length !== 2) return setError('Sélectionne 2 cases.');
        await post({ action: 'disconnect', fromTileId: selectedTileIds[0], toTileId: selectedTileIds[1] });
    };

    const updatePreset = async () => {
        if (selectedTileIds.length !== 1) return setError('Sélectionne 1 case.');
        await post({ action: 'updateTile', tileId: selectedTileIds[0], preset });
    };

    return (
        <div
            className="absolute z-30 pointer-events-auto w-80 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-100 shadow-2xl"
            style={{ left: pos.x, top: pos.y }}
            onMouseMove={onDrag}
            onMouseUp={stopDrag}
        >
            <div
                className="p-2 border-b border-neutral-800 cursor-move bg-neutral-800 rounded-t-2xl flex justify-between items-center"
                onMouseDown={startDrag}
            >
                <span className="font-medium">Édition du plateau (1 action/tour)</span>
                <button onClick={() => { onClose(); }} className="px-2 py-1 text-sm rounded bg-neutral-700 hover:bg-neutral-600">✕</button>
            </div>

            <div className="p-3 space-y-3">
                <div className="text-xs text-neutral-400">
                    Sélection : {selectedTiles.length ? selectedTiles.map(t => `(${t.x},${t.y})`).join(', ') : 'aucune'}
                </div>

                {/* Ajouter adjacente + connecter */}
                <div className="rounded border border-neutral-800 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-neutral-400">Ajouter une case adjacente</div>
                        <label className="flex items-center gap-2 text-xs text-neutral-300">
                            <input type="checkbox" checked={autoConnect} onChange={e=>setAutoConnect(e.target.checked)} />
                            Connecter
                        </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <button disabled={busy || selectedTiles.length !== 1} onClick={() => addTileAdjacent(selectedTiles[0], 0, -1)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50">↑</button>
                        <div />
                        <button disabled={busy || selectedTiles.length !== 1} onClick={() => addTileAdjacent(selectedTiles[0], 0, 1)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50">↓</button>
                        <button disabled={busy || selectedTiles.length !== 1} onClick={() => addTileAdjacent(selectedTiles[0], -1, 0)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50">←</button>
                        <div />
                        <button disabled={busy || selectedTiles.length !== 1} onClick={() => addTileAdjacent(selectedTiles[0], 1, 0)} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50">→</button>
                    </div>
                </div>

                {/* Connexions */}
                <div className="rounded border border-neutral-800 p-2 space-y-2">
                    <div className="text-xs text-neutral-400">Connexion entre deux cases</div>
                    <div className="flex gap-2">
                        <button disabled={busy || selectedTileIds.length !== 2} onClick={connectSelected} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">Connecter (↔)</button>
                        <button disabled={busy || selectedTileIds.length !== 2} onClick={disconnectSelected} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50">Déconnecter</button>
                    </div>
                </div>

                {/* Preset */}
                <div className="rounded border border-neutral-800 p-2 space-y-2">
                    <div className="text-xs text-neutral-400">Preset de la case</div>
                    <select className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm" value={preset} onChange={e => setPreset(e.target.value)}>
                        <option value="neutral">neutral</option>
                        <option value="start">start</option>
                        <option value="goal">goal</option>
                        <option value="bonus">bonus</option>
                        <option value="trap">trap</option>
                    </select>
                    <button disabled={busy || selectedTileIds.length !== 1} onClick={updatePreset} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50">Appliquer</button>
                </div>

                {/* Suppression */}
                <div className="rounded border border-neutral-800 p-2">
                    <button disabled={busy || selectedTileIds.length !== 1} onClick={removeSelectedTile} className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50">Supprimer la case sélectionnée</button>
                </div>

                {error && <div className="text-sm text-red-400">{error}</div>}
            </div>
        </div>
    );
}
