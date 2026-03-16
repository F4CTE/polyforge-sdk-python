import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminJwtPayload } from '@polyforge/shared-types';

export const CurrentAdmin = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AdminJwtPayload => {
        const request = ctx.switchToHttp().getRequest();
        return request.admin;
    },
);

export const AdminIp = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest();
        return request.adminIp ?? 'unknown';
    },
);
