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
exports.PriceHistoryQueryDto = exports.MarketQueryDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class MarketQueryDto extends pagination_dto_1.PaginationDto {
    search;
    category;
    closed;
    sort = "volume";
}
exports.MarketQueryDto = MarketQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], MarketQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], MarketQueryDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === "true" || value === true),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarketQueryDto.prototype, "closed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["volume", "endDate", "firstSeenAt", "newest", "closing_soon", "liquidity"]),
    __metadata("design:type", String)
], MarketQueryDto.prototype, "sort", void 0);
class PriceHistoryQueryDto {
    resolution = "1h";
    from;
    to;
    limit = 200;
}
exports.PriceHistoryQueryDto = PriceHistoryQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["1m", "1h", "1d"]),
    __metadata("design:type", String)
], PriceHistoryQueryDto.prototype, "resolution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], PriceHistoryQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], PriceHistoryQueryDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], PriceHistoryQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=market-query.dto.js.map