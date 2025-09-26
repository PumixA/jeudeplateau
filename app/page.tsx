'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PlayerRow = { nickname: string; color: string };
type GameRow = { id: string; name: string; status: string; createdAt: string; playersCount: number };

const randColor = () => {
    const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#22c55e','#06b6d4','#eab308','#f97316','#84cc16'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export default function HomePage() {
    const router = useRouter();

    // Création
    const [name, setName] = useState('Partie locale');
    const [players, setPlayers] = useState<PlayerRow[]>([
        { nickname: 'Joueur 1', color: '#ef4444' },
        { nickname: 'Joueur 2', color: '#3b82f6' },
    ]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Liste des parties
    const [games, setGames] = useState<GameRow[]>([]);
    const [loadingGames, setLoadingGames] = useState(true);

    const fetchGames = async () => {
        setLoadingGames(true);
        try {
            const res = await fetch('/api/games', { cache: 'no-store' });
            const data = await res.json();
            if (data.ok) setGames(data.games);
        } finally {
            setLoadingGames(false);
        }
    };

    useEffect(() => {
        fetchGames();
    }, []);

    const addPlayer = () => setPlayers(prev => [...prev, { nickname: `Joueur ${prev.length + 1}`, color: randColor() }]);
    const removePlayer = (idx: number) => setPlayers(prev => prev.filter((_, i) => i !== idx));
    const updateNickname = (idx: number, v: string) => setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, nickname: v } : p));
    const updateColor = (idx: number, v: string) => setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, color: v } : p));

    const createGame = async () => {
        setCreating(true);
        setError(null);
        try {
            const body = {
                name: name.trim() || 'Partie locale',
                players: players
                    .map(p => ({ nickname: p.nickname.trim(), color: p.color }))
                    .filter(p => p.nickname.length > 0),
            };
            if (body.players.length < 1) throw new Error('Ajoute au moins un joueur.');

            const res = await fetch('/api/games', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Création impossible.');
            router.push(`/games/${data.gameId}`);
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue');
        } finally {
            setCreating(false);
        }
    };

    const goToGame = (id: string) => router.push(`/games/${id}`);

    const deleteGame = async (id: string) => {
        if (!confirm('Supprimer cette partie ? Cette action est définitive.')) return;
        const res = await fetch(`/api/games/${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            alert(data.error || 'Suppression impossible.');
            return;
        }
        await fetchGames();
    };

    return (
        <main className="min-h-screen p-6 bg-neutral-950 text-neutral-100">
            <div className="max-w-5xl mx-auto space-y-10">

                {/* Création */}
                <section className="space-y-6 rounded-xl border border-neutral-800 p-4 bg-neutral-900/40">
                    <h1 className="text-2xl font-bold">🎲 Nouveau jeu de plateau</h1>

                    <div>
                        <label className="block text-sm mb-1 text-neutral-300">Nom de la partie</label>
                        <input
                            className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Partie locale"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="block text-sm mb-1 text-neutral-300">Joueurs (illimité)</label>
                            <button onClick={addPlayer} className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500">
                                ➕ Ajouter un joueur
                            </button>
                        </div>

                        <div className="mt-2 space-y-2">
                            {players.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        className="flex-1 rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2"
                                        value={p.nickname}
                                        onChange={e => updateNickname(idx, e.target.value)}
                                        placeholder={`Joueur ${idx + 1}`}
                                    />
                                    <input
                                        type="color"
                                        className="w-12 h-10 rounded-md border border-neutral-700 bg-neutral-800 p-1"
                                        value={p.color}
                                        onChange={e => updateColor(idx, e.target.value)}
                                        title="Couleur du joueur"
                                    />
                                    <button
                                        onClick={() => removePlayer(idx)}
                                        className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
                                        disabled={players.length <= 1}
                                        title={players.length <= 1 ? 'Au moins 1 joueur' : 'Retirer'}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && <div className="text-sm text-red-400">{error}</div>}

                    <div className="flex justify-end">
                        <button
                            onClick={createGame}
                            disabled={creating}
                            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        >
                            {creating ? 'Création…' : 'Créer la partie'}
                        </button>
                    </div>

                    <p className="text-xs text-neutral-500">
                        Astuce : tu peux démarrer avec 1 seul joueur pour tester rapidement.
                    </p>
                </section>

                {/* Parties existantes */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">🗂 Parties existantes</h2>
                        <button onClick={fetchGames} className="text-sm px-3 py-1 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">
                            ↻ Actualiser
                        </button>
                    </div>

                    {loadingGames ? (
                        <div className="text-sm text-neutral-400">Chargement…</div>
                    ) : games.length === 0 ? (
                        <div className="text-sm text-neutral-400">Aucune partie pour le moment.</div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-neutral-800">
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-900/60">
                                <tr className="text-left">
                                    <th className="px-3 py-2">Nom</th>
                                    <th className="px-3 py-2">Statut</th>
                                    <th className="px-3 py-2">Joueurs</th>
                                    <th className="px-3 py-2">Créée le</th>
                                    <th className="px-3 py-2 text-right">Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {games.map(g => (
                                    <tr key={g.id} className="border-t border-neutral-800">
                                        <td className="px-3 py-2">{g.name}</td>
                                        <td className="px-3 py-2 capitalize">{g.status}</td>
                                        <td className="px-3 py-2">{g.playersCount}</td>
                                        <td className="px-3 py-2">{new Date(g.createdAt).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right space-x-2">
                                            <button
                                                onClick={() => goToGame(g.id)}
                                                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500"
                                            >
                                                ▶️ Ouvrir
                                            </button>
                                            <button
                                                onClick={() => deleteGame(g.id)}
                                                className="px-3 py-1 rounded bg-red-600 hover:bg-red-500"
                                            >
                                                🗑️ Supprimer
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
