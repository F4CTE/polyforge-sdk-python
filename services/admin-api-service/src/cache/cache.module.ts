import { Module } from '@nestjs/common';
import { CacheAdminService } from './cache.service';
import { CacheAdminController } from './cache.controller';

@Module({
    providers: [CacheAdminService],
    controllers: [CacheAdminController],
})
export class CacheAdminModule {}
