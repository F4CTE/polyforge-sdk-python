"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const schedule_1 = require("@nestjs/schedule");
const orders_controller_1 = require("./orders.controller");
const orders_service_1 = require("./orders.service");
const conditional_controller_1 = require("./conditional.controller");
const conditional_evaluator_service_1 = require("./conditional-evaluator.service");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot(), jwt_1.JwtModule.register({})],
        controllers: [orders_controller_1.OrdersController, conditional_controller_1.ConditionalController],
        providers: [orders_service_1.OrdersService, conditional_evaluator_service_1.ConditionalEvaluatorService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map