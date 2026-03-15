import { Module } from '@nestjs/common';
import { ClobController } from './clob.controller';

@Module({ controllers: [ClobController] })
export class ClobModule {}
