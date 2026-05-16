import { Module, RequestMethod } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      forRoutes: [{ path: "{*path}", method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        transport:
          process.env.NODE_ENV === "development"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: "HH:MM:ss",
                },
              }
            : undefined,
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          'req.headers["set-cookie"]',
          'res.headers["set-cookie"]',
          "req.body.password",
          "req.body.privateKey",
          "req.body.apiSecret",
          "req.body.apiKey",
          "req.body.apiPassphrase",
          "*.token",
          "*.accessToken",
          "*.refreshToken",
          "*.apiKey",
          "*.secret",
          "*.totpSecret",
          "*.backupCode",
          "*.signature",
          "*.email",
          "req.body.email",
          "*.walletAddress",
          "req.body.walletAddress",
          "*.mnemonic",
          "req.body.mnemonic",
        ],
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
