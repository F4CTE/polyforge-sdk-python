import { Injectable, Logger } from "@nestjs/common";
import {
  PolymarketRelayerService,
  type RelayerAuthHeaders,
  type SubmitTransactionResponse,
} from "../relayer/relayer.service";

export type CtfOperation = "split" | "merge" | "redeem";
export type NegRiskOperation = "convert";

export interface CtfSplitParams {
  conditionId: string;
  amount: string;
  partition: number[];
}

export interface CtfMergeParams {
  conditionId: string;
  collectionIds: string[];
  amount: string;
}

export interface CtfRedeemParams {
  conditionId: string;
  positionId: string;
  amount: string;
}

export interface NegRiskConvertParams {
  conditionId: string;
  tokenId: string;
  amount: string;
  outcomeCount: number;
}

export interface CtfOperationResult {
  operation: CtfOperation | NegRiskOperation;
  transactionID?: string;
  state?: string;
  encodedData: string;
}

const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const NEG_RISK_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

@Injectable()
export class PolymarketCtfService {
  private readonly logger = new Logger(PolymarketCtfService.name);

  constructor(private readonly relayer: PolymarketRelayerService) {}

  encodeSplit(params: CtfSplitParams): string {
    const fnSelector = "0x5eb02767";
    const conditionHex = params.conditionId.startsWith("0x")
      ? params.conditionId.slice(2)
      : params.conditionId;
    const amountHex = BigInt(params.amount).toString(16).padStart(64, "0");
    const partitionEncoded = params.partition
      .map((p) => p.toString(16).padStart(64, "0"))
      .join("");
    return `${fnSelector}${conditionHex.padStart(64, "0")}${amountHex}${partitionEncoded}`;
  }

  encodeMerge(params: CtfMergeParams): string {
    const fnSelector = "0x3d78bca8";
    const conditionHex = params.conditionId.startsWith("0x")
      ? params.conditionId.slice(2)
      : params.conditionId;
    const amountHex = BigInt(params.amount).toString(16).padStart(64, "0");
    const collectionsEncoded = params.collectionIds
      .map((c) => {
        const hex = c.startsWith("0x") ? c.slice(2) : c;
        return hex.padStart(64, "0");
      })
      .join("");
    return `${fnSelector}${conditionHex.padStart(64, "0")}${amountHex}${collectionsEncoded}`;
  }

  encodeRedeem(params: CtfRedeemParams): string {
    const fnSelector = "0x49b3d18a";
    const conditionHex = params.conditionId.startsWith("0x")
      ? params.conditionId.slice(2)
      : params.conditionId;
    const positionHex = params.positionId.startsWith("0x")
      ? params.positionId.slice(2)
      : params.positionId;
    const amountHex = BigInt(params.amount).toString(16).padStart(64, "0");
    return `${fnSelector}${conditionHex.padStart(64, "0")}${positionHex.padStart(64, "0")}${amountHex}`;
  }

  encodeNegRiskConvert(params: NegRiskConvertParams): string {
    const fnSelector = "0x7d4b1e8a";
    const tokenHex = params.tokenId.startsWith("0x")
      ? params.tokenId.slice(2)
      : params.tokenId;
    const amountHex = BigInt(params.amount).toString(16).padStart(64, "0");
    const outcountHex = params.outcomeCount.toString(16).padStart(64, "0");
    return `${fnSelector}${tokenHex.padStart(64, "0")}${amountHex}${outcountHex}`;
  }

  async splitViaRelayer(
    params: CtfSplitParams,
    signerAddress: string,
    proxyWallet: string,
    nonce: string,
    signature: string,
    auth: RelayerAuthHeaders,
  ): Promise<CtfOperationResult> {
    const data = this.encodeSplit(params);
    const resp = await this.submitCtfTransaction(
      signerAddress,
      CTF_CONTRACT,
      proxyWallet,
      data,
      nonce,
      signature,
      auth,
    );
    return { operation: "split", ...resp, encodedData: data };
  }

  async mergeViaRelayer(
    params: CtfMergeParams,
    signerAddress: string,
    proxyWallet: string,
    nonce: string,
    signature: string,
    auth: RelayerAuthHeaders,
  ): Promise<CtfOperationResult> {
    const data = this.encodeMerge(params);
    const resp = await this.submitCtfTransaction(
      signerAddress,
      CTF_CONTRACT,
      proxyWallet,
      data,
      nonce,
      signature,
      auth,
    );
    return { operation: "merge", ...resp, encodedData: data };
  }

  async redeemViaRelayer(
    params: CtfRedeemParams,
    signerAddress: string,
    proxyWallet: string,
    nonce: string,
    signature: string,
    auth: RelayerAuthHeaders,
  ): Promise<CtfOperationResult> {
    const data = this.encodeRedeem(params);
    const resp = await this.submitCtfTransaction(
      signerAddress,
      CTF_CONTRACT,
      proxyWallet,
      data,
      nonce,
      signature,
      auth,
    );
    return { operation: "redeem", ...resp, encodedData: data };
  }

  async convertNegRiskViaRelayer(
    params: NegRiskConvertParams,
    signerAddress: string,
    proxyWallet: string,
    nonce: string,
    signature: string,
    auth: RelayerAuthHeaders,
  ): Promise<CtfOperationResult> {
    const data = this.encodeNegRiskConvert(params);
    const resp = await this.submitCtfTransaction(
      signerAddress,
      NEG_RISK_ADAPTER,
      proxyWallet,
      data,
      nonce,
      signature,
      auth,
    );
    return { operation: "convert", ...resp, encodedData: data };
  }

  getCtfContractAddress(): string {
    return CTF_CONTRACT;
  }

  getNegRiskAdapterAddress(): string {
    return NEG_RISK_ADAPTER;
  }

  getNegRiskExchangeAddress(): string {
    return NEG_RISK_EXCHANGE;
  }

  private async submitCtfTransaction(
    from: string,
    to: string,
    proxyWallet: string,
    data: string,
    nonce: string,
    signature: string,
    auth: RelayerAuthHeaders,
  ): Promise<SubmitTransactionResponse> {
    return this.relayer.submitTransaction(
      {
        from,
        to,
        proxyWallet,
        data,
        nonce,
        signature,
        signatureParams: {
          gasPrice: "0",
          operation: "0",
          safeTxnGas: "0",
          baseGas: "0",
          gasToken: "0x0000000000000000000000000000000000000000",
          refundReceiver: "0x0000000000000000000000000000000000000000",
        },
        type: "SAFE",
      },
      auth,
    );
  }
}
