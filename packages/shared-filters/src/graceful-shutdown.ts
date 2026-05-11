import type { INestApplication, LoggerService } from "@nestjs/common";

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  signal?: NodeJS.Signals;
};

export function bootstrapGracefulShutdown(
  app: Pick<INestApplication, "enableShutdownHooks" | "close">,
  logger: Pick<LoggerService, "log" | "warn" | "error">,
  options: GracefulShutdownOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const signal = options.signal ?? "SIGTERM";

  app.enableShutdownHooks();
  process.once(signal, () => {
    void (async () => {
      logger.log(`${signal} received, starting graceful shutdown...`);
      const forceTimeout = setTimeout(() => {
        logger.warn("Graceful shutdown timed out, forcing exit");
        process.exit(1);
      }, timeoutMs);

      try {
        await app.close();
        clearTimeout(forceTimeout);
        process.exit(0);
      } catch (err) {
        clearTimeout(forceTimeout);
        logger.error(
          "Graceful shutdown failed",
          err instanceof Error ? err.stack : String(err),
        );
        process.exit(1);
      }
    })();
  });
}
