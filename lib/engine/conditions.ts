import { prisma } from '@/lib/prisma';

type CondNode =
    | { op: 'AND'|'OR'; nodes: CondNode[] }
    | { op: 'NOT'; node: CondNode }
    | { op: 'eq'|'neq'|'gte'|'lte'|'in'|'hasTag'; path: string; value: any };

function readPath(obj: any, path: string) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

export async function evalCondition(node: any, ctx: any): Promise<boolean> {
    if (!node) return true;
    if (node.op === 'AND') return (await Promise.all(node.nodes.map(n => evalCondition(n, ctx)))).every(Boolean);
    if (node.op === 'OR')  return (await Promise.all(node.nodes.map(n => evalCondition(n, ctx)))).some(Boolean);
    if (node.op === 'NOT') return !(await evalCondition(node.node, ctx));

    // Feuilles
    const left = readPath(ctx, node.path);
    switch (node.op) {
        case 'eq':  return left === node.value;
        case 'neq': return left !== node.value;
        case 'gte': return Number(left) >= Number(node.value);
        case 'lte': return Number(left) <= Number(node.value);
        case 'in':  return Array.isArray(node.value) && node.value.includes(left);
        case 'hasTag': return Array.isArray(left) && left.includes(node.value);
        default: return false;
    }
}

// Construit un mini-contexte d'éval pour règles orientées case/pion/joueur
export async function buildEvalContext(gameId: string, playerId?: string, tileId?: string) {
    const [player, pawn, tile] = await Promise.all([
        playerId ? prisma.player.findUnique({ where: { id: playerId } }) : null,
        playerId ? prisma.player.findUnique({ where: { id: playerId } }).then(p => p?.mainPawnId ? prisma.pawn.findUnique({ where: { id: p!.mainPawnId! } }) : null) : null,
        tileId ? prisma.tile.findUnique({ where: { id: tileId } }) : null
    ]);
    return {
        currentPlayerId: playerId ?? null,
        tile: tile ? { id: tile.id, preset: tile.preset, tags: tile.tags, x: tile.x, y: tile.y } : null,
        pawn: pawn ? { id: pawn.id, x: pawn.x, y: pawn.y } : null,
    };
}
