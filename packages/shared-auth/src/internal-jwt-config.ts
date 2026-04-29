type InternalJwtEnv = Partial<
  Record<"INTERNAL_JWT_AUDIENCE" | "INTERNAL_JWT_ISSUERS", string | undefined>
>;

export interface InternalJwtConfig {
  audience: string;
  issuer: [string, ...string[]];
}

export function getInternalJwtConfig(
  env: InternalJwtEnv = process.env,
): InternalJwtConfig {
  const audience = env.INTERNAL_JWT_AUDIENCE?.trim();
  if (!audience) {
    throw new Error("INTERNAL_JWT_AUDIENCE environment variable is required");
  }

  const issuers = env.INTERNAL_JWT_ISSUERS?.split(",")
    .map((issuer) => issuer.trim())
    .filter(Boolean);
  const [firstIssuer, ...additionalIssuers] = issuers ?? [];
  if (!firstIssuer) {
    throw new Error("INTERNAL_JWT_ISSUERS environment variable is required");
  }

  return {
    audience,
    issuer: [firstIssuer, ...additionalIssuers],
  };
}

export function validateInternalJwtConfig(
  serviceName: string,
  env: InternalJwtEnv = process.env,
): void {
  try {
    getInternalJwtConfig(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${serviceName}] ${message}`, { cause: err });
  }
}
