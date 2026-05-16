import { BadRequestException } from "@nestjs/common";

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

let _keccak_256: ((msg: Uint8Array) => Uint8Array) | null = null;

async function _loadKeccak256(): Promise<(msg: Uint8Array) => Uint8Array> {
  if (!_keccak_256) {
    const mod = await import("@noble/hashes/sha3.js");
    _keccak_256 = mod.keccak_256;
  }
  return _keccak_256;
}

export async function checksumEthereumAddress(
  address: string,
): Promise<string> {
  if (!ETH_ADDRESS_RE.test(address)) {
    throw new BadRequestException("Invalid Ethereum address");
  }

  const keccak256 = await _loadKeccak256();

  const hexPart = address.slice(2);
  const lower = hexPart.toLowerCase();
  const hash = Buffer.from(keccak256(Buffer.from(lower, "ascii"))).toString(
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

export async function tryChecksumEthereumAddress(
  address: string,
): Promise<string | null> {
  try {
    return await checksumEthereumAddress(address);
  } catch {
    return null;
  }
}
