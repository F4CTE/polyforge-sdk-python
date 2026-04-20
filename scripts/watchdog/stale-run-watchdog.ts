#!/usr/bin/env ts-node
/**
 * Stale-run watchdog — detects issues stuck in in_progress/in_review
 * where the agent posted a completion comment but never transitioned status.
 *
 * Designed to run inside a Paperclip routine execution heartbeat.
 * Requires env: PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID,
 *               PAPERCLIP_RUN_ID (optional, for traceability)
 */

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID ?? '';

if (!API_URL || !API_KEY || !COMPANY_ID) {
  console.error('Missing required env: PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID');
  process.exit(1);
}

const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

const HIGH_CONFIDENCE_PATTERNS = [
  /\bmarked\s+(as\s+)?done\b/i,
  /\bpr\s+merged\b/i,
  /\ball\s+tasks?\s+complete[d]?\b/i,
  /\bwork\s+(is\s+)?complete[d]?\b/i,
  /\bshippe?d\b/i,
  /\bdeployed\s+to\s+prod(uction)?\b/i,
  /\bclosed?\s+via\s+pr\b/i,
  /\bmerged\s+to\s+main\b/i,
  /\bstatus\s*:\s*done\b/i,
];

const LOW_CONFIDENCE_PATTERNS = [
  /\bdone\b/i,
  /\bcompleted?\b/i,
  /\bfinished?\b/i,
  /\bmerged?\b/i,
  /\bready\s+for\s+review\b/i,
  /\bsubmitted?\b/i,
  /\bpushed?\b/i,
  /\bcreated?\s+pr\b/i,
];

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  updatedAt: string;
  assigneeAgentId: string | null;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorAgentId: string | null;
  authorUserId: string | null;
}

interface WatchdogAction {
  issue: Issue;
  action: 'auto_closed' | 'escalated';
  reason: string;
  lastComment?: Comment;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'X-Paperclip-Run-Id': RUN_ID,
    },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiPatch(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-Paperclip-Run-Id': RUN_ID,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${await res.text()}`);
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-Paperclip-Run-Id': RUN_ID,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function matchesPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function isStale(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > STALE_THRESHOLD_MS;
}

function getLastAgentComment(comments: Comment[], assigneeAgentId: string | null): Comment | undefined {
  if (!assigneeAgentId) return undefined;
  const agentComments = comments.filter((c) => c.authorAgentId === assigneeAgentId);
  return agentComments[agentComments.length - 1];
}

async function fetchStaleIssues(): Promise<Issue[]> {
  const statuses = 'in_progress,in_review';
  const data = await apiGet<{ data: Issue[] }>(
    `/api/companies/${COMPANY_ID}/issues?status=${statuses}&limit=200`,
  );
  return data.data ?? (data as unknown as Issue[]);
}

async function fetchComments(issueId: string): Promise<Comment[]> {
  const data = await apiGet<{ data: Comment[] }>(`/api/issues/${issueId}/comments`);
  return data.data ?? (data as unknown as Comment[]);
}

async function autoClose(issue: Issue, reason: string): Promise<void> {
  await apiPatch(`/api/issues/${issue.id}`, {
    status: 'done',
    comment: `🤖 **Watchdog auto-close**: ${reason}\n\nThis issue appeared complete based on comment analysis but was never transitioned to done. Auto-closing after 12h of inactivity.`,
  });
}

async function escalate(issue: Issue, reason: string): Promise<void> {
  await apiPost(`/api/issues/${issue.id}/comments`, {
    body: `🤖 **Watchdog notice**: This issue may be stale.\n\n${reason}\n\nPlease update the status if this work is complete, or add context if it's still active.`,
  });
}

async function run(): Promise<void> {
  console.log(`[watchdog] Starting stale-run scan at ${new Date().toISOString()}`);

  const issues = await fetchStaleIssues();
  console.log(`[watchdog] Found ${issues.length} issues in in_progress/in_review`);

  const actions: WatchdogAction[] = [];

  for (const issue of issues) {
    try {
      const comments = await fetchComments(issue.id);
      if (comments.length === 0) continue;

      const lastAgentComment = getLastAgentComment(comments, issue.assigneeAgentId);
      if (!lastAgentComment) continue;

      const commentBody = lastAgentComment.body;
      const commentAge = isStale(lastAgentComment.createdAt);
      const issueAge = isStale(issue.updatedAt);

      if (!commentAge) continue; // recent activity — skip

      const isHighConfidence = matchesPatterns(commentBody, HIGH_CONFIDENCE_PATTERNS);
      const isLowConfidence = matchesPatterns(commentBody, LOW_CONFIDENCE_PATTERNS);

      if (isHighConfidence && issueAge) {
        const reason = `Last agent comment (${lastAgentComment.createdAt}) contains high-confidence completion signal and issue has been inactive for >12h.`;
        await autoClose(issue, reason);
        actions.push({ issue, action: 'auto_closed', reason, lastComment: lastAgentComment });
        console.log(`[watchdog] Auto-closed ${issue.identifier}: ${issue.title}`);
      } else if (isLowConfidence && issueAge) {
        const reason = `Last agent comment (${lastAgentComment.createdAt}) contains possible completion signal but confidence is low. Issue inactive >12h.`;
        await escalate(issue, reason);
        actions.push({ issue, action: 'escalated', reason, lastComment: lastAgentComment });
        console.log(`[watchdog] Escalated ${issue.identifier}: ${issue.title}`);
      }
    } catch (err) {
      console.error(`[watchdog] Error processing ${issue.identifier}:`, err);
    }
  }

  console.log(`[watchdog] Scan complete. Actions: ${actions.length} (${actions.filter((a) => a.action === 'auto_closed').length} auto-closed, ${actions.filter((a) => a.action === 'escalated').length} escalated)`);

  return summarize(actions, issues.length);
}

async function summarize(actions: WatchdogAction[], totalScanned: number): Promise<void> {
  const autoClosed = actions.filter((a) => a.action === 'auto_closed');
  const escalated = actions.filter((a) => a.action === 'escalated');

  const lines: string[] = [
    `## Watchdog Run Summary`,
    ``,
    `**Scanned:** ${totalScanned} issues in \`in_progress\`/\`in_review\``,
    `**Auto-closed:** ${autoClosed.length}`,
    `**Escalated:** ${escalated.length}`,
    `**No action:** ${totalScanned - actions.length}`,
    ``,
  ];

  if (autoClosed.length > 0) {
    lines.push(`### Auto-closed`);
    for (const a of autoClosed) {
      lines.push(`- **${a.issue.identifier}** — ${a.issue.title}`);
    }
    lines.push('');
  }

  if (escalated.length > 0) {
    lines.push(`### Escalated`);
    for (const a of escalated) {
      lines.push(`- **${a.issue.identifier}** — ${a.issue.title}`);
    }
    lines.push('');
  }

  if (actions.length === 0) {
    lines.push(`_No stale issues detected this run._`);
  }

  console.log('\n' + lines.join('\n'));
}

run().catch((err) => {
  console.error('[watchdog] Fatal error:', err);
  process.exit(1);
});
