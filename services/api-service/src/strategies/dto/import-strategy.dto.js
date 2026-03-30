"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportStrategyDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ImportVariableDto {
    name;
    expression;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    (0, class_validator_1.Matches)(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
        message: "Variable name must be a valid identifier",
    }),
    __metadata("design:type", String)
], ImportVariableDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], ImportVariableDto.prototype, "expression", void 0);
class ImportBlockDto {
    config;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ImportBlockDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ImportBlockDto.prototype, "config", void 0);
class ImportBlocksDto {
    safety;
    triggers;
    conditions;
    actions;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImportBlockDto),
    __metadata("design:type", Array)
], ImportBlocksDto.prototype, "safety", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImportBlockDto),
    __metadata("design:type", Array)
], ImportBlocksDto.prototype, "triggers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImportBlockDto),
    __metadata("design:type", Array)
], ImportBlocksDto.prototype, "conditions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImportBlockDto),
    __metadata("design:type", Array)
], ImportBlocksDto.prototype, "actions", void 0);
class ImportCanvasDto {
    positions;
    connections;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ImportCanvasDto.prototype, "positions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ImportCanvasDto.prototype, "connections", void 0);
class ImportStrategyPayloadDto {
    name;
    description;
    execMode;
    tickMs;
    visibility;
    tags;
    variables;
    blocks;
    canvas;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ImportStrategyPayloadDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ImportStrategyPayloadDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["TICK", "EVENT", "HYBRID"]),
    __metadata("design:type", String)
], ImportStrategyPayloadDto.prototype, "execMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(200),
    (0, class_validator_1.Max)(60000),
    __metadata("design:type", Number)
], ImportStrategyPayloadDto.prototype, "tickMs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["PRIVATE", "PUBLIC", "UNLISTED"]),
    __metadata("design:type", String)
], ImportStrategyPayloadDto.prototype, "visibility", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(50, { each: true }),
    __metadata("design:type", Array)
], ImportStrategyPayloadDto.prototype, "tags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImportVariableDto),
    __metadata("design:type", Array)
], ImportStrategyPayloadDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ImportBlocksDto),
    __metadata("design:type", ImportBlocksDto)
], ImportStrategyPayloadDto.prototype, "blocks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ImportCanvasDto),
    __metadata("design:type", ImportCanvasDto)
], ImportStrategyPayloadDto.prototype, "canvas", void 0);
class ImportStrategyDto {
    polyforge;
    exportedAt;
    strategy;
}
exports.ImportStrategyDto = ImportStrategyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportStrategyDto.prototype, "polyforge", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportStrategyDto.prototype, "exportedAt", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ImportStrategyPayloadDto),
    __metadata("design:type", ImportStrategyPayloadDto)
], ImportStrategyDto.prototype, "strategy", void 0);
//# sourceMappingURL=import-strategy.dto.js.map