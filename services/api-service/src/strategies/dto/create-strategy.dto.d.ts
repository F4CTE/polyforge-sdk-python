export declare class MarketSlotDto {
    slot: string;
    label?: string;
    defaultMarketId?: string;
}
export declare class StrategyVariableDto {
    id: string;
    name: string;
    expression: string;
}
export declare class BlockDto {
    id?: string;
    type: string;
    config?: Record<string, unknown>;
}
export declare class CreateStrategyDto {
    name: string;
    description?: string;
    visibility?: string;
    execMode?: string;
    tickMs?: number;
    triggers?: BlockDto[];
    conditions?: BlockDto[];
    actions?: BlockDto[];
    safety?: BlockDto[];
    tags?: string[];
    variables?: StrategyVariableDto[];
    logicBlocks?: BlockDto[];
    calcBlocks?: BlockDto[];
    canvas?: Record<string, unknown>;
    marketSlots?: MarketSlotDto[];
}
//# sourceMappingURL=create-strategy.dto.d.ts.map