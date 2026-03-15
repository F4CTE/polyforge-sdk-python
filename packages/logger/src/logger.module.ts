import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
    imports: [
        PinoLoggerModule.forRoot({
            pinoHttp: {
                level: process.env.LOG_LEVEL ?? 'info',
                transport: process.env.NODE_ENV === 'development'
                    ? {
                        target: 'pino-pretty',
                        options: {
                            colorize: true,
                            singleLine: true,
                            translateTime: 'HH:MM:ss',
                        },
                    }
                    : undefined,
                redact: [
                    'req.headers.authorization',
                    'req.headers.cookie',
                    'req.body.password',
                    'req.body.privateKey',
                    'req.body.apiSecret',
                ],
            },
        }),
    ],
    exports: [PinoLoggerModule],
})
export class LoggerModule { }