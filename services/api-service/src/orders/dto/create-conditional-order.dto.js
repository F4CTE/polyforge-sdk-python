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
exports.CreateConditionalOrderDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateConditionalOrderDto {
    limitPrice;
    trailingPct;
    expiresAt;
}
exports.CreateConditionalOrderDto = CreateConditionalOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "marketId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "tokenId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(["TAKE_PROFIT", "STOP_LOSS", "TRAILING_STOP", "LIMIT", "PEGGED"]),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(["BUY", "SELL"]),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "side", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(["YES", "NO"]),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "outcome", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateConditionalOrderDto.prototype, "size", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.001),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], CreateConditionalOrderDto.prototype, "triggerPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "limitPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "trailingPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateConditionalOrderDto.prototype, "expiresAt", void 0);
//# sourceMappingURL=create-conditional-order.dto.js.map