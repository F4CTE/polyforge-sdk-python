import { ThrottlerGuard } from "@nestjs/throttler";
export declare class ApiKeyThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: Record<string, any>): Promise<string>;
}
//# sourceMappingURL=api-key-throttler.guard.d.ts.map