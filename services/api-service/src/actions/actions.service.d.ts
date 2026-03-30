export interface ActionParameter {
    name: string;
    type: string;
    required: boolean;
    in?: "path" | "query" | "body";
    description?: string;
    enum?: string[];
    default?: any;
    max?: number;
    min?: number;
}
export interface ActionDefinition {
    name: string;
    description: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: string;
    scope: "READ" | "WRITE" | "TRADE";
    category: string;
    parameters?: ActionParameter[];
}
export interface ActionsSchema {
    version: string;
    actions: ActionDefinition[];
}
export declare class ActionsService {
    getActions(): ActionsSchema;
}
//# sourceMappingURL=actions.service.d.ts.map