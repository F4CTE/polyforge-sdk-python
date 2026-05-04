/**
 * Fails startup when SES is selected but its SMTP credentials are absent.
 */
export function validateSesSmtpConfig(
  serviceName: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.EMAIL_DRIVER !== "ses") return;

  const missing = [
    "AWS_SES_REGION",
    "AWS_SES_FROM_EMAIL",
    "AWS_SES_SMTP_USER",
    "AWS_SES_SMTP_PASSWORD",
  ].filter((key) => !env[key]);

  if (missing.length) {
    throw new Error(
      `[${serviceName}] Missing required SES env vars when EMAIL_DRIVER=ses: ${missing.join(", ")}`,
    );
  }
}
