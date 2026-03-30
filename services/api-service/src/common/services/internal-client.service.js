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
var InternalClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalClientService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
/**
 * Issues short-lived internal JWTs and calls downstream NestJS services.
 */
let InternalClientService = InternalClientService_1 = class InternalClientService {
    config;
    jwt;
    logger = new common_1.Logger(InternalClientService_1.name);
    secret;
    constructor(config, jwt) {
        this.config = config;
        this.jwt = jwt;
        this.secret = this.config.getOrThrow("INTERNAL_JWT_SECRET");
    }
    issueToken(audience) {
        return this.jwt.sign({ sub: "api-service", jti: (0, crypto_1.randomUUID)() }, { secret: this.secret, audience, expiresIn: "30s" });
    }
    async post(baseUrl, audience, path) {
        const token = this.issueToken(audience);
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        });
        return res;
    }
    async delete(baseUrl, audience, path) {
        const token = this.issueToken(audience);
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        });
        return res;
    }
    async get(baseUrl, audience, path) {
        const token = this.issueToken(audience);
        const url = `${baseUrl}${path}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        });
        return res;
    }
};
exports.InternalClientService = InternalClientService;
exports.InternalClientService = InternalClientService = InternalClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        jwt_1.JwtService])
], InternalClientService);
//# sourceMappingURL=internal-client.service.js.map