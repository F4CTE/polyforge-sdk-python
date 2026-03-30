"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const news_controller_1 = require("./news.controller");
const news_service_1 = require("./news.service");
const news_ingestion_service_1 = require("./news-ingestion.service");
const llm_service_1 = require("./llm.service");
const signal_generator_service_1 = require("./signal-generator.service");
let NewsModule = class NewsModule {
};
exports.NewsModule = NewsModule;
exports.NewsModule = NewsModule = __decorate([
    (0, common_1.Module)({
        imports: [schedule_1.ScheduleModule.forRoot()],
        controllers: [news_controller_1.NewsController],
        providers: [
            news_service_1.NewsService,
            news_ingestion_service_1.NewsIngestionService,
            llm_service_1.LlmService,
            signal_generator_service_1.SignalGeneratorService,
        ],
    })
], NewsModule);
//# sourceMappingURL=news.module.js.map