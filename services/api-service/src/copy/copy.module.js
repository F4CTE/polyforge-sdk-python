"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const copy_controller_1 = require("./copy.controller");
const copy_service_1 = require("./copy.service");
const copy_engine_service_1 = require("./copy-engine.service");
let CopyModule = class CopyModule {
};
exports.CopyModule = CopyModule;
exports.CopyModule = CopyModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot()],
        controllers: [copy_controller_1.CopyController],
        providers: [copy_service_1.CopyService, copy_engine_service_1.CopyEngineService],
    })
], CopyModule);
//# sourceMappingURL=copy.module.js.map