import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTsDtoFields,
  extractRustStructFields,
  compareFields,
  auditMapping,
  hasExistingIssue,
  type DtoField,
  type CompatMapping,
} from "./sdk-compat-audit";

// ─── extractTsDtoFields ─────────────────────────────────────────────────────

describe("extractTsDtoFields", () => {
  it("extracts declared fields from a DTO class", () => {
    const source = `
export class CreateCopyDto {
  @IsString()
  declare targetWallet: string;

  @IsOptional()
  @IsEnum(CopyModeDto)
  mode?: CopyModeDto = CopyModeDto.PERCENTAGE;

  @IsOptional()
  @IsNumberString()
  sizeValue?: string;
}
`;
    const fields = extractTsDtoFields(source, "CreateCopyDto");
    expect(fields).toEqual([
      { name: "targetWallet", optional: false },
      { name: "mode", optional: true },
      { name: "sizeValue", optional: true },
    ]);
  });

  it("extracts fields without declare keyword", () => {
    const source = `
export class UpdateCopyDto {
  @IsOptional()
  mode?: CopyModeDto;

  @IsOptional()
  maxExposure?: string;
}
`;
    const fields = extractTsDtoFields(source, "UpdateCopyDto");
    expect(fields).toEqual([
      { name: "mode", optional: true },
      { name: "maxExposure", optional: true },
    ]);
  });

  it("returns empty array for unknown class", () => {
    expect(extractTsDtoFields("class Foo {}", "Bar")).toEqual([]);
  });

  it("handles fields with array types", () => {
    const source = `
export class BatchDto {
  @IsArray()
  items?: string[];
}
`;
    const fields = extractTsDtoFields(source, "BatchDto");
    expect(fields).toEqual([{ name: "items", optional: true }]);
  });
});

// ─── extractRustStructFields ────────────────────────────────────────────────

describe("extractRustStructFields", () => {
  it("extracts fields with camelCase rename", () => {
    const source = `
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCopyConfigParams {
    pub target_wallet: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<CopyMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_value: Option<String>,
}
`;
    const fields = extractRustStructFields(source, "CreateCopyConfigParams");
    expect(fields).toEqual([
      { name: "targetWallet", optional: false },
      { name: "mode", optional: true },
      { name: "sizeValue", optional: true },
    ]);
  });

  it("skips serde(flatten) extra fields", () => {
    const source = `
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyConfig {
    pub id: String,
    pub target_wallet: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}
`;
    const fields = extractRustStructFields(source, "CopyConfig");
    expect(fields.map((f) => f.name)).not.toContain("extra");
    expect(fields).toHaveLength(2);
  });

  it("returns empty array for unknown struct", () => {
    expect(
      extractRustStructFields("pub struct Foo { pub a: i32 }", "Bar"),
    ).toEqual([]);
  });

  it("handles structs without camelCase rename", () => {
    const source = `
#[derive(Debug)]
pub struct RawStruct {
    pub some_field: String,
}
`;
    const fields = extractRustStructFields(source, "RawStruct");
    expect(fields).toEqual([{ name: "some_field", optional: false }]);
  });
});

// ─── compareFields ──────────────────────────────────────────────────────────

describe("compareFields", () => {
  const platform: DtoField[] = [
    { name: "targetWallet", optional: false },
    { name: "mode", optional: true },
    { name: "sizeValue", optional: true },
  ];

  it("returns empty when fields match", () => {
    const sdk: DtoField[] = [
      { name: "targetWallet", optional: false },
      { name: "mode", optional: true },
      { name: "sizeValue", optional: true },
    ];
    const result = compareFields(platform, sdk, "request");
    expect(result.missingInSdk).toEqual([]);
    expect(result.extraInSdk).toEqual([]);
  });

  it("detects missing fields in SDK", () => {
    const sdk: DtoField[] = [{ name: "targetWallet", optional: false }];
    const result = compareFields(platform, sdk, "request");
    expect(result.missingInSdk).toEqual(["mode", "sizeValue"]);
  });

  it("detects extra fields in SDK for request direction", () => {
    const sdk: DtoField[] = [
      { name: "targetWallet", optional: false },
      { name: "mode", optional: true },
      { name: "sizeValue", optional: true },
      { name: "bogusField", optional: true },
    ];
    const result = compareFields(platform, sdk, "request");
    expect(result.extraInSdk).toEqual(["bogusField"]);
  });

  it("ignores extra SDK fields for response direction", () => {
    const sdk: DtoField[] = [
      { name: "targetWallet", optional: false },
      { name: "mode", optional: true },
      { name: "sizeValue", optional: true },
      { name: "status", optional: true },
      { name: "createdAt", optional: true },
    ];
    const result = compareFields(platform, sdk, "response");
    expect(result.extraInSdk).toEqual([]);
  });
});

// ─── auditMapping (integration-style) ───────────────────────────────────────

describe("auditMapping", () => {
  it("returns null when fields match (CopyConfig regression)", () => {
    const mapping: CompatMapping = {
      platformDtoPath:
        "services/api-service/src/copy/dto/create-copy.dto.ts",
      platformClassName: "CreateCopyDto",
      sdkRepo: "F4CTE/polyforge-sdk-rust",
      sdkFilePath: "src/types.rs",
      sdkStructName: "CreateCopyConfigParams",
      direction: "request",
    };

    // Uses the real files on polyforge-lab
    const platformRoot = "/home/f4cte/PolyForge";
    const result = auditMapping(mapping, platformRoot);
    expect(result).toBeNull();
  });

  it("returns null for UpdateCopy (CopyConfig regression)", () => {
    const mapping: CompatMapping = {
      platformDtoPath:
        "services/api-service/src/copy/dto/update-copy.dto.ts",
      platformClassName: "UpdateCopyDto",
      sdkRepo: "F4CTE/polyforge-sdk-rust",
      sdkFilePath: "src/types.rs",
      sdkStructName: "UpdateCopyConfigParams",
      direction: "request",
    };

    const result = auditMapping(mapping, "/home/f4cte/PolyForge");
    expect(result).toBeNull();
  });

  it("detects real mismatch for RiskSettings", () => {
    const mapping: CompatMapping = {
      platformDtoPath:
        "services/api-service/src/settings/dto/update-risk-settings.dto.ts",
      platformClassName: "UpdateRiskSettingsDto",
      sdkRepo: "F4CTE/polyforge-sdk-rust",
      sdkFilePath: "src/types.rs",
      sdkStructName: "UpdateRiskSettingsParams",
      direction: "request",
    };

    const result = auditMapping(mapping, "/home/f4cte/PolyForge");
    expect(result).not.toBeNull();
    expect(result!.missingInSdk.length).toBeGreaterThan(0);
    expect(result!.extraInSdk.length).toBeGreaterThan(0);
  });
});

// ─── hasExistingIssue (dedup guard) ─────────────────────────────────────────

describe("hasExistingIssue", () => {
  it("returns true for an existing issue title", () => {
    const result = hasExistingIssue(
      "F4CTE/polyforge-sdk-rust",
      "[Compat] sdk-rust: CopyConfig / CreateCopyConfigParams use strategy-based fields — platform uses wallet-based model",
    );
    expect(result).toBe(true);
  });

  it("returns false for a non-existent issue title", () => {
    const result = hasExistingIssue(
      "F4CTE/polyforge-sdk-rust",
      "zzz-nonexistent-issue-title-zzz-12345",
    );
    expect(result).toBe(false);
  });
});
