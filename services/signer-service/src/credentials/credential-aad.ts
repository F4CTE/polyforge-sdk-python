export type UserCredentialField =
  | "privateKey"
  | "apiKey"
  | "apiSecret"
  | "apiPassphrase";

export type PolymarketUsCredentialField = "secretKey";

const USER_CREDENTIAL_AAD_PREFIX = "polyforge.signer-service.userCredential.v1";
const POLYMARKET_US_CREDENTIAL_AAD_PREFIX =
  "polyforge.signer-service.polymarketUsCredential.v1";

function aad(parts: string[]): Buffer {
  return Buffer.from(parts.join(":"), "utf8");
}

export function credentialDekAad(userId: string): Buffer {
  return aad([USER_CREDENTIAL_AAD_PREFIX, userId, "dek"]);
}

export function credentialFieldAad(
  userId: string,
  field: UserCredentialField,
): Buffer {
  return aad([USER_CREDENTIAL_AAD_PREFIX, userId, field]);
}

export function polymarketUsCredentialDekAad(userId: string): Buffer {
  return aad([POLYMARKET_US_CREDENTIAL_AAD_PREFIX, userId, "dek"]);
}

export function polymarketUsCredentialFieldAad(
  userId: string,
  field: PolymarketUsCredentialField,
): Buffer {
  return aad([POLYMARKET_US_CREDENTIAL_AAD_PREFIX, userId, field]);
}
