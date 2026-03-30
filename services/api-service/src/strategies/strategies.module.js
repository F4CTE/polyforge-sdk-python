"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategiesModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const strategies_controller_1 = require("./strategies.controller");
const strategies_service_1 = require("./strategies.service");
const internal_client_service_1 = require("../common/services/internal-client.service");
const llm_service_1 = require("../news/llm.service");
const events_module_1 = require("../gateway/events.module");
let StrategiesModule = class StrategiesModule {
};
exports.StrategiesModule = StrategiesModule;
exports.StrategiesModule = StrategiesModule = __decorate([
    (0, common_1.Module)({
        imports: [jwt_1.JwtModule.register({}), events_module_1.EventsModule],
        controllers: [strategies_controller_1.StrategiesController],
        providers: [strategies_service_1.StrategiesService, internal_client_service_1.InternalClientService, llm_service_1.LlmService],
        exports: [strategies_service_1.StrategiesService],
    })
], StrategiesModule);
//# sourceMappingURL=strategies.module.js.map