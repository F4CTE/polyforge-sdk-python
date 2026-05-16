import { describe, it, expect } from "vitest";
import {
  checksumEthereumAddress,
  tryChecksumEthereumAddress,
} from "./wallet-address";

const LOWER_ADDRESS = "0x52908400098527886e0f7030069857d2e4169ee7";
// Pre-computed EIP-55 checksum for the lowercased address above
const EXPECTED_CHECKSUM = "0x52908400098527886E0F7030069857D2E4169EE7";

describe("checksumEthereumAddress", () => {
  it("accepts all-lowercase address and returns EIP-55 checksummed form", async () => {
    const result = await checksumEthereumAddress(LOWER_ADDRESS);
    expect(result).toBe(EXPECTED_CHECKSUM);
    expect(result).not.toBe(LOWER_ADDRESS);
  });

  it("accepts all-uppercase address and returns EIP-55 checksummed form", async () => {
    const upper = "0x" + LOWER_ADDRESS.slice(2).toUpperCase();
    const result = await checksumEthereumAddress(upper);
    expect(result).toBe(EXPECTED_CHECKSUM);
  });

  it("accepts correctly checksummed mixed-case address unchanged", async () => {
    const result = await checksumEthereumAddress(EXPECTED_CHECKSUM);
    expect(result).toBe(EXPECTED_CHECKSUM);
  });

  it("rejects mixed-case address with invalid checksum", async () => {
    const badChecksum = LOWER_ADDRESS.replace(
      "e0f7030069857d2e4169ee7",
      "E0f7030069857d2e4169ee7",
    );
    await expect(
      checksumEthereumAddress(badChecksum),
    ).rejects.toThrow("Invalid Ethereum address checksum");
  });

  it("rejects address with wrong length", async () => {
    await expect(
      checksumEthereumAddress("0x52908400098527886e0f7030069857d2e4169ee"),
    ).rejects.toThrow("Invalid Ethereum address");
  });

  it("rejects address without 0x prefix", async () => {
    await expect(
      checksumEthereumAddress("52908400098527886E0F7030069857D2E4169EE7"),
    ).rejects.toThrow("Invalid Ethereum address");
  });

  it("rejects address with non-hex characters", async () => {
    await expect(
      checksumEthereumAddress("0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"),
    ).rejects.toThrow("Invalid Ethereum address");
  });

  it("returns EIP-55 form for another known address", async () => {
    const lower = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359";
    const result = await checksumEthereumAddress(lower);
    expect(result).toBe("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
  });
});

describe("tryChecksumEthereumAddress", () => {
  it("returns normalized address for valid lowercase input", async () => {
    const result = await tryChecksumEthereumAddress(LOWER_ADDRESS);
    expect(result).toBe(EXPECTED_CHECKSUM);
  });

  it("returns null for invalid checksum address", async () => {
    const badChecksum = LOWER_ADDRESS.replace(
      "e0f7030069857d2e4169ee7",
      "E0f7030069857d2e4169ee7",
    );
    const result = await tryChecksumEthereumAddress(badChecksum);
    expect(result).toBeNull();
  });

  it("returns null for invalid format", async () => {
    const result = await tryChecksumEthereumAddress("not-an-address");
    expect(result).toBeNull();
  });

  it("returns null for empty string", async () => {
    const result = await tryChecksumEthereumAddress("");
    expect(result).toBeNull();
  });
});
