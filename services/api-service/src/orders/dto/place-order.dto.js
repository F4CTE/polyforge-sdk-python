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
exports.PlaceOrderDto = exports.OrderTypeDto = exports.OrderOutcomeDto = exports.OrderSideDto = void 0;
const class_validator_1 = require("class-validator");
var OrderSideDto;
(function (OrderSideDto) {
    OrderSideDto["BUY"] = "BUY";
    OrderSideDto["SELL"] = "SELL";
})(OrderSideDto || (exports.OrderSideDto = OrderSideDto = {}));
var OrderOutcomeDto;
(function (OrderOutcomeDto) {
    OrderOutcomeDto["YES"] = "YES";
    OrderOutcomeDto["NO"] = "NO";
})(OrderOutcomeDto || (exports.OrderOutcomeDto = OrderOutcomeDto = {}));
var OrderTypeDto;
(function (OrderTypeDto) {
    OrderTypeDto["GTC"] = "GTC";
    OrderTypeDto["FOK"] = "FOK";
    OrderTypeDto["GTD"] = "GTD";
})(OrderTypeDto || (exports.OrderTypeDto = OrderTypeDto = {}));
class PlaceOrderDto {
    tokenId;
    side;
    outcome;
    size;
    price;
    orderType = OrderTypeDto.GTC;
}
exports.PlaceOrderDto = PlaceOrderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlaceOrderDto.prototype, "tokenId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(OrderSideDto),
    __metadata("design:type", String)
], PlaceOrderDto.prototype, "side", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(OrderOutcomeDto),
    __metadata("design:type", String)
], PlaceOrderDto.prototype, "outcome", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PlaceOrderDto.prototype, "size", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.001),
    (0, class_validator_1.Max)(0.999),
    __metadata("design:type", Number)
], PlaceOrderDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(OrderTypeDto),
    __metadata("design:type", String)
], PlaceOrderDto.prototype, "orderType", void 0);
//# sourceMappingURL=place-order.dto.js.map