"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const AI_SUGGESTIONS = {
    STRATEGY_LIMIT_REACHED: "Delete unused strategies to make room",
    ALERT_LIMIT_REACHED: "Remove triggered or unnecessary alerts",
    NOT_CONNECTED: "Import Polymarket credentials in Settings > Trading Account",
    ALREADY_RUNNING: "Stop the strategy first, then start again",
    GEO_BLOCKED: "Trading is not available in your region",
    INSUFFICIENT_SCOPES: "Your API key needs additional scopes. Generate a new key with the required scope.",
    RATE_LIMITED: "Wait a moment and try again. Consider using the batch endpoint for multiple operations.",
    UNAUTHORIZED: "Provide a valid Bearer JWT in the Authorization header",
    FORBIDDEN: "You do not have permission to access this resource",
    NOT_FOUND: "The requested resource does not exist. Verify the ID and path.",
    VALIDATION_ERROR: "Check the request body against the schema at GET /api/v1/actions",
    CONFLICT: "The resource is in a conflicting state. Refresh and retry.",
};
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const reply = ctx.getResponse();
        const request = ctx.getRequest();
        const requestId = (0, crypto_1.randomUUID)();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        // R4-04: In production, mask error details for 500+ responses to prevent information leakage
        const isProduction = process.env.NODE_ENV === "production";
        const message = status >= 500 && isProduction
            ? "Internal server error"
            : exception instanceof common_1.HttpException
                ? (exception.getResponse().message ?? exception.message)
                : "Internal server error";
        const code = status >= 500 && isProduction
            ? "INTERNAL_SERVER_ERROR"
            : exception instanceof common_1.HttpException
                ? (exception.getResponse().code ??
                    exception.constructor.name.toUpperCase())
                : "INTERNAL_ERROR";
        if (status >= 500) {
            const errMsg = exception instanceof Error ? exception.message : String(exception);
            const errStack = exception instanceof Error ? exception.stack : '';
            this.logger.error(`[${requestId}] ${request.method} ${request.url} — ${errMsg}`);
            if (errStack && process.env.NODE_ENV !== 'production') {
                this.logger.error(errStack);
            }
        }
        const suggestion = AI_SUGGESTIONS[code] ?? undefined;
        reply.status(status).send({
            statusCode: status,
            code,
            message,
            ...(suggestion ? { suggestion } : {}),
            requestId,
        });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map