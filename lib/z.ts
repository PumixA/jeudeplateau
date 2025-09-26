import { z } from 'zod';

export const zCreateGame = z.object({
    name: z.string().min(1),
    players: z.array(z.object({ nickname: z.string().min(1), color: z.string().optional() })).min(1),
});

export const zJoinGame = z.object({
    nickname: z.string().min(1),
    color: z.string().optional(),
});

export const zRoll = z.object({
    playerId: z.string().min(1),
});

export const zEndTurn = z.object({
    playerId: z.string().min(1),
});

export const zRulesMutation = z.object({
    playerId: z.string().min(1),
    action: z.enum(['add', 'modify', 'remove']),
    rule: z.any().optional(),   // JSON du DSL (WHEN/IF/THEN) pour add/modify
    ruleId: z.string().optional() // pour modify/remove
});

export const zTileEdit = z.object({
    playerId: z.string().min(1),
    op: z.enum(['addTile','removeTile','link','unlink','tagArrival','updateTile']),
    data: z.any()
});
