import { BadRequestException } from "@nestjs/common";
import { keccak_256 } from "@noble/hashes/sha3";

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function checksumEthereumAddress(address: string): string {
  if (!ETH_ADDRESS_RE.test(address)) {
    throw new BadRequestException("Invalid Ethereum address");
  }

  const hexPart = address.slice(2);
  const lower = hexPart.toLowerCase();
  const hash = Buffer.from(keccak_256(Buffer.from(lower, "ascii"))).toString(
    "hex",
  );
  let checksummed = "0x";

  for (let i = 0; i < lower.length; i++) {
    checksummed +=
      parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }

  // EIP-55: mixed-case inputs encode a checksum in the letter casing.
  // All-lowercase and all-uppercase addresses signal "no checksum" and are
  // always accepted.  Mixed-case addresses MUST match the computed EIP-55
  // checksum — otherwise the address contains a typo and is rejected.
  const hasUpper = /[A-F]/.test(hexPart);
  const hasLower = /[a-f]/.test(hexPart);
  if (hasUpper && hasLower && address !== checksummed) {
    throw new BadRequestException("Invalid Ethereum address checksum");
  }

  return checksummed;
}

export function tryChecksumEthereumAddress(address: string): string | null {
  try {
    return checksumEthereumAddress(address);
  } catch {
    return null;
  }
}
