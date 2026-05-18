#!/usr/bin/env npx tsx
/**
 * CI/CD Monitor — checks CI status across all PolyForge repos,
 * reports failures to Paperclip, and flags stale PRs.
 */

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? '';
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID ?? 'CHANGE_ME';
const PAPERCLIP_RUN_ID = process.env.PAPERCLIP_RUN_ID ?? '';

export function requirePaperclipApiUrl(url: string = PAPERCLIP_API_URL): string {
  const raw = url.trim();
  if (!raw) {
    throw new Error('PAPERCLIP_API_URL is required before making Paperclip API requests');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('PAPERCLIP_API_URL must be an absolute URL before making Paperclip API requests');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('PAPERCLIP_API_URL must be an absolute http(s) URL before making Paperclip API requests');
  }

  return raw.replace(/\/+$/, '');
}

export function requirePaperclipCompanyId(value: string = PAPERCLIP_COMPANY_ID): string {
  const v = value.trim();
  if (!v || /^(CHANGE_ME|REPLACE_ME|TODO|TBD)$/i.test(v)) {
    throw new Error('PAPERCLIP_COMPANY_ID must be set to a real company id before making Paperclip API requests');
  }

  return v;
}

const GOAL_ID = '1b200877-f597-4390-b6c9-789c48f709f3';
const PROJECT_ID = '376affbf-04e6-4df3-8f66-9eeca7a531df';

export const REPOS = [
  'F4CTE/PolyForge',
  'F4CTE/polyforge-mcp',
  'F4CTE/polyforge-sdk-ts',
  'F4CTE/polyforge-sdk-python',
  'F4CTE/polyforge-sdk-rust',
];

export const STALE_PR_DAYS = 7;

export const AGENTS: Record<string, string> = {
  hephaestus: 'ea80efad-8336-46ef-a755-1f91a0a7360c',
  robin: '82144658-906e-4ca2-91f9-ca3164c5a925',
};

// Steps that fail on non-main branches by design (deploy requires main merge)
export const EXPECTED_BRANCH_FAILURES = ['Deploy to Dev', 'Deploy to Production'];

// ─── Types ───────────────────────────────────────────────────────────

export interface CheckRun {
  __typename: string;
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string;
  workflowName: string;
  completedAt: string | null;
  startedAt: string | null;
}

export interface PRData {
  number: number;
  title: string;
  headRefName: string;
  updatedAt: string;
  author: { login: string; name: string };
  statusCheckRollup: CheckRun[];
  url: string;
  repo: string;
}

export interface CIFailure {
  repo: string;
  pr: PRData;
  failedChecks: CheckRun[];
}

export interface StalePR {
  repo: string;
  pr: PRData;
  daysSinceUpdate: number;
  hasCIFailure: boolean;
}

export interface MonitorResult {
  scannedRepos: number;
  totalPRs: number;
  failures: CIFailure[];
  stalePRs: StalePR[];
  pendingPRs: { repo: string; pr: PRData; pendingChecks: CheckRun[] }[];
  timestamp: string;
}

// ─── Pure logic (testable) ───────────────────────────────────────────

export function isRealFailure(check: CheckRun): boolean {
  if (check.status !== 'COMPLETED') return false;
  if (check.conclusion !== 'FAILURE') return false;
  if (EXPECTED_BRANCH_FAILURES.includes(check.name)) return false;
  return true;
}

export function isPending(check: CheckRun): boolean {
  return check.status === 'IN_PROGRESS' || check.status === 'QUEUED' || check.status === 'PENDING';
}

export function classifyPR(pr: PRData, now: Date): {
  failed: CheckRun[];
  pending: CheckRun[];
  isStale: boolean;
  daysSinceUpdate: number;
} {
  const checks = pr.statusCheckRollup ?? [];
  const failed = checks.filter(isRealFailure);
  const pending = checks.filter(isPending);

  const updatedAt = new Date(pr.updatedAt);
  const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = daysSinceUpdate >= STALE_PR_DAYS;

  return { failed, pending, isStale, daysSinceUpdate };
}

export function extractRunId(detailsUrl: string): string | null {
  const match = detailsUrl.match(/\/actions\/runs\/(\d+)/);
  return match ? match[1] : null;
}

export function formatFailureComment(failures: CIFailure[]): string {
  if (failures.length === 0) return '';

  const lines: string[] = ['## CI Failure Report\n'];

  for (const f of failures) {
    const prUrl = `https://github.com/${f.repo}/pull/${f.pr.number}`;
    lines.push(`### [${f.repo}#${f.pr.number}](${prUrl}) — ${f.pr.title}`);
    lines.push(`Branch: \`${f.pr.headRefName}\` | Author: ${f.pr.author.login}\n`);

    for (const check of f.failedChecks) {
      lines.push(`- **${check.name}** (${check.workflowName}) — [View logs](${check.detailsUrl})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatStaleComment(stalePRs: StalePR[]): string {
  if (stalePRs.length === 0) return '';

  const lines: string[] = ['## Stale PR Report\n'];
  lines.push(`PRs with no activity for ${STALE_PR_DAYS}+ days:\n`);

  for (const s of stalePRs) {
    const prUrl = `https://github.com/${s.repo}/pull/${s.pr.number}`;
    const ciStatus = s.hasCIFailure ? 'CI failing' : 'CI passing';
    lines.push(`- [${s.repo}#${s.pr.number}](${prUrl}) — ${s.pr.title} (${s.daysSinceUpdate}d stale, ${ciStatus})`);
  }

  return lines.join('\n');
}

export function formatSummaryComment(result: MonitorResult): string {
  const lines: string[] = [
    `## CI/CD Monitor — ${new Date(result.timestamp).toISOString().slice(0, 16)}Z\n`,
    `Scanned **${result.scannedRepos}** repos, **${result.totalPRs}** open PRs\n`,
  ];

  if (result.failures.length > 0) {
    lines.push(`### Failures (${result.failures.length})\n`);
    lines.push(formatFailureComment(result.failures));
  } else {
    lines.push('### No CI failures detected\n');
  }

  if (result.stalePRs.length > 0) {
    lines.push(formatStaleComment(result.stalePRs));
  }

  if (result.pendingPRs.length > 0) {
    lines.push(`\n### Pending CI (${result.pendingPRs.length} PRs still running)\n`);
    for (const p of result.pendingPRs) {
      const prUrl = `https://github.com/${p.repo}/pull/${p.pr.number}`;
      const checks = p.pendingChecks.map((c) => c.name).join(', ');
      lines.push(`- [${p.repo}#${p.pr.number}](${prUrl}) — waiting: ${checks}`);
    }
  }

  return lines.join('\n');
}

// ─── IO layer (uses execFile — safe against shell injection) ─────────

async function execGh(args: string[]): Promise<string> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  const { stdout } = await exec('gh', args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

async function fetchOpenPRs(repo: string): Promise<PRData[]> {
  try {
    const json = await execGh([
      'pr', 'list',
      '--repo', repo,
      '--state', 'open',
      '--json', 'number,title,headRefName,updatedAt,author,statusCheckRollup,url',
      '--limit', '100',
    ]);
    const prs: PRData[] = JSON.parse(json);
    return prs.map((pr) => ({ ...pr, repo }));
  } catch (err) {
    console.error(`Failed to fetch PRs for ${repo}: ${(err as Error).message}`);
    return [];
  }
}

async function rerunWorkflow(repo: string, runId: string): Promise<boolean> {
  try {
    await execGh(['run', 'rerun', runId, '--repo', repo, '--failed']);
    console.log(`Rerun triggered for ${repo} run ${runId}`);
    return true;
  } catch (err) {
    console.error(`Failed to rerun ${repo} run ${runId}: ${(err as Error).message}`);
    return false;
  }
}

async function paperclipComment(issueId: string, body: string): Promise<void> {
  if (!PAPERCLIP_API_KEY) {
    console.log('[dry-run] Would post comment to', issueId);
    console.log(body);
    return;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${PAPERCLIP_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (PAPERCLIP_RUN_ID) headers['X-Paperclip-Run-Id'] = PAPERCLIP_RUN_ID;

  const res = await fetch(`${requirePaperclipApiUrl()}/api/issues/${issueId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    console.error(`Failed to post comment: ${res.status} ${await res.text()}`);
  }
}

async function paperclipCreateIssue(opts: {
  title: string;
  description: string;
  priority: string;
  assigneeAgentId?: string;
  parentId?: string;
}): Promise<string | null> {
  if (!PAPERCLIP_API_KEY) {
    console.log('[dry-run] Would create issue:', opts.title);
    return null;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${PAPERCLIP_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (PAPERCLIP_RUN_ID) headers['X-Paperclip-Run-Id'] = PAPERCLIP_RUN_ID;

  const res = await fetch(`${requirePaperclipApiUrl()}/api/companies/${requirePaperclipCompanyId()}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: opts.title,
      description: opts.description,
      priority: opts.priority,
      status: 'todo',
      goalId: GOAL_ID,
      projectId: PROJECT_ID,
      assigneeAgentId: opts.assigneeAgentId ?? AGENTS.hephaestus,
      parentId: opts.parentId,
    }),
  });

  if (!res.ok) {
    console.error(`Failed to create issue: ${res.status} ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  return data.id ?? null;
}

async function searchExistingIssue(query: string): Promise<boolean> {
  if (!PAPERCLIP_API_KEY) return false;

  const res = await fetch(
    `${requirePaperclipApiUrl()}/api/companies/${requirePaperclipCompanyId()}/issues?q=${encodeURIComponent(query)}&status=todo,in_progress,blocked`,
    { headers: { 'Authorization': `Bearer ${PAPERCLIP_API_KEY}` } },
  );

  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

// ─── Main ────────────────────────────────────────────────────────────

export async function runMonitor(opts?: {
  dryRun?: boolean;
  rerunTransient?: boolean;
  parentIssueId?: string;
}): Promise<MonitorResult> {

  const now = new Date();
  const result: MonitorResult = {
    scannedRepos: REPOS.length,
    totalPRs: 0,
    failures: [],
    stalePRs: [],
    pendingPRs: [],
    timestamp: now.toISOString(),
  };

  console.log(`CI Monitor — scanning ${REPOS.length} repos at ${now.toISOString()}`);

  for (const repo of REPOS) {
    const prs = await fetchOpenPRs(repo);
    result.totalPRs += prs.length;

    for (const pr of prs) {
      const { failed, pending, isStale, daysSinceUpdate } = classifyPR(pr, now);

      if (failed.length > 0) {
        result.failures.push({ repo, pr, failedChecks: failed });
      }

      if (pending.length > 0) {
        result.pendingPRs.push({ repo, pr, pendingChecks: pending });
      }

      if (isStale) {
        result.stalePRs.push({
          repo,
          pr,
          daysSinceUpdate,
          hasCIFailure: failed.length > 0,
        });
      }
    }
  }

  console.log(`Found ${result.failures.length} failures, ${result.stalePRs.length} stale PRs, ${result.pendingPRs.length} pending`);

  if (opts?.parentIssueId && !opts?.dryRun) {
    const summary = formatSummaryComment(result);
    await paperclipComment(opts.parentIssueId, summary);
  }

  for (const failure of result.failures) {
    if (!opts?.dryRun) {
      const searchKey = `CI failure ${failure.repo}#${failure.pr.number}`;
      const exists = await searchExistingIssue(searchKey);

      if (!exists) {
        const failedNames = failure.failedChecks.map((c) => c.name).join(', ');
        const prUrl = `https://github.com/${failure.repo}/pull/${failure.pr.number}`;

        await paperclipCreateIssue({
          title: `CI failure: ${failure.repo}#${failure.pr.number} — ${failedNames}`,
          description: [
            `## CI Failure on [${failure.repo}#${failure.pr.number}](${prUrl})`,
            '',
            `**PR:** ${failure.pr.title}`,
            `**Branch:** \`${failure.pr.headRefName}\``,
            `**Author:** ${failure.pr.author.login}`,
            '',
            '### Failed Checks',
            '',
            ...failure.failedChecks.map((c) => `- **${c.name}** — [View logs](${c.detailsUrl})`),
            '',
            'Auto-detected by CI Monitor.',
          ].join('\n'),
          priority: 'high',
          parentId: opts?.parentIssueId,
        });
      }
    }

    if (opts?.rerunTransient) {
      for (const check of failure.failedChecks) {
        const runId = extractRunId(check.detailsUrl);
        if (runId) {
          await rerunWorkflow(failure.repo, runId);
        }
      }
    }
  }

  return result;
}

// ─── CLI entry point ─────────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith('ci-monitor.ts') || process.argv[1]?.endsWith('ci-monitor');

if (isMain) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rerun = args.includes('--rerun-transient');
  const parentIdx = args.indexOf('--parent-issue');
  const parentIssueId = parentIdx >= 0 ? args[parentIdx + 1] : undefined;

  runMonitor({ dryRun, rerunTransient: rerun, parentIssueId })
    .then((result) => {
      console.log('\n' + formatSummaryComment(result));
      if (result.failures.length > 0) process.exit(1);
    })
    .catch((err) => {
      console.error('CI Monitor failed:', err);
      process.exit(2);
    });
}
