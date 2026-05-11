import { describe, expect, it, vi } from "vitest";
import { EncryptionService } from "./encryption.service";
import { KekRotationService } from "./kek-rotation.service";
import {
  credentialDekAad,
  credentialFieldAad,
  polymarketUsCredentialDekAad,
  polymarketUsCredentialFieldAad,
} from "../credentials/credential-aad";

const TEST_KEK = "a".repeat(64);
const TEST_KEK_V2 = "b".repeat(64);

function makeEncryption(opts: {
  kek: string;
  kekPrevious?: string;
  kekVersion: string;
}): EncryptionService {
  const config = {
    get: (key: string) => {
      if (key === "MASTER_ENCRYPTION_KEY") return opts.kek;
      if (key === "MASTER_ENCRYPTION_KEY_PREVIOUS") return opts.kekPrevious;
      if (key === "MASTER_ENCRYPTION_KEY_VERSION") return opts.kekVersion;
      return undefined;
    },
  } as any;
  return new EncryptionService(config);
}

function makePrisma(opts: {
  userRows?: Record<string, unknown>[];
  polymarketUsRows?: Record<string, unknown>[];
}) {
  const userRows = [...(opts.userRows ?? [])];
  const polymarketUsRows = [...(opts.polymarketUsRows ?? [])];

  return {
    userCredential: {
      findMany: vi.fn(async () => userRows.splice(0, userRows.length)),
      update: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => data,
      ),
      count: vi.fn(async () => userRows.length),
    },
    polymarketUsCredential: {
      findMany: vi.fn(async () =>
        polymarketUsRows.splice(0, polymarketUsRows.length),
      ),
      update: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => data,
      ),
      count: vi.fn(async () => polymarketUsRows.length),
    },
  } as any;
}

function makeLegacyUserCredentialRow(
  encryption: EncryptionService,
  userId: string,
) {
  const { dek, encryptedDek, dekIv, kekVersion } = encryption.generateDek();
  try {
    const privateKey = encryption.encryptField("0x" + "f".repeat(64), dek);
    const apiKey = encryption.encryptField("api-key", dek);
    const apiSecret = encryption.encryptField("api-secret", dek);
    const apiPassphrase = encryption.encryptField("api-passphrase", dek);

    return {
      userId,
      encryptedDek,
      dekIv,
      kekVersion,
      privateKeyCt: privateKey.ciphertext,
      privateKeyIv: privateKey.iv,
      privateKeyTag: privateKey.tag,
      apiKeyCt: apiKey.ciphertext,
      apiKeyIv: apiKey.iv,
      apiKeyTag: apiKey.tag,
      apiSecretCt: apiSecret.ciphertext,
      apiSecretIv: apiSecret.iv,
      apiSecretTag: apiSecret.tag,
      apiPassphraseCt: apiPassphrase.ciphertext,
      apiPassphraseIv: apiPassphrase.iv,
      apiPassphraseTag: apiPassphrase.tag,
    };
  } finally {
    dek.fill(0);
  }
}

function makeAadBoundUserCredentialRow(
  encryption: EncryptionService,
  userId: string,
) {
  const { dek, encryptedDek, dekIv, kekVersion } = encryption.generateDek({
    aad: credentialDekAad(userId),
  });
  try {
    const privateKey = encryption.encryptField("0x" + "f".repeat(64), dek, {
      aad: credentialFieldAad(userId, "privateKey"),
    });
    const apiKey = encryption.encryptField("api-key", dek, {
      aad: credentialFieldAad(userId, "apiKey"),
    });
    const apiSecret = encryption.encryptField("api-secret", dek, {
      aad: credentialFieldAad(userId, "apiSecret"),
    });
    const apiPassphrase = encryption.encryptField("api-passphrase", dek, {
      aad: credentialFieldAad(userId, "apiPassphrase"),
    });

    return {
      userId,
      encryptedDek,
      dekIv,
      kekVersion,
      privateKeyCt: privateKey.ciphertext,
      privateKeyIv: privateKey.iv,
      privateKeyTag: privateKey.tag,
      apiKeyCt: apiKey.ciphertext,
      apiKeyIv: apiKey.iv,
      apiKeyTag: apiKey.tag,
      apiSecretCt: apiSecret.ciphertext,
      apiSecretIv: apiSecret.iv,
      apiSecretTag: apiSecret.tag,
      apiPassphraseCt: apiPassphrase.ciphertext,
      apiPassphraseIv: apiPassphrase.iv,
      apiPassphraseTag: apiPassphrase.tag,
    };
  } finally {
    dek.fill(0);
  }
}

function makeAadDekLegacyFieldUserCredentialRow(
  encryption: EncryptionService,
  userId: string,
) {
  const row = makeLegacyUserCredentialRow(encryption, userId);
  const legacyDek = encryption.decryptDek(
    row.encryptedDek,
    row.dekIv,
    row.kekVersion,
  );
  try {
    const wrapped = encryption.wrapDek(legacyDek, {
      aad: credentialDekAad(userId),
    });
    return {
      ...row,
      encryptedDek: wrapped.encryptedDek,
      dekIv: wrapped.dekIv,
      kekVersion: wrapped.kekVersion,
    };
  } finally {
    legacyDek.fill(0);
  }
}

function makeLegacyPolymarketUsCredentialRow(
  encryption: EncryptionService,
  userId: string,
) {
  const { dek, encryptedDek, dekIv, kekVersion } = encryption.generateDek();
  try {
    const secretKey = encryption.encryptFieldBytes(Buffer.alloc(32, 0xab), dek);

    return {
      userId,
      encryptedDek,
      dekIv,
      kekVersion,
      secretKeyCt: secretKey.ciphertext,
      secretKeyIv: secretKey.iv,
      secretKeyTag: secretKey.tag,
    };
  } finally {
    dek.fill(0);
  }
}

function makeAadBoundPolymarketUsCredentialRow(
  encryption: EncryptionService,
  userId: string,
) {
  const { dek, encryptedDek, dekIv, kekVersion } = encryption.generateDek({
    aad: polymarketUsCredentialDekAad(userId),
  });
  try {
    const secretKey = encryption.encryptFieldBytes(
      Buffer.alloc(32, 0xab),
      dek,
      {
        aad: polymarketUsCredentialFieldAad(userId, "secretKey"),
      },
    );

    return {
      userId,
      encryptedDek,
      dekIv,
      kekVersion,
      secretKeyCt: secretKey.ciphertext,
      secretKeyIv: secretKey.iv,
      secretKeyTag: secretKey.tag,
    };
  } finally {
    dek.fill(0);
  }
}

describe("KekRotationService", () => {
  it("rotates AAD-bound user credential rows to the current KEK", async () => {
    const svcV1 = makeEncryption({ kek: TEST_KEK, kekVersion: "1" });
    const row = makeAadBoundUserCredentialRow(svcV1, "user-1");
    const svcV2 = makeEncryption({
      kek: TEST_KEK_V2,
      kekPrevious: TEST_KEK,
      kekVersion: "2",
    });
    const prisma = makePrisma({ userRows: [row] });
    const rotation = new KekRotationService(prisma, svcV2);

    await expect(rotation.rotateAll()).resolves.toMatchObject({
      total: 1,
      rotated: 1,
      failed: 0,
      legacy: 0,
    });

    const update = prisma.userCredential.update.mock.calls[0][0].data;
    const dek = svcV2.decryptDek(update.encryptedDek, update.dekIv, 2, {
      aad: credentialDekAad("user-1"),
    });
    expect(
      svcV2
        .decryptField(
          update.privateKeyCt,
          update.privateKeyIv,
          update.privateKeyTag,
          dek,
          {
            aad: credentialFieldAad("user-1", "privateKey"),
          },
        )
        .toString("utf8"),
    ).toBe("0x" + "f".repeat(64));
    expect(() =>
      svcV2.decryptDek(update.encryptedDek, update.dekIv, 2),
    ).toThrow();

    const swapped = {
      ...update,
      privateKeyCt: update.apiKeyCt,
      privateKeyIv: update.apiKeyIv,
      privateKeyTag: update.apiKeyTag,
    };
    expect(() =>
      svcV2.decryptField(
        swapped.privateKeyCt,
        swapped.privateKeyIv,
        swapped.privateKeyTag,
        dek,
        { aad: credentialFieldAad("user-1", "privateKey") },
      ),
    ).toThrow();
  });

  it("does not launder legacy no-AAD user field tuple swaps during rotation", async () => {
    const svcV1 = makeEncryption({ kek: TEST_KEK, kekVersion: "1" });
    const row = makeAadDekLegacyFieldUserCredentialRow(svcV1, "user-legacy");
    const privateKeyTuple = {
      ct: row.privateKeyCt,
      iv: row.privateKeyIv,
      tag: row.privateKeyTag,
    };
    row.privateKeyCt = row.apiKeyCt;
    row.privateKeyIv = row.apiKeyIv;
    row.privateKeyTag = row.apiKeyTag;
    row.apiKeyCt = privateKeyTuple.ct;
    row.apiKeyIv = privateKeyTuple.iv;
    row.apiKeyTag = privateKeyTuple.tag;

    const svcV2 = makeEncryption({
      kek: TEST_KEK_V2,
      kekPrevious: TEST_KEK,
      kekVersion: "2",
    });
    const prisma = makePrisma({ userRows: [row] });
    const rotation = new KekRotationService(prisma, svcV2);

    await expect(rotation.rotateAll()).resolves.toMatchObject({
      total: 1,
      rotated: 0,
      failed: 0,
      legacy: 1,
    });
    expect(prisma.userCredential.update).not.toHaveBeenCalled();
  });

  it("rotates Polymarket US credentials with row and secretKey AAD", async () => {
    const svcV1 = makeEncryption({ kek: TEST_KEK, kekVersion: "1" });
    const row = makeAadBoundPolymarketUsCredentialRow(svcV1, "user-us");
    const svcV2 = makeEncryption({
      kek: TEST_KEK_V2,
      kekPrevious: TEST_KEK,
      kekVersion: "2",
    });
    const prisma = makePrisma({ polymarketUsRows: [row] });
    const rotation = new KekRotationService(prisma, svcV2);

    await expect(rotation.rotateAll()).resolves.toMatchObject({
      total: 1,
      rotated: 1,
      failed: 0,
      legacy: 0,
    });

    const update = prisma.polymarketUsCredential.update.mock.calls[0][0].data;
    const dek = svcV2.decryptDek(update.encryptedDek, update.dekIv, 2, {
      aad: polymarketUsCredentialDekAad("user-us"),
    });
    expect(
      svcV2.decryptFieldBytes(
        update.secretKeyCt,
        update.secretKeyIv,
        update.secretKeyTag,
        dek,
        { aad: polymarketUsCredentialFieldAad("user-us", "secretKey") },
      ),
    ).toEqual(Buffer.alloc(32, 0xab));
    expect(() =>
      svcV2.decryptFieldBytes(
        update.secretKeyCt,
        update.secretKeyIv,
        update.secretKeyTag,
        dek,
        { aad: polymarketUsCredentialFieldAad("other-user", "secretKey") },
      ),
    ).toThrow();
  });

  it("detects legacy no-AAD user credential rows already on the current KEK version", async () => {
    const svcV2 = makeEncryption({
      kek: TEST_KEK_V2,
      kekPrevious: TEST_KEK,
      kekVersion: "2",
    });

    // Simulate a pre-AAD row imported under the current KEK:
    // generateDek without AAD → kekVersion=2, no row/field binding.
    const { dek, encryptedDek, dekIv, kekVersion } =
      svcV2.generateDek();
    try {
      const privateKey = svcV2.encryptField(
        "0x" + "f".repeat(64),
        dek,
      );
      const apiKey = svcV2.encryptField("api-key", dek);
      const apiSecret = svcV2.encryptField("api-secret", dek);
      const apiPassphrase = svcV2.encryptField("api-passphrase", dek);

      const row = {
        userId: "user-legacy-current",
        encryptedDek,
        dekIv,
        kekVersion,
        privateKeyCt: privateKey.ciphertext,
        privateKeyIv: privateKey.iv,
        privateKeyTag: privateKey.tag,
        apiKeyCt: apiKey.ciphertext,
        apiKeyIv: apiKey.iv,
        apiKeyTag: apiKey.tag,
        apiSecretCt: apiSecret.ciphertext,
        apiSecretIv: apiSecret.iv,
        apiSecretTag: apiSecret.tag,
        apiPassphraseCt: apiPassphrase.ciphertext,
        apiPassphraseIv: apiPassphrase.iv,
        apiPassphraseTag: apiPassphrase.tag,
      };

      const prisma = makePrisma({ userRows: [row] });
      const rotation = new KekRotationService(prisma, svcV2);

      await expect(rotation.rotateAll()).resolves.toMatchObject({
        total: 1,
        rotated: 0,
        failed: 0,
        legacy: 1,
      });
      expect(prisma.userCredential.update).not.toHaveBeenCalled();
    } finally {
      dek.fill(0);
    }
  });

  it("detects legacy no-AAD Polymarket US rows already on the current KEK version", async () => {
    const svcV2 = makeEncryption({
      kek: TEST_KEK_V2,
      kekPrevious: TEST_KEK,
      kekVersion: "2",
    });

    const { dek, encryptedDek, dekIv, kekVersion } =
      svcV2.generateDek();
    try {
      const secretKey = svcV2.encryptFieldBytes(
        Buffer.alloc(32, 0xab),
        dek,
      );

      const row = {
        userId: "user-us-legacy-current",
        encryptedDek,
        dekIv,
        kekVersion,
        secretKeyCt: secretKey.ciphertext,
        secretKeyIv: secretKey.iv,
        secretKeyTag: secretKey.tag,
      };

      const prisma = makePrisma({ polymarketUsRows: [row] });
      const rotation = new KekRotationService(prisma, svcV2);

      await expect(rotation.rotateAll()).resolves.toMatchObject({
        total: 1,
        rotated: 0,
        failed: 0,
        legacy: 1,
      });
      expect(prisma.polymarketUsCredential.update).not.toHaveBeenCalled();
    } finally {
      dek.fill(0);
    }
  });

  it("does not rotate legacy no-AAD Polymarket US credentials into AAD-bound rows", async () => {
    const svcV1 = makeEncryption({ kek: TEST_KEK, kekVersion: "1" });
    const row = makeLegacyPolymarketUsCredentialRow(svcV1, "user-us-legacy");
    const svcV2 = makeEncryption({
      kek: TEST_KEK_V2,
      kekPrevious: TEST_KEK,
      kekVersion: "2",
    });
    const prisma = makePrisma({ polymarketUsRows: [row] });
    const rotation = new KekRotationService(prisma, svcV2);

    await expect(rotation.rotateAll()).resolves.toMatchObject({
      total: 1,
      rotated: 0,
      failed: 0,
      legacy: 1,
    });
    expect(prisma.polymarketUsCredential.update).not.toHaveBeenCalled();
  });

  describe("getPendingCount", () => {
    it("includes same-version user credential legacy rows that fail AAD decrypt", async () => {
      const svcV2 = makeEncryption({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });

      const legacyRowData = makeLegacyUserCredentialRow(svcV2, "user-legacy-same-v");
      const prisma = {
        userCredential: {
          findMany: vi.fn(async () => [legacyRowData]),
          update: vi.fn(),
          count: vi.fn(async () => 0),
        },
        polymarketUsCredential: {
          findMany: vi.fn(async () => []),
          update: vi.fn(),
          count: vi.fn(async () => 0),
        },
      } as any;
      const rotation = new KekRotationService(prisma, svcV2);

      const pending = await rotation.getPendingCount();
      expect(pending).toBe(1);
    });

    it("includes same-version Polymarket US legacy rows that fail AAD decrypt", async () => {
      const svcV2 = makeEncryption({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });

      const legacyRowData = makeLegacyPolymarketUsCredentialRow(
        svcV2,
        "user-us-legacy-same-v",
      );
      const prisma = {
        userCredential: {
          findMany: vi.fn(async () => []),
          update: vi.fn(),
          count: vi.fn(async () => 0),
        },
        polymarketUsCredential: {
          findMany: vi.fn(async () => [legacyRowData]),
          update: vi.fn(),
          count: vi.fn(async () => 0),
        },
      } as any;
      const rotation = new KekRotationService(prisma, svcV2);

      const pending = await rotation.getPendingCount();
      expect(pending).toBe(1);
    });

    it("counts version-mismatch rows via count query plus same-version legacy via scan", async () => {
      const svcV1 = makeEncryption({ kek: TEST_KEK, kekVersion: "1" });
      const svcV2 = makeEncryption({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });

      // One row on old KEK version (counted by COUNT query)
      const oldVersionRow = makeLegacyUserCredentialRow(svcV1, "user-old-v");
      const pmOldRow = makeLegacyPolymarketUsCredentialRow(svcV1, "user-pm-old-v");

      // One row on current KEK version but legacy (no AAD) — found by scan
      const sameVersionLegacyRow = makeLegacyUserCredentialRow(
        svcV2,
        "user-same-v-legacy",
      );

      const prisma = {
        userCredential: {
          findMany: vi.fn(async () => [sameVersionLegacyRow]),
          update: vi.fn(),
          count: vi.fn(async () => 1),
        },
        polymarketUsCredential: {
          findMany: vi.fn(async () => []),
          update: vi.fn(),
          count: vi.fn(async () => 1),
        },
      } as any;
      const rotation = new KekRotationService(prisma, svcV2);

      const pending = await rotation.getPendingCount();
      expect(pending).toBe(3);
    });

    it("excludes AAD-bound same-version rows from pending count", async () => {
      const svcV2 = makeEncryption({
        kek: TEST_KEK_V2,
        kekPrevious: TEST_KEK,
        kekVersion: "2",
      });

      // A row that is properly AAD-bound on the current KEK version
      const aadRow = makeAadBoundUserCredentialRow(svcV2, "user-aad-ok");

      const prisma = {
        userCredential: {
          findMany: vi.fn(async () => [aadRow]),
          update: vi.fn(),
          count: vi.fn(async () => 0),
        },
        polymarketUsCredential: {
          findMany: vi.fn(async () => []),
          update: vi.fn(),
          count: vi.fn(async () => 0),
        },
      } as any;
      const rotation = new KekRotationService(prisma, svcV2);

      const pending = await rotation.getPendingCount();
      expect(pending).toBe(0);
    });
  });
});
