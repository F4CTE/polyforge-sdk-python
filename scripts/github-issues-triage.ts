#!/usr/bin/env npx tsx
/**
 * GitHub Issues Triage → Paperclip
 * Scans all PolyForge repos for open GitHub issues and creates
 * corresponding Paperclip tasks (unassigned for manual triage).
 */

const PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL ?? '';
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY;
const PAPERCLIP_COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID ?? 'CHANGE_ME';
const PAPERCLIP_RUN_ID = process.env.PAPERCLIP_RUN_ID ?? '';

function requirePaperclipApiUrl(): string {
  const raw = PAPERCLIP_API_URL.trim();
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

function requirePaperclipCompanyId(): string {
  const value = PAPERCLIP_COMPANY_ID.trim();
  if (!value || /^(CHANGE_ME|REPLACE_ME|TODO|TBD)$/i.test(value)) {
    throw new Error('PAPERCLIP_COMPANY_ID must be set to a real company id before making Paperclip API requests');
  }

  return value;
}

const GOAL_ID = '1b200877-f597-4390-b6c9-789c48f709f3';
const PROJECT_ID = '376affbf-04e6-4df3-8f66-9eeca7a531df';

const REPOS = [
  'F4CTE/PolyForge',
  'F4CTE/polyforge-mcp',
  'F4CTE/polyforge-sdk-ts',
  'F4CTE/polyforge-sdk-python',
  'F4CTE/polyforge-sdk-rust',
];

interface GHIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  repo: string;
  body: string;
}

function mapPriority(labels: string[]): 'high' | 'medium' | 'low' {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.includes('bug') || lower.includes('security') || lower.includes('critical')) return 'high';
  if (lower.includes('enhancement') || lower.includes('feature')) return 'medium';
  if (lower.includes('question') || lower.includes('documentation') || lower.includes('good first issue'))
    return 'low';
  return 'medium';
}

async function execGh(args: string[]): Promise<string> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  const { stdout } = await exec('gh', args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

async function fetchGHIssues(): Promise<GHIssue[]> {
  const allIssues: GHIssue[] = [];

  for (const repo of REPOS) {
    try {
      const json = await execGh([
        'issue',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--limit',
        '50',
        '--json',
        'number,title,url,labels,body',
      ]);
      const issues = JSON.parse(json) as Array<{
        number: number;
        title: string;
        url: string;
        labels: Array<{ name: string }>;
        body: string;
      }>;

      for (const issue of issues) {
        allIssues.push({
          number: issue.number,
          title: issue.title,
          url: issue.url,
          labels: issue.labels.map((l) => l.name),
          repo,
          body: issue.body ?? '',
        });
      }
      console.log(`[triage] ${repo}: found ${issues.length} open issues`);
    } catch (err) {
      console.error(`[triage] ${repo}: failed to fetch — ${(err as Error).message}`);
    }
  }

  return allIssues;
}

async function paperclipFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${requirePaperclipApiUrl()}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${PAPERCLIP_API_KEY}`,
    'Content-Type': 'application/json',
    ...(PAPERCLIP_RUN_ID ? { 'X-Paperclip-Run-Id': PAPERCLIP_RUN_ID } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };
  return fetch(url, { ...options, headers });
}

async function issueAlreadyExists(ghUrl: string): Promise<boolean> {
  const res = await paperclipFetch(
    `/api/companies/${requirePaperclipCompanyId()}/issues?q=${encodeURIComponent(ghUrl)}&status=todo,in_progress,in_review,blocked,backlog`,
  );
  if (!res.ok) return false;
  const issues = (await res.json()) as Array<{ description?: string }>;
  return issues.some((i) => i.description?.includes(ghUrl));
}

async function createPaperclipIssue(
  ghIssue: GHIssue,
  priority: string,
): Promise<string | null> {
  const description = [
    `## GitHub Issue`,
    ``,
    `**Repo:** ${ghIssue.repo}`,
    `**URL:** ${ghIssue.url}`,
    `**Labels:** ${ghIssue.labels.join(', ') || 'none'}`,
    ``,
    `## Description`,
    ``,
    ghIssue.body.slice(0, 2000) || '_No description provided._',
  ].join('\n');

  const res = await paperclipFetch(`/api/companies/${requirePaperclipCompanyId()}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: `[${ghIssue.repo.split('/')[1]}#${ghIssue.number}] ${ghIssue.title}`,
      description,
      status: 'todo',
      priority,
      projectId: PROJECT_ID,
      goalId: GOAL_ID,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[triage] Failed to create for ${ghIssue.url}: ${res.status} ${errBody}`);
    return null;
  }

  const created = (await res.json()) as { id: string; identifier: string };
  return created.identifier;
}

async function main() {
  if (!PAPERCLIP_API_KEY) {
    console.error('[triage] PAPERCLIP_API_KEY is required');
    process.exit(1);
  }

  requirePaperclipApiUrl();
  requirePaperclipCompanyId();

  console.log('[triage] Starting GitHub issues triage...');
  console.log(`[triage] Scanning ${REPOS.length} repos`);

  const ghIssues = await fetchGHIssues();
  console.log(`[triage] Total open GitHub issues: ${ghIssues.length}`);

  let created = 0;
  let skipped = 0;

  for (const ghIssue of ghIssues) {
    const exists = await issueAlreadyExists(ghIssue.url);
    if (exists) {
      skipped++;
      continue;
    }

    const priority = mapPriority(ghIssue.labels);

    const identifier = await createPaperclipIssue(ghIssue, priority);
    if (identifier) {
      console.log(`[triage] Created ${identifier} for ${ghIssue.url} (unassigned for manual triage)`);
      created++;
    }
  }

  console.log(`[triage] Done. Created: ${created}, Skipped (duplicates): ${skipped}`);
}

main().catch((err) => {
  console.error('[triage] Fatal error:', err);
  process.exit(1);
});
