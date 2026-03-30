import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
/**
 * Issues short-lived internal JWTs and calls downstream NestJS services.
 */
export declare class InternalClientService {
    private readonly config;
    private readonly jwt;
    private readonly logger;
    private readonly secret;
    constructor(config: ConfigService, jwt: JwtService);
    private issueToken;
    post(baseUrl: string, audience: string, path: string): Promise<Response>;
    delete(baseUrl: string, audience: string, path: string): Promise<Response>;
    get(baseUrl: string, audience: string, path: string): Promise<Response>;
}
//# sourceMappingURL=internal-client.service.d.ts.map