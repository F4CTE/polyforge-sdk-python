import { Injectable, Logger } from "@nestjs/common";
import * as nodeCrypto from "crypto";
import {
  keccak256,
  signSecp256K1HexKey,
  privateKeyHexBytesToEthAddress,
} from "@polyforge/crypto-native";
import { DecryptedCredentials } from "../credentials/credentials.service";

/**
 * CLOB V2 Exchange contract addresses per chain.
 *
 * NOTE: These are the V2 contract addresses deployed by Polymarket.
 * Override via CLOB_V2_EXCHANGE_ADDRESS_<CHAIN_ID> environment variables
 * when Polymarket publishes final V2 addresses before the Apr 22 cutover.
 */
const EXCHANGE_ADDRESS: Record<number, string> = {
  137: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E", // CTF Exchange V2 — Polygon mainnet
  80002: "0xdFE02Eb6733538f8Ea35D585af8DE5958AD99E40", // CTF Exchange V2 — Polygon Amoy testnet
};

/**
 * CLOB V2 Neg Risk CTF Exchange contract addresses per chain.
 * Used as verifying contract when negRisk=true.
 */
const NEG_RISK_EXCHANGE_ADDRESS: Record<number, string> = {
  137: "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk CTF Exchange V2 — Polygon mainnet
  80002: "0xC5d563A36AE78145C45a50134d48A1215220f80a", // Neg Risk CTF Exchange V2 — Polygon Amoy testnet
};

/** EIP-712 domain type string */
const DOMAIN_TYPE_STRING =
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

/**
 * Polymarket CLOB V2 Order EIP-712 type string.
 *
 * V2 changes from V1:
 *   - Removed: taker, nonce, feeRateBps
 *   - Added: timestamp (ms), metadata (bytes), builder (address)
 *
 * Field order MUST match the V2 exchange contract struct definition exactly.
 * Verify against https://docs.polymarket.com/order-book/contracts after Apr 22 cutover.
 */
const ORDER_TYPE_STRING =
  "Order(uint256 salt,address maker,address signer,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 timestamp,bytes metadata,address builder,uint8 side,uint8 signatureType)";

/** Pre-computed type hashes (constant strings, no key material) */
const DOMAIN_TYPEHASH = keccak256(Buffer.from(DOMAIN_TYPE_STRING, "utf8"));
const ORDER_TYPEHASH = keccak256(Buffer.from(ORDER_TYPE_STRING, "utf8"));
const DOMAIN_NAME_HASH = keccak256(
  Buffer.from("Polymarket CTF Exchange", "utf8"),
);
// V2 bumps EIP-712 Exchange domain version from "1" to "2"
const DOMAIN_VERSION_HASH = keccak256(Buffer.from("2", "utf8"));

export interface PolymarketOrderParams {
  tokenId: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  expiration: number;
  /** Milliseconds since epoch — included in V2 struct */
  timestamp: number;
  /** Arbitrary bytes for builder attribution metadata; defaults to empty */
  metadata?: Buffer;
  /** Builder EOA address; defaults to zero address */
  builder?: string;
  /** If true, use Neg Risk exchange as EIP-712 verifying contract */
  negRisk?: boolean;
}

export interface SignedPolymarketOrder {
  salt: string;
  maker: string;
  signer: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  timestamp: string;
  metadata: string;
  builder: string;
  side: number;
  signatureType: number;
  signature: string;
}

// ─── ABI encoding helpers ─────────────────────────────────────────────────────

/** Encode a uint256 (BigInt or number) as 32 big-endian bytes. */
function encodeUint256(value: bigint | number): Buffer {
  const n = BigInt(value);
  const buf = Buffer.alloc(32);
  let v = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

/**
 * Encode an Ethereum address as 32 bytes (12 zero-pad bytes + 20 address bytes).
 * Input may be "0x"-prefixed or bare hex.
 */
function encodeAddress(address: string): Buffer {
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  if (hex.length !== 40) {
    throw new Error(`Invalid address length: ${address}`);
  }
  const buf = Buffer.alloc(32);
  Buffer.from(hex.toLowerCase(), "hex").copy(buf, 12);
  return buf;
}

/**
 * EIP-712 encoding for `bytes` dynamic type: keccak256 of the raw bytes.
 * An empty metadata buffer encodes as keccak256("").
 */
function encodeBytes(data: Buffer): Buffer {
  return keccak256(data);
}

/** Convert a Buffer Ethereum address to a checksummed hex string. */
function addressBytesToHex(bytes: Buffer): string {
  return "0x" + bytes.toString("hex").toLowerCase();
}

// ─── EIP-712 hashing ──────────────────────────────────────────────────────────

function computeDomainSeparator(
  chainId: number,
  verifyingContract: string,
): Buffer {
  const encoded = Buffer.concat([
    DOMAIN_TYPEHASH,
    DOMAIN_NAME_HASH,
    DOMAIN_VERSION_HASH,
    encodeUint256(chainId),
    encodeAddress(verifyingContract),
  ]);
  return keccak256(encoded);
}

function computeOrderStructHash(
  order: Omit<SignedPolymarketOrder, "signature">,
): Buffer {
  const metadataHex = order.metadata.startsWith("0x")
    ? order.metadata.slice(2)
    : order.metadata;
  const metadataBytes = Buffer.from(metadataHex, "hex");

  const encoded = Buffer.concat([
    ORDER_TYPEHASH,
    encodeUint256(BigInt(order.salt)),
    encodeAddress(order.maker),
    encodeAddress(order.signer),
    encodeUint256(BigInt(order.tokenId)),
    encodeUint256(BigInt(order.makerAmount)),
    encodeUint256(BigInt(order.takerAmount)),
    encodeUint256(BigInt(order.expiration)),
    encodeUint256(BigInt(order.timestamp)),
    encodeBytes(metadataBytes),
    encodeAddress(order.builder),
    encodeUint256(order.side),
    encodeUint256(order.signatureType),
  ]);
  return keccak256(encoded);
}

function computeEip712Hash(
  domainSeparator: Buffer,
  structHash: Buffer,
): Buffer {
  // EIP-191 prefix "\x19\x01" + domain separator (32) + struct hash (32) = 66 bytes
  const packed = Buffer.concat([
    Buffer.from([0x19, 0x01]),
    domainSeparator,
    structHash,
  ]);
  return keccak256(packed);
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Signs Polymarket CLOB V2 orders using the Rust NAPI secp256k1 implementation.
 *
 * V2 order struct: removes nonce/feeRateBps/taker, adds timestamp/metadata/builder.
 * EIP-712 domain version bumped from "1" to "2".
 *
 * SECURITY: The private key is accepted as a `Buffer` and passed directly to
 * the Rust NAPI binding. It never materializes as a JS string. The Rust
 * implementation uses `zeroize::Zeroizing` to wipe key bytes from native
 * memory as soon as signing completes.
 */
@Injectable()
export class NativeEip712Service {
  private readonly logger = new Logger(NativeEip712Service.name);

  /**
   * Sign a Polymarket CLOB V2 order using the provided credentials.
   *
   * The `privateKey` field of `creds` is passed as a raw Buffer to Rust — it
   * never becomes a JS string. Callers must still call `zeroCredentials(creds)`
   * in a finally block to wipe the Buffer after this call returns.
   */
  async signOrder(
    creds: DecryptedCredentials,
    chainId: number,
    params: PolymarketOrderParams,
  ): Promise<SignedPolymarketOrder> {
    const exchangeMap = params.negRisk
      ? NEG_RISK_EXCHANGE_ADDRESS
      : EXCHANGE_ADDRESS;
    const verifyingContract = exchangeMap[chainId];
    if (!verifyingContract) {
      throw new Error(
        `No CTF Exchange V2 contract address known for chainId=${chainId}. ` +
          `Add it to EXCHANGE_ADDRESS in native-eip712.service.ts.`,
      );
    }

    // Derive the EOA address from the private key entirely in Rust.
    const eoaAddressBytes = privateKeyHexBytesToEthAddress(creds.privateKey);
    const eoaAddress = addressBytesToHex(eoaAddressBytes);

    const maker = creds.safeAddress != null ? creds.safeAddress : eoaAddress;
    const signer = eoaAddress;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const builder = params.builder ?? ZERO_ADDRESS;
    const metadata = params.metadata ?? Buffer.alloc(0);

    // Compute amounts (Polymarket uses 6-decimal fixed-point: 1 share = 1_000_000)
    const makerAmount = BigInt(Math.round(params.size * 1_000_000));
    const takerAmount = BigInt(
      Math.round(params.size * params.price * 1_000_000),
    );

    // Generate a cryptographically random 32-byte salt
    const saltBytes = Buffer.alloc(32);
    nodeCrypto.randomFillSync(saltBytes);
    const salt = "0x" + saltBytes.toString("hex");

    const side = params.side === "BUY" ? 0 : 1;

    const orderWithoutSig: Omit<SignedPolymarketOrder, "signature"> = {
      salt,
      maker,
      signer,
      tokenId: params.tokenId,
      makerAmount: String(makerAmount),
      takerAmount: String(takerAmount),
      expiration: String(params.expiration),
      timestamp: String(params.timestamp),
      metadata: "0x" + metadata.toString("hex"),
      builder,
      side,
      signatureType: creds.sigType,
    };

    // Compute domain separator and struct hash, then the full EIP-712 digest
    const domainSeparator = computeDomainSeparator(chainId, verifyingContract);
    const structHash = computeOrderStructHash(orderWithoutSig);
    const digest = computeEip712Hash(domainSeparator, structHash);

    // Sign the 32-byte digest in Rust.
    // creds.privateKey contains ASCII hex bytes — signSecp256K1HexKey decodes
    // and uses the raw key entirely within Rust memory with zeroize on drop.
    // The private key NEVER materializes as a JS string.
    const sigBytes = signSecp256K1HexKey(creds.privateKey, digest);
    const signature = "0x" + sigBytes.toString("hex");

    this.logger.debug(
      `EIP-712 V2 order signed via Rust NAPI: maker=${maker} side=${params.side} ts=${params.timestamp}`,
    );

    return { ...orderWithoutSig, signature };
  }
}
