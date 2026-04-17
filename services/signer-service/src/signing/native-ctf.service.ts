import { Injectable, Logger } from "@nestjs/common";
import {
  keccak256,
  signSecp256K1HexKey,
  privateKeyHexBytesToEthAddress,
} from "@polyforge/crypto-native";
import { DecryptedCredentials } from "../credentials/credentials.service";

// ─── Contract addresses ───────────────────────────────────────────────────────

/** Gnosis ConditionalTokens (CTF) contract address per chain. */
const CTF_ADDRESS: Record<number, string> = {
  137: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045", // Polygon mainnet
  80002: "0x69308FB512518e39F9b16112fA8d994F4e2Bf8bB", // Polygon Amoy testnet
};

/** Default collateral token (USDC) per chain. */
const DEFAULT_COLLATERAL: Record<number, string> = {
  137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e on Polygon mainnet
  80002: "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97", // test USDC on Amoy
};

/** Empty bytes32 — default parentCollectionId for root-level CTF positions. */
const ZERO_BYTES32 = "0x" + "00".repeat(32);

// ─── ABI function selectors ───────────────────────────────────────────────────

// keccak256("redeemPositions(address,bytes32,bytes32,uint256[])")[0..4]
const REDEEM_SELECTOR = Buffer.from("9e28d08e", "hex");
// keccak256("splitPosition(address,bytes32,bytes32,uint256[],uint256)")[0..4]
const SPLIT_SELECTOR = Buffer.from("0a47ae8f", "hex");
// keccak256("mergePositions(address,bytes32,bytes32,uint256[],uint256)")[0..4]
const MERGE_SELECTOR = Buffer.from("d750f4b7", "hex");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CtfRedeemParams {
  conditionId: string;
  indexSets: bigint[];
  collateralToken?: string;
  parentCollectionId?: string;
}

export interface CtfSplitMergeParams {
  conditionId: string;
  partition: bigint[];
  amount: bigint;
  collateralToken?: string;
  parentCollectionId?: string;
}

export interface TxParams {
  to: string;
  data: Buffer;
  gasLimit?: bigint;
  gasPrice?: bigint;
  value?: bigint;
  nonce?: number;
}

// ─── ABI encoding helpers ─────────────────────────────────────────────────────

function abiEncodeAddress(addr: string): Buffer {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  const buf = Buffer.alloc(32);
  Buffer.from(hex.toLowerCase().padStart(40, "0"), "hex").copy(buf, 12);
  return buf;
}

function abiEncodeBytes32(val: string): Buffer {
  const hex = val.startsWith("0x") ? val.slice(2) : val;
  return Buffer.from(hex.padStart(64, "0"), "hex");
}

function abiEncodeUint256(val: bigint): Buffer {
  const buf = Buffer.alloc(32);
  let v = val;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

/**
 * ABI-encode a function call for `redeemPositions(address,bytes32,bytes32,uint256[])`.
 *
 * Head layout (32 bytes per slot):
 *   [0] collateralToken (address, static)
 *   [1] parentCollectionId (bytes32, static)
 *   [2] conditionId (bytes32, static)
 *   [3] offset to indexSets array (dynamic head — byte offset from start of args)
 * Tail:
 *   length of indexSets (uint256)
 *   indexSets[0], indexSets[1], ... (uint256 each)
 */
function encodeRedeemPositions(
  collateralToken: string,
  parentCollectionId: string,
  conditionId: string,
  indexSets: bigint[],
): Buffer {
  const HEAD_SLOTS = 4; // 4 static head slots
  const dynamicOffset = BigInt(HEAD_SLOTS * 32);

  const head = Buffer.concat([
    abiEncodeAddress(collateralToken),
    abiEncodeBytes32(parentCollectionId),
    abiEncodeBytes32(conditionId),
    abiEncodeUint256(dynamicOffset),
  ]);
  const tail = Buffer.concat([
    abiEncodeUint256(BigInt(indexSets.length)),
    ...indexSets.map(abiEncodeUint256),
  ]);
  return Buffer.concat([REDEEM_SELECTOR, head, tail]);
}

/**
 * ABI-encode `splitPosition(address,bytes32,bytes32,uint256[],uint256)` or
 * `mergePositions(address,bytes32,bytes32,uint256[],uint256)`.
 *
 * Head layout:
 *   [0] collateralToken (static)
 *   [1] parentCollectionId (static)
 *   [2] conditionId (static)
 *   [3] offset to partition array (dynamic head)
 *   [4] amount (static)
 * Tail:
 *   length of partition + elements
 */
function encodeSplitMerge(
  selector: Buffer,
  collateralToken: string,
  parentCollectionId: string,
  conditionId: string,
  partition: bigint[],
  amount: bigint,
): Buffer {
  const HEAD_SLOTS = 5;
  const dynamicOffset = BigInt(HEAD_SLOTS * 32);

  const head = Buffer.concat([
    abiEncodeAddress(collateralToken),
    abiEncodeBytes32(parentCollectionId),
    abiEncodeBytes32(conditionId),
    abiEncodeUint256(dynamicOffset),
    abiEncodeUint256(amount),
  ]);
  const tail = Buffer.concat([
    abiEncodeUint256(BigInt(partition.length)),
    ...partition.map(abiEncodeUint256),
  ]);
  return Buffer.concat([selector, head, tail]);
}

// ─── RLP encoding ─────────────────────────────────────────────────────────────

/** Encode a non-negative BigInt as a minimal big-endian byte Buffer (no leading zeros). */
function bigIntToMinBuf(n: bigint): Buffer {
  if (n === 0n) return Buffer.alloc(0);
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  return Buffer.from(hex, "hex");
}

/** RLP-encode a single byte string. */
function rlpItem(buf: Buffer): Buffer {
  if (buf.length === 0) return Buffer.from([0x80]);
  if (buf.length === 1 && buf[0] < 0x80) return buf;
  if (buf.length <= 55) {
    return Buffer.concat([Buffer.from([0x80 + buf.length]), buf]);
  }
  const lenBuf = bigIntToMinBuf(BigInt(buf.length));
  return Buffer.concat([Buffer.from([0xb7 + lenBuf.length]), lenBuf, buf]);
}

/** RLP-encode a list of already-raw-byte items. */
function rlpList(items: Buffer[]): Buffer {
  const encoded = Buffer.concat(items.map(rlpItem));
  if (encoded.length <= 55) {
    return Buffer.concat([Buffer.from([0xc0 + encoded.length]), encoded]);
  }
  const lenBuf = bigIntToMinBuf(BigInt(encoded.length));
  return Buffer.concat([Buffer.from([0xf7 + lenBuf.length]), lenBuf, encoded]);
}

/**
 * RLP-encode an EIP-155 unsigned transaction.
 *
 * Fields: [nonce, gasPrice, gasLimit, to (20 bytes), value, data, chainId, 0, 0]
 * All integers use minimal big-endian encoding (no leading zeros; 0 → empty).
 */
function rlpUnsignedTx(
  nonce: bigint,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: Buffer,
  chainId: number,
): Buffer {
  const toBytes = Buffer.from(
    (to.startsWith("0x") ? to.slice(2) : to).padStart(40, "0"),
    "hex",
  );
  return rlpList([
    bigIntToMinBuf(nonce),
    bigIntToMinBuf(gasPrice),
    bigIntToMinBuf(gasLimit),
    toBytes,
    bigIntToMinBuf(value),
    data,
    bigIntToMinBuf(BigInt(chainId)),
    Buffer.alloc(0), // r = 0 (placeholder)
    Buffer.alloc(0), // s = 0 (placeholder)
  ]);
}

/**
 * RLP-encode an EIP-155 signed transaction.
 *
 * v = recoveryId + 35 + 2 * chainId  (EIP-155 replay protection)
 * Fields: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
 */
function rlpSignedTx(
  nonce: bigint,
  gasPrice: bigint,
  gasLimit: bigint,
  to: string,
  value: bigint,
  data: Buffer,
  chainId: number,
  v: bigint,
  r: Buffer,
  s: Buffer,
): Buffer {
  const toBytes = Buffer.from(
    (to.startsWith("0x") ? to.slice(2) : to).padStart(40, "0"),
    "hex",
  );
  return rlpList([
    bigIntToMinBuf(nonce),
    bigIntToMinBuf(gasPrice),
    bigIntToMinBuf(gasLimit),
    toBytes,
    bigIntToMinBuf(value),
    data,
    bigIntToMinBuf(v),
    r,
    s,
  ]);
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Signs and broadcasts Polymarket CTF on-chain transactions using the Rust NAPI
 * secp256k1 implementation.
 *
 * SECURITY: Private keys follow the same zeroization pattern as NativeEip712Service.
 * The raw key bytes never materialize as a JS string — TypeScript only touches
 * public data (calldata, RLP-encoded unsigned transaction fields). The Rust
 * `keccak256` and `signSecp256K1HexKey` functions handle the sensitive digest
 * computation and signing.
 */
@Injectable()
export class NativeCtfService {
  private readonly logger = new Logger(NativeCtfService.name);

  /** Derive EOA address from credentials — delegates to Rust. */
  getEoaAddress(creds: DecryptedCredentials): string {
    const addrBytes = privateKeyHexBytesToEthAddress(creds.privateKey);
    return "0x" + addrBytes.toString("hex").toLowerCase();
  }

  /**
   * Sign an EIP-155 transaction and return the signed raw transaction bytes.
   *
   * The private key (ASCII hex bytes in a Buffer) is passed directly to Rust
   * for secp256k1 signing — it never materializes as a JS string.
   */
  signTransaction(
    creds: DecryptedCredentials,
    chainId: number,
    tx: Required<Pick<TxParams, "to" | "data" | "gasLimit" | "gasPrice" | "value" | "nonce">>,
  ): Buffer {
    const { nonce, gasPrice, gasLimit, to, value, data } = tx;

    const unsignedRlp = rlpUnsignedTx(
      BigInt(nonce),
      gasPrice,
      gasLimit,
      to,
      value,
      data,
      chainId,
    );

    // Hash the unsigned transaction entirely in Rust — the digest contains
    // only public transaction data, never key material.
    const digest = keccak256(unsignedRlp);

    // Sign in Rust: private key stays in Zeroizing memory, never becomes a JS string.
    // signSecp256K1HexKey returns [r(32) | s(32) | v_base(1)] where v_base is 27 or 28.
    const sigBytes = signSecp256K1HexKey(creds.privateKey, digest);

    const r = sigBytes.subarray(0, 32);
    const s = sigBytes.subarray(32, 64);
    const recoveryId = sigBytes[64] - 27; // 0 or 1

    // EIP-155: v = recoveryId + 35 + 2 * chainId
    const v = BigInt(recoveryId) + 35n + 2n * BigInt(chainId);

    return rlpSignedTx(
      BigInt(nonce),
      gasPrice,
      gasLimit,
      to,
      value,
      data,
      chainId,
      v,
      r,
      s,
    );
  }

  /**
   * Broadcast a signed raw transaction to a JSON-RPC endpoint.
   * Returns the transaction hash.
   */
  async broadcastTransaction(rpcUrl: string, rawTx: Buffer): Promise<string> {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_sendRawTransaction",
        params: ["0x" + rawTx.toString("hex")],
        id: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(
        `RPC broadcast failed: HTTP ${res.status} from ${rpcUrl}`,
      );
    }

    const body = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };

    if (body.error) {
      throw new Error(`RPC error: ${body.error.message}`);
    }
    if (!body.result) {
      throw new Error("RPC returned no result for eth_sendRawTransaction");
    }

    return body.result;
  }

  /**
   * Fetch the current transaction count (nonce) for an address from a JSON-RPC endpoint.
   */
  async getTransactionCount(rpcUrl: string, address: string): Promise<number> {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionCount",
        params: [address, "pending"],
        id: 1,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      throw new Error(`RPC nonce fetch failed: HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };

    if (body.error) throw new Error(`RPC error: ${body.error.message}`);
    return parseInt(body.result ?? "0x0", 16);
  }

  /**
   * Fetch the current gas price from a JSON-RPC endpoint.
   */
  async getGasPrice(rpcUrl: string): Promise<bigint> {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      throw new Error(`RPC gas price fetch failed: HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };

    if (body.error) throw new Error(`RPC error: ${body.error.message}`);
    return BigInt(body.result ?? "0x0");
  }

  // ─── CTF operations ─────────────────────────────────────────────────────────

  /**
   * Redeem winning CTF positions on-chain.
   *
   * Calls `ConditionalTokens.redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets)`.
   * The private key signs a transaction digest in Rust — it never materializes as a JS string.
   */
  async redeemPosition(
    creds: DecryptedCredentials,
    chainId: number,
    rpcUrl: string,
    params: CtfRedeemParams,
  ): Promise<{ txHash: string }> {
    const ctfAddress = CTF_ADDRESS[chainId];
    if (!ctfAddress) {
      throw new Error(
        `No CTF contract address known for chainId=${chainId}`,
      );
    }

    const collateralToken =
      params.collateralToken ?? DEFAULT_COLLATERAL[chainId];
    if (!collateralToken) {
      throw new Error(
        `No default collateral token for chainId=${chainId} — provide collateralToken explicitly`,
      );
    }

    const parentCollectionId = params.parentCollectionId ?? ZERO_BYTES32;
    const calldata = encodeRedeemPositions(
      collateralToken,
      parentCollectionId,
      params.conditionId,
      params.indexSets,
    );

    const eoaAddress = this.getEoaAddress(creds);
    const [nonce, gasPrice] = await Promise.all([
      this.getTransactionCount(rpcUrl, eoaAddress),
      this.getGasPrice(rpcUrl),
    ]);

    const rawTx = this.signTransaction(creds, chainId, {
      to: ctfAddress,
      data: calldata,
      nonce,
      gasPrice,
      gasLimit: 300_000n,
      value: 0n,
    });

    const txHash = await this.broadcastTransaction(rpcUrl, rawTx);
    this.logger.log(
      `CTF redeemPositions broadcast: conditionId=${params.conditionId} txHash=${txHash}`,
    );
    return { txHash };
  }

  /**
   * Split collateral into conditional token positions on-chain.
   *
   * Calls `ConditionalTokens.splitPosition(collateralToken, parentCollectionId, conditionId, partition, amount)`.
   */
  async splitPosition(
    creds: DecryptedCredentials,
    chainId: number,
    rpcUrl: string,
    params: CtfSplitMergeParams,
  ): Promise<{ txHash: string }> {
    const ctfAddress = CTF_ADDRESS[chainId];
    if (!ctfAddress) {
      throw new Error(`No CTF contract address known for chainId=${chainId}`);
    }

    const collateralToken =
      params.collateralToken ?? DEFAULT_COLLATERAL[chainId];
    if (!collateralToken) {
      throw new Error(
        `No default collateral token for chainId=${chainId} — provide collateralToken explicitly`,
      );
    }

    const parentCollectionId = params.parentCollectionId ?? ZERO_BYTES32;
    const calldata = encodeSplitMerge(
      SPLIT_SELECTOR,
      collateralToken,
      parentCollectionId,
      params.conditionId,
      params.partition,
      params.amount,
    );

    const eoaAddress = this.getEoaAddress(creds);
    const [nonce, gasPrice] = await Promise.all([
      this.getTransactionCount(rpcUrl, eoaAddress),
      this.getGasPrice(rpcUrl),
    ]);

    const rawTx = this.signTransaction(creds, chainId, {
      to: ctfAddress,
      data: calldata,
      nonce,
      gasPrice,
      gasLimit: 250_000n,
      value: 0n,
    });

    const txHash = await this.broadcastTransaction(rpcUrl, rawTx);
    this.logger.log(
      `CTF splitPosition broadcast: conditionId=${params.conditionId} amount=${params.amount} txHash=${txHash}`,
    );
    return { txHash };
  }

  /**
   * Merge conditional token positions back into collateral on-chain.
   *
   * Calls `ConditionalTokens.mergePositions(collateralToken, parentCollectionId, conditionId, partition, amount)`.
   */
  async mergePosition(
    creds: DecryptedCredentials,
    chainId: number,
    rpcUrl: string,
    params: CtfSplitMergeParams,
  ): Promise<{ txHash: string }> {
    const ctfAddress = CTF_ADDRESS[chainId];
    if (!ctfAddress) {
      throw new Error(`No CTF contract address known for chainId=${chainId}`);
    }

    const collateralToken =
      params.collateralToken ?? DEFAULT_COLLATERAL[chainId];
    if (!collateralToken) {
      throw new Error(
        `No default collateral token for chainId=${chainId} — provide collateralToken explicitly`,
      );
    }

    const parentCollectionId = params.parentCollectionId ?? ZERO_BYTES32;
    const calldata = encodeSplitMerge(
      MERGE_SELECTOR,
      collateralToken,
      parentCollectionId,
      params.conditionId,
      params.partition,
      params.amount,
    );

    const eoaAddress = this.getEoaAddress(creds);
    const [nonce, gasPrice] = await Promise.all([
      this.getTransactionCount(rpcUrl, eoaAddress),
      this.getGasPrice(rpcUrl),
    ]);

    const rawTx = this.signTransaction(creds, chainId, {
      to: ctfAddress,
      data: calldata,
      nonce,
      gasPrice,
      gasLimit: 250_000n,
      value: 0n,
    });

    const txHash = await this.broadcastTransaction(rpcUrl, rawTx);
    this.logger.log(
      `CTF mergePositions broadcast: conditionId=${params.conditionId} amount=${params.amount} txHash=${txHash}`,
    );
    return { txHash };
  }
}
