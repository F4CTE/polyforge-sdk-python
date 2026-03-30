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
exports.StrategyQueryDto = void 0;
const class_validator_1 = require("class-validator");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class StrategyQueryDto extends pagination_dto_1.PaginationDto {
    status;
    // R5-08: Allowlist for sort parameter to prevent arbitrary column access
    sort = "createdAt";
}
exports.StrategyQueryDto = StrategyQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["IDLE", "RUNNING", "PAUSED", "PAPER"]),
    __metadata("design:type", String)
], StrategyQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["createdAt", "updatedAt", "name", "status", "likeCount"]),
    __metadata("design:type", String)
], StrategyQueryDto.prototype, "sort", void 0);
//# sourceMappingURL=strategy-query.dto.js.map