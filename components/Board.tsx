'use client';

import React, { useMemo, useRef } from 'react';

type Tile = { id: string; x: number; y: number; preset: string; tags: string[] };
type Conn = { id: string; fromTileId: string; toTileId: string; bidir: boolean };
type Pawn = { id: string; ownerPlayerId?: string | null; kind: string; x: number; y: number };
type Player = { id: string; nickname: string; color: string; mainPawnId?: string | null; isActive: boolean };

export default function Board({
                                  tiles,
                                  connections = [],
                                  pawns,
                                  players,
                                  size = 56,
                                  overridePawnPositions,
                                  highlightPlayerId,
                                  selectable = false,
                                  selectedTileIds = [],
                                  onTileClick,
                                  childrenOverlay, // 👈 overlay rendu dans le même conteneur scroll
                              }: {
    tiles: Tile[];
    connections?: Conn[];
    pawns: Pawn[];
    players: Player[];
    size?: number;
    overridePawnPositions?: Record<string, { x: number; y: number }>;
    highlightPlayerId?: string;
    selectable?: boolean;
    selectedTileIds?: string[];
    onTileClick?: (id: string) => void;
    childrenOverlay?: React.ReactNode;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);

    const bounds = useMemo(() => {
        if (!tiles.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        const xs = tiles.map(t => t.x), ys = tiles.map(t => t.y);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    }, [tiles]);

    const width = (bounds.maxX - bounds.minX + 1) * size;
    const height = (bounds.maxY - bounds.minY + 1) * size;

    const tMap = useMemo(() => new Map(tiles.map(t => [t.id, t])), [tiles]);
    const tilePos = (t: Tile) => ({ cx: (t.x - bounds.minX) * size + size / 2, cy: (t.y - bounds.minY) * size + size / 2 });
    const getPlayer = (id?: string | null) => players.find(p => p.id === id);

    const groups = useMemo(() => {
        const map = new Map<string, Pawn[]>();
        for (const p of pawns) {
            const pos = overridePawnPositions?.[p.id] ?? { x: p.x, y: p.y };
            const key = `${pos.x},${pos.y}`;
            const arr = map.get(key) ?? [];
            arr.push(p);
            map.set(key, arr);
        }
        return map;
    }, [pawns, overridePawnPositions]);

    const clusterOffset = (index: number, total: number) => {
        const r = 10;
        if (total <= 1) return { dx: 0, dy: 0 };
        const angle = (index / total) * 2 * Math.PI;
        return { dx: Math.round(Math.cos(angle) * r), dy: Math.round(Math.sin(angle) * r) };
    };

    return (
        <div ref={wrapRef} className="relative w-full h-[70vh] border rounded-lg overflow-auto bg-neutral-900/40">
            <div className="relative" style={{ width, height }}>
                {/* Connexions */}
                <svg width={width} height={height} className="absolute left-0 top-0 pointer-events-none">
                    {connections.map((c) => {
                        const from = tMap.get(c.fromTileId);
                        const to = tMap.get(c.toTileId);
                        if (!from || !to) return null;
                        const { cx: x1, cy: y1 } = tilePos(from);
                        const { cx: x2, cy: y2 } = tilePos(to);
                        return (
                            <g key={c.id}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(148,163,184,0.7)" strokeWidth="3" />
                                {!c.bidir && (<polygon points={`${x2},${y2} ${x2-6},${y2-3} ${x2-6},${y2+3}`} fill="rgba(148,163,184,0.9)" />)}
                            </g>
                        );
                    })}
                </svg>

                {/* Tiles */}
                {tiles.map(tile => {
                    const left = (tile.x - bounds.minX) * size;
                    const top = (tile.y - bounds.minY) * size;
                    const presetColor =
                        tile.preset === 'start' ? '#16a34a' :
                            tile.preset === 'goal'  ? '#f59e0b' :
                                tile.preset === 'trap'  ? '#ef4444' :
                                    tile.preset === 'bonus' ? '#3b82f6' : '#6b7280';
                    const isSelected = selectedTileIds?.includes(tile.id);

                    return (
                        <button
                            key={tile.id}
                            type="button"
                            className="absolute rounded-md flex items-center justify-center text-xs font-medium focus:outline-none"
                            style={{
                                left, top, width: size - 8, height: size - 8, margin: 4,
                                background: presetColor, color: 'white',
                                boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,.8), 0 2px 6px rgba(0,0,0,.3)' : '0 2px 6px rgba(0,0,0,.3)',
                                cursor: selectable ? 'pointer' : 'default',
                                opacity: selectable && !isSelected ? 0.95 : 1,
                            }}
                            onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
                            title={`(${tile.x},${tile.y}) ${tile.preset}`}
                        >
                            {tile.preset}{tile.tags.includes('arrival') ? ' ⭐' : ''}
                        </button>
                    );
                })}

                {/* Pawns */}
                {Array.from(groups.entries()).flatMap(([key, group]) => {
                    const [gx, gy] = key.split(',').map(Number);
                    const baseLeft = (gx - bounds.minX) * size + size / 2;
                    const baseTop = (gy - bounds.minY) * size + size / 2;

                    return group.map((p, idx) => {
                        const owner = getPlayer(p.ownerPlayerId ?? undefined);
                        const color = owner?.color ?? '#ffffff';
                        const { dx, dy } = clusterOffset(idx, group.length);
                        const isActivePlayer = owner?.id === highlightPlayerId;
                        const isFinished = owner ? !owner.isActive : false;

                        const diameter = isActivePlayer ? 28 : 24;
                        const ring = isActivePlayer ? '0 0 0 4px rgba(99,102,241,0.45)' : '0 0 0 2px rgba(0,0,0,0.5)';
                        const opacity = isFinished ? 0.45 : 1;

                        return (
                            <div key={p.id} className="absolute" style={{ left: baseLeft + dx - diameter/2, top: baseTop + dy - diameter/2 }}>
                                {isActivePlayer && (
                                    <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(99,102,241,0.25)', filter: 'blur(1px)' }} />
                                )}
                                <div
                                    className="relative rounded-full transition-all duration-150"
                                    style={{
                                        width: diameter, height: diameter,
                                        background: color,
                                        boxShadow: `${ring}, 0 6px 12px rgba(0,0,0,.35)`,
                                        border: '2px solid rgba(0,0,0,.35)',
                                        opacity,
                                        filter: isFinished ? 'grayscale(40%)' : 'none',
                                    }}
                                    title={`${owner?.nickname ?? 'PNJ'} (${p.kind})`}
                                />
                            </div>
                        );
                    });
                })}

                {/* Overlay synchronisé (choix de direction, etc.) */}
                {childrenOverlay && (
                    <div className="absolute inset-0 pointer-events-none">
                        {childrenOverlay}
                    </div>
                )}
            </div>
        </div>
    );
}
