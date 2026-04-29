export interface ApiRateLimitEnv {
  CI?: string;
  NODE_ENV?: string;
}

export function getApiRateLimit(env: ApiRateLimitEnv = process.env): number {
  if (env.CI === "true") {
    return 10000;
  }

  return env.NODE_ENV === "production" ? 120 : 1200;
}
