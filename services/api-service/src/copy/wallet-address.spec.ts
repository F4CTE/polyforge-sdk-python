import { describe, it, expect } from "vitest";
import {
  checksumEthereumAddress,
  tryChecksumEthereumAddress,
} from "./wallet-address";

const LOWER_ADDRESS = "0x52908400098527886e0f7030069857d2e4169ee7";
const EXPECTED_CHECKSUM = checksumEthereumAddress(LOWER_ADDRESS);

describe("checksumEthereumAddress", () => {
  it("accepts all-lowercase address and returns EIP-55 checksummed form", () => {
    const result = checksumEthereumAddress(LOWER_ADDRESS);
    expect(result).toBe(EXPECTED_CHECKSUM);
    expect(result).not.toBe(LOWER_ADDRESS);
  });

  it("accepts all-uppercase address and returns EIP-55 checksummed form", () => {
    const upper = "0x" + LOWER_ADDRESS.slice(2).toUpperCase();
    const result = checksumEthereumAddress(upper);
    expect(result).toBe(EXPECTED_CHECKSUM);
  });

  it("accepts correctly checksummed mixed-case address unchanged", () => {
    const result = checksumEthereumAddress(EXPECTED_CHECKSUM);
    expect(result).toBe(EXPECTED_CHECKSUM);
  });

  it("rejects mixed-case address with invalid checksum", () => {
    const badChecksum = LOWER_ADDRESS.replace(
      "e0f7030069857d2e4169ee7",
      "E0f7030069857d2e4169ee7",
    );
    expect(() => checksumEthereumAddress(badChecksum)).toThrow(
      "Invalid Ethereum address checksum",
    );
  });

  it("rejects address with wrong length", () => {
    expect(() =>
      checksumEthereumAddress("0x52908400098527886e0f7030069857d2e4169ee"),
    ).toThrow("Invalid Ethereum address");
  });

  it("rejects address without 0x prefix", () => {
    expect(() =>
      checksumEthereumAddress("52908400098527886E0F7030069857D2E4169EE7"),
    ).toThrow("Invalid Ethereum address");
  });

  it("rejects address with non-hex characters", () => {
    expect(() =>
      checksumEthereumAddress("0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"),
    ).toThrow("Invalid Ethereum address");
  });

  it("returns EIP-55 form for another known address", () => {
    const lower = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359";
    const result = checksumEthereumAddress(lower);
    expect(result).toBe("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
  });
});

describe("tryChecksumEthereumAddress", () => {
  it("returns normalized address for valid lowercase input", () => {
    const result = tryChecksumEthereumAddress(LOWER_ADDRESS);
    expect(result).toBe(EXPECTED_CHECKSUM);
  });

  it("returns null for invalid checksum address", () => {
    const badChecksum = LOWER_ADDRESS.replace(
      "e0f7030069857d2e4169ee7",
      "E0f7030069857d2e4169ee7",
    );
    expect(tryChecksumEthereumAddress(badChecksum)).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(tryChecksumEthereumAddress("not-an-address")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(tryChecksumEthereumAddress("")).toBeNull();
  });
});
