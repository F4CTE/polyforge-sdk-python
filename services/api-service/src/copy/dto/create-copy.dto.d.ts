export declare enum CopyModeDto {
    PERCENTAGE = "PERCENTAGE",
    FIXED = "FIXED",
    MIRROR = "MIRROR"
}
export declare class CreateCopyDto {
    targetWallet: string;
    mode?: CopyModeDto;
    sizeValue?: string;
    maxExposure?: string;
    maxDailyLoss?: string;
    priceOffset?: string;
}
//# sourceMappingURL=create-copy.dto.d.ts.map