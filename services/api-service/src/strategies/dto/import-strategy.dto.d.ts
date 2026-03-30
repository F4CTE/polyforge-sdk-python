declare class ImportVariableDto {
    name: string;
    expression: string;
}
declare class ImportBlockDto {
    type: string;
    config?: Record<string, unknown>;
}
declare class ImportBlocksDto {
    safety?: ImportBlockDto[];
    triggers?: ImportBlockDto[];
    conditions?: ImportBlockDto[];
    actions?: ImportBlockDto[];
}
declare class ImportCanvasDto {
    positions?: Record<string, {
        x: number;
        y: number;
    }>;
    connections?: {
        from: string;
        to: string;
    }[];
}
declare class ImportStrategyPayloadDto {
    name: string;
    description?: string;
    execMode?: string;
    tickMs?: number;
    visibility?: string;
    tags?: string[];
    variables?: ImportVariableDto[];
    blocks?: ImportBlocksDto;
    canvas?: ImportCanvasDto;
}
export declare class ImportStrategyDto {
    polyforge: string;
    exportedAt?: string;
    strategy: ImportStrategyPayloadDto;
}
export {};
//# sourceMappingURL=import-strategy.dto.d.ts.map