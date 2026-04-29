export class PrismaClient {
  constructor(_options?: unknown) {}

  $connect(): Promise<void> {
    return Promise.resolve();
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }

  $on(): void {}
}
