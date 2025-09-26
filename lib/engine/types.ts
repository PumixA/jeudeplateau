export type Trigger =
    | 'turn.start' | 'turn.afterRoll' | 'turn.afterMove' | 'turn.end'
    | 'on.enterTile' | 'on.leaveTile' | 'on.landOn'
    | 'on.resourceChange' | 'on.itemUse'
    | 'on.ruleAdded' | 'on.ruleModified' | 'on.ruleRemoved'
    | 'on.victoryCheck';

export type Condition = any;
export type Effect = { type: string; payload?: any };

export interface RuleDSL {
    id?: string;
    scope: string;
    trigger: Trigger;
    conditions?: Condition;
    effects: Effect[];
    priority?: number;
    specificity?: number;
    enabled?: boolean;
}

export interface ExecContext {
    gameId: string;
    turnId?: string;
    playerId?: string;
    pawnId?: string;
    tileId?: string;
    extra?: Record<string, unknown>;
}
