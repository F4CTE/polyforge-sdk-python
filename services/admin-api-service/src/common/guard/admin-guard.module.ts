import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminJwtGuard } from './admin-jwt.guard';

@Global()
@Module({
    imports: [JwtModule.register({})],
    providers: [AdminJwtGuard],
    exports: [AdminJwtGuard],
})
export class AdminGuardModule {}
