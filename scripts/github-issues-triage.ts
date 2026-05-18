#!/usr/bin/env npx tsx
/**
 * GitHub Issues Triage → Paperclip
 * Scans all PolyForge repos for open GitHub issues and creates
 * corresponding Paperclip tasks with workload-based agent assignment.
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

const AGENTS = {
  frontend: ['98ca42db-4a5e-4e4f-a1ff-d6c7d8805317'], // Daedalus
  backend: [
    '6ae0d7ed-b935-492f-b662-7a1d7e8998bb', // Vulcan
    '3b41a18d-810c-4bce-b033-7c13f775b6ce', // Argus
    '4c257d6f-6410-4b13-b80d-a165ffe54224', // Forge
  ],
  fallback: 'ea80efad-8336-46ef-a755-1f91a0a7360c', // Hephaestus
};

const FRONTEND_LABELS = ['frontend', 'ui', 'ux', 'design', 'angular', 'nextjs', 'css', 'tailwind'];

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

function isFrontend(labels: string[], title: string): boolean {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => FRONTEND_LABELS.includes(l))) return true;
  const titleLower = title.toLowerCase();
  if (FRONTEND_LABELS.some((fl) => titleLower.includes(fl))) return true;
  return false;
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

async function getAgentWorkload(agentId: string): Promise<number> {
  const res = await paperclipFetch(
    `/api/companies/${requirePaperclipCompanyId()}/issues?assigneeAgentId=${agentId}&status=todo,in_progress`,
  );
  if (!res.ok) return 999;
  const issues = (await res.json()) as Array<unknown>;
  return issues.length;
}

async function pickAgent(pool: string[]): Promise<string> {
  let minLoad = Infinity;
  let chosen = pool[0];

  for (const agentId of pool) {
    const load = await getAgentWorkload(agentId);
    if (load < minLoad) {
      minLoad = load;
      chosen = agentId;
    }
  }

  return chosen;
}

async function createPaperclipIssue(
  ghIssue: GHIssue,
  assigneeAgentId: string,
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
      assigneeAgentId,
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
    const frontend = isFrontend(ghIssue.labels, ghIssue.title);
    const pool = frontend ? AGENTS.frontend : AGENTS.backend;
    const assignee = await pickAgent(pool);

    const identifier = await createPaperclipIssue(ghIssue, assignee, priority);
    if (identifier) {
      const poolName = frontend ? 'frontend' : 'backend';
      console.log(`[triage] Created ${identifier} for ${ghIssue.url} → ${poolName} agent`);
      created++;
    }
  }

  console.log(`[triage] Done. Created: ${created}, Skipped (duplicates): ${skipped}`);
}

main().catch((err) => {
  console.error('[triage] Fatal error:', err);
  process.exit(1);
});
