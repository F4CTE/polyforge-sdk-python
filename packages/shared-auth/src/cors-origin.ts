export type CorsOriginCallback = (
  error: Error | null,
  allowed: boolean,
) => void;

export interface CorsOriginDelegateOptions {
  configuredOrigins?: string;
  includeDevOrigins: boolean;
  devOrigins?: readonly string[];
}

const DEFAULT_DEV_ORIGINS = [
  "http://localhost",
  "http://localhost:4200",
  "http://localhost:5173",
  "http://127.0.0.1",
] as const;

export function getAllowedCorsOrigins({
  configuredOrigins,
  includeDevOrigins,
  devOrigins = DEFAULT_DEV_ORIGINS,
}: CorsOriginDelegateOptions): string[] {
  const origins =
    configuredOrigins
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return includeDevOrigins ? [...origins, ...devOrigins] : origins;
}

export function createCorsOriginDelegate(
  options: CorsOriginDelegateOptions,
): (origin: string | undefined, callback: CorsOriginCallback) => void {
  return (origin, callback) => {
    const allowed = getAllowedCorsOrigins(options);

    if (!origin) {
      callback(null, false);
    } else if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS: origin not allowed"), false);
    }
  };
}
