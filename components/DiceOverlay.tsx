'use client';

import { useEffect, useRef, useState } from 'react';

export default function DiceOverlay({
                                        open,
                                        finalValue,
                                        onClose,
                                        duration = 900,
                                        floating = true,
                                    }: {
    open: boolean;
    finalValue?: number | null;
    onClose: () => void;
    duration?: number;
    floating?: boolean; // si true: petit widget bas-droite, sans backdrop
}) {
    const [rollingValue, setRollingValue] = useState<number>(1);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!open) return;
        timerRef.current = setInterval(() => {
            setRollingValue((v) => ((v % 6) + 1));
        }, 80);

        const stopTimer = setTimeout(() => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }, duration);

        return () => {
            clearInterval(timerRef.current as any);
            clearTimeout(stopTimer);
            timerRef.current = null;
        };
    }, [open, duration]);

    useEffect(() => {
        if (!open) return;
        if (finalValue != null) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setRollingValue(finalValue);
        }
    }, [open, finalValue]);

    if (!open) return null;

    // widget compact bas-droite; pas de backdrop pour voir le plateau
    return (
        <div
            className="fixed z-40"
            style={{
                right: floating ? 16 : 0,
                bottom: floating ? 16 : 0,
                left: floating ? 'auto' : 0,
                top: floating ? 'auto' : 0,
                pointerEvents: 'auto',
            }}
        >
            <div className="rounded-xl bg-neutral-900 text-neutral-100 shadow-2xl border border-neutral-700 p-3 flex items-center gap-3">
                <div className="text-xs text-neutral-400">Dé</div>
                <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-2xl font-bold">
                    {rollingValue}
                </div>
                {finalValue != null && (
                    <button
                        onClick={onClose}
                        className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm"
                        title="Fermer"
                    >
                        OK
                    </button>
                )}
            </div>
        </div>
    );
}
