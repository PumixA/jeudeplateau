'use client';

export default function DirectionPicker({
                                            visible,
                                            options,          // array of { tileId, x, y }
                                            onChoose,
                                            onCancel,
                                        }: {
    visible: boolean;
    options: { tileId: string; x: number; y: number }[];
    onChoose: (tileId: string) => void;
    onCancel?: () => void;
}) {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-40 pointer-events-none">
            <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onCancel} />
            <div className="absolute inset-0">
                {/* petits marqueurs cliquables sur options */}
                {options.map((o) => (
                    <div
                        key={o.tileId}
                        className="absolute pointer-events-auto"
                        style={{
                            left: `calc(${o.x}px - 14px)`,
                            top: `calc(${o.y}px - 14px)`,
                        }}
                    >
                        <button
                            className="w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-lg border border-white/20"
                            title="Aller ici"
                            onClick={(e) => { e.stopPropagation(); onChoose(o.tileId); }}
                        >Go</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
