#!/usr/bin/env npx tsx
/**
 * SDK Compatibility Auditor — deterministic field-level comparison between
 * platform DTOs and SDK types. Replaces ad-hoc LLM-based auditing to
 * eliminate oscillating false positives.
 *
 * Usage:   npx tsx scripts/sdk-compat-audit/sdk-compat-audit.ts [--dry-run]
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DtoField {
  name: string;
  optional: boolean;
}

export interface CompatMapping {
  platformDtoPath: string;
  platformClassName: string;
  sdkRepo: string;
  sdkFilePath: string;
  sdkStructName: string;
  direction: "request" | "response";
}

export interface CompatFinding {
  mapping: CompatMapping;
  missingInSdk: string[];
  extraInSdk: string[];
}

// ─── SDK Repos (absolute paths on polyforge-lab) ────────────────────────────

const SDK_REPOS: Record<string, string> = {
  "F4CTE/polyforge-sdk-rust": "/home/f4cte/polyforge-sdk-rust",
};

// ─── Mappings ───────────────────────────────────────────────────────────────
// Each entry links a platform DTO to the corresponding SDK struct.
// Add new mappings here as the SDK surface grows.

export const MAPPINGS: CompatMapping[] = [
  {
    platformDtoPath: "services/api-service/src/copy/dto/create-copy.dto.ts",
    platformClassName: "CreateCopyDto",
    sdkRepo: "F4CTE/polyforge-sdk-rust",
    sdkFilePath: "src/types.rs",
    sdkStructName: "CreateCopyConfigParams",
    direction: "request",
  },
  {
    platformDtoPath: "services/api-service/src/copy/dto/update-copy.dto.ts",
    platformClassName: "UpdateCopyDto",
    sdkRepo: "F4CTE/polyforge-sdk-rust",
    sdkFilePath: "src/types.rs",
    sdkStructName: "UpdateCopyConfigParams",
    direction: "request",
  },
  {
    platformDtoPath:
      "services/api-service/src/settings/dto/update-risk-settings.dto.ts",
    platformClassName: "UpdateRiskSettingsDto",
    sdkRepo: "F4CTE/polyforge-sdk-rust",
    sdkFilePath: "src/types.rs",
    sdkStructName: "UpdateRiskSettingsParams",
    direction: "request",
  },
];

// ─── Extraction: TypeScript DTO ─────────────────────────────────────────────

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function extractTsDtoFields(
  source: string,
  className: string,
): DtoField[] {
  const classRe = new RegExp(
    `class\\s+${className}\\s*(?:extends\\s+\\S+\\s*)?\\{([\\s\\S]*?)^\\}`,
    "m",
  );
  const match = classRe.exec(source);
  if (!match) return [];

  const body = match[1];
  const fields: DtoField[] = [];

  // Match:  declare fieldName: Type;  OR  fieldName?: Type  OR  fieldName: Type
  const fieldRe =
    /(?:declare\s+)?(\w+)(\??):\s*\w+(?:\[\])?\s*(?:=\s*[^;]+)?;/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(body)) !== null) {
    const name = m[1];
    // Skip class-validator decorator names that accidentally match
    if (
      name === "message" &&
      body.substring(Math.max(0, m.index - 30), m.index).includes("@")
    )
      continue;
    fields.push({ name, optional: m[2] === "?" });
  }
  return fields;
}

// ─── Extraction: Rust struct ────────────────────────────────────────────────

export function extractRustStructFields(
  source: string,
  structName: string,
): DtoField[] {
  // Find the struct block, handling serde attributes before it
  const structRe = new RegExp(
    `(?:#\\[derive[\\s\\S]*?\\]\\s*)*(?:#\\[serde[\\s\\S]*?\\]\\s*)*pub\\s+struct\\s+${structName}\\s*\\{([\\s\\S]*?)^\\}`,
    "m",
  );
  const match = structRe.exec(source);
  if (!match) return [];

  const body = match[1];
  const fields: DtoField[] = [];

  // The serde attribute is inside the matched region (before the struct body)
  const preamble = match[0].substring(0, match[0].indexOf("{"));
  const hasCamelCase = preamble.includes('rename_all = "camelCase"');

  // Match: pub field_name: Type
  const fieldRe = /pub\s+(\w+):\s*(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(body)) !== null) {
    const rawName = m[1];
    const rawType = m[2].replace(/,$/, "");

    // Skip serde(flatten) catch-all fields
    if (rawName === "extra" && rawType.includes("Value")) continue;

    const name = hasCamelCase ? snakeToCamel(rawName) : rawName;
    const optional = rawType.startsWith("Option<");
    fields.push({ name, optional });
  }
  return fields;
}

// ─── Comparison ─────────────────────────────────────────────────────────────

export function compareFields(
  platformFields: DtoField[],
  sdkFields: DtoField[],
  direction: "request" | "response",
): { missingInSdk: string[]; extraInSdk: string[] } {
  const platformNames = new Set(platformFields.map((f) => f.name));
  const sdkNames = new Set(sdkFields.map((f) => f.name));

  const missingInSdk = [...platformNames].filter((n) => !sdkNames.has(n));

  // For request DTOs, extra SDK fields are a problem (platform rejects them).
  // For response types, extra SDK fields with #[serde(default)] are harmless.
  const extraInSdk =
    direction === "request"
      ? [...sdkNames].filter((n) => !platformNames.has(n))
      : [];

  return { missingInSdk, extraInSdk };
}

// ─── Dedup Guard ────────────────────────────────────────────────────────────

export function hasExistingIssue(repo: string, title: string): boolean {
  try {
    const raw = execFileSync(
      "gh",
      [
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "all",
        "--search",
        title,
        "--json",
        "title,state",
        "--limit",
        "50",
      ],
      { encoding: "utf8", timeout: 15_000 },
    );
    const issues: Array<{ title: string; state: string }> = JSON.parse(raw);
    return issues.some((i) => i.title === title);
  } catch {
    return false;
  }
}

// ─── Audit Runner ───────────────────────────────────────────────────────────

export function auditMapping(
  mapping: CompatMapping,
  platformRoot: string,
): CompatFinding | null {
  const dtoPath = path.join(platformRoot, mapping.platformDtoPath);
  const sdkRoot = SDK_REPOS[mapping.sdkRepo];
  if (!sdkRoot) return null;

  const sdkPath = path.join(sdkRoot, mapping.sdkFilePath);

  if (!fs.existsSync(dtoPath) || !fs.existsSync(sdkPath)) return null;

  const dtoSource = fs.readFileSync(dtoPath, "utf8");
  const sdkSource = fs.readFileSync(sdkPath, "utf8");

  const platformFields = extractTsDtoFields(
    dtoSource,
    mapping.platformClassName,
  );
  const sdkFields = extractRustStructFields(sdkSource, mapping.sdkStructName);

  if (platformFields.length === 0 || sdkFields.length === 0) return null;

  const { missingInSdk, extraInSdk } = compareFields(
    platformFields,
    sdkFields,
    mapping.direction,
  );

  if (missingInSdk.length === 0 && extraInSdk.length === 0) return null;

  return { mapping, missingInSdk, extraInSdk };
}

export function runAudit(
  platformRoot: string,
  opts: { dryRun?: boolean; skipDedup?: boolean } = {},
): CompatFinding[] {
  const findings: CompatFinding[] = [];

  for (const mapping of MAPPINGS) {
    const finding = auditMapping(mapping, platformRoot);
    if (!finding) continue;

    const title = `[Compat] ${mapping.sdkRepo.split("/")[1]}: ${mapping.sdkStructName} fields do not match platform ${mapping.platformClassName}`;

    if (!opts.skipDedup) {
      const alreadyFiled = hasExistingIssue(mapping.sdkRepo, title);
      if (alreadyFiled) {
        console.log(`[dedup] Skipping — issue already exists: ${title}`);
        continue;
      }
    }

    findings.push(finding);

    if (!opts.dryRun) {
      try {
        execFileSync(
          "gh",
          [
            "issue",
            "create",
            "--repo",
            mapping.sdkRepo,
            "--title",
            title,
            "--label",
            "compatibility",
            "--body",
            formatIssueBody(finding),
          ],
          { encoding: "utf8", timeout: 15_000 },
        );
        console.log(`[filed] ${title}`);
      } catch (e) {
        console.error(`[error] Failed to file issue: ${title}`, e);
      }
    } else {
      console.log(`[dry-run] Would file: ${title}`);
      console.log(
        `  missing in SDK: ${finding.missingInSdk.join(", ") || "none"}`,
      );
      console.log(
        `  extra in SDK: ${finding.extraInSdk.join(", ") || "none"}`,
      );
    }
  }

  return findings;
}

function formatIssueBody(finding: CompatFinding): string {
  const lines = [
    "## Compatibility Finding (Automated)",
    "",
    `**Platform DTO:** \`${finding.mapping.platformClassName}\` in \`${finding.mapping.platformDtoPath}\``,
    `**SDK struct:** \`${finding.mapping.sdkStructName}\` in \`${finding.mapping.sdkFilePath}\``,
    `**Direction:** ${finding.mapping.direction}`,
    "",
  ];

  if (finding.missingInSdk.length > 0) {
    lines.push(
      "### Missing in SDK",
      ...finding.missingInSdk.map((f) => `- \`${f}\``),
      "",
    );
  }
  if (finding.extraInSdk.length > 0) {
    lines.push(
      "### Extra in SDK (rejected by platform)",
      ...finding.extraInSdk.map((f) => `- \`${f}\``),
      "",
    );
  }

  lines.push(
    "---",
    "*Filed by `scripts/sdk-compat-audit` — deterministic field comparison.*",
  );
  return lines.join("\n");
}

// ─── CLI Entry ──────────────────────────────────────────────────────────────

if (
  process.argv[1]?.endsWith("sdk-compat-audit.ts") ||
  process.argv[1]?.endsWith("sdk-compat-audit.js")
) {
  const dryRun = process.argv.includes("--dry-run");
  const root = path.resolve(__dirname, "../..");
  const findings = runAudit(root, { dryRun });
  console.log(
    `\nAudit complete: ${findings.length} finding(s)${dryRun ? " (dry run)" : ""}`,
  );
  process.exit(findings.length > 0 ? 1 : 0);
}
