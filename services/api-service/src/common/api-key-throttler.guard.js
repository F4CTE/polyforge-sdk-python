"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyThrottlerGuard = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
let ApiKeyThrottlerGuard = class ApiKeyThrottlerGuard extends throttler_1.ThrottlerGuard {
    async getTracker(req) {
        // For API key requests, track by key ID
        if (req.apiKeyMeta?.keyId) {
            return `apikey:${req.apiKeyMeta.keyId}`;
        }
        // For authenticated users, track by user ID (each user gets their own bucket)
        if (req.user?.sub) {
            return `user:${req.user.sub}`;
        }
        // Fallback to IP for unauthenticated requests
        return req.ip;
    }
};
exports.ApiKeyThrottlerGuard = ApiKeyThrottlerGuard;
exports.ApiKeyThrottlerGuard = ApiKeyThrottlerGuard = __decorate([
    (0, common_1.Injectable)()
], ApiKeyThrottlerGuard);
//# sourceMappingURL=api-key-throttler.guard.js.map