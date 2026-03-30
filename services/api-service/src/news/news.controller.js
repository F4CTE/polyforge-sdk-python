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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const shared_auth_1 = require("@polyforge/shared-auth");
const news_service_1 = require("./news.service");
const news_query_dto_1 = require("./dto/news-query.dto");
let NewsController = class NewsController {
    news;
    constructor(news) {
        this.news = news;
    }
    getArticles(query) {
        return this.news.getArticles(query);
    }
    getSignals(query) {
        return this.news.getSignals(query);
    }
    getArticleById(id) {
        return this.news.getArticleById(id);
    }
};
exports.NewsController = NewsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [news_query_dto_1.NewsArticleQueryDto]),
    __metadata("design:returntype", void 0)
], NewsController.prototype, "getArticles", null);
__decorate([
    (0, common_1.Get)("signals"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [news_query_dto_1.NewsSignalQueryDto]),
    __metadata("design:returntype", void 0)
], NewsController.prototype, "getSignals", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NewsController.prototype, "getArticleById", null);
exports.NewsController = NewsController = __decorate([
    (0, swagger_1.ApiTags)("news"),
    (0, swagger_1.ApiBearerAuth)("jwt"),
    (0, common_1.Controller)("news"),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    __metadata("design:paramtypes", [news_service_1.NewsService])
], NewsController);
//# sourceMappingURL=news.controller.js.map