#!/usr/bin/env npx tsx
/**
 * Stale-run watchdog — detects issues stuck in in_progress/in_review
 * where the agent posted a completion comment but never transitioned status.
 *
 * Tiered actions:
 *   >6h since completion comment → auto-close (high confidence) or escalate (low)
 *   2–6h since completion comment → post warning
 *
 * Edge cases:
 *   - Skips issues with blockedByIssueIds set
 *   - Skips issues where comments exist AFTER the completion comment
 */

// --- Exported constants & types (testable) ---

export const WARN_THRESHOLD_MS = 2 * 60 * 60 * 1000;
export const AUTO_CLOSE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export const HIGH_CONFIDENCE_PATTERNS: RegExp[] = [
  /\bmarked\s+(as\s+)?done\b/i,
  /\bpr\s+merged\b/i,
  /\ball\s+tasks?\s+complete[d]?\b/i,
  /\bwork\s+(is\s+)?complete[d]?\b/i,
  /\bshippe?d\b/i,
  /\bdeployed(\s+to\s+prod(uction)?)?\b/i,
  /\bclosed?\s+via\s+pr\b/i,
  /\bmerged\s+to\s+main\b/i,
  /\bstatus\s*:\s*done\b/i,
  /\bfixed\s+(the|this|in|it)\b/i,
  /\bresolved\b/i,
];

export const LOW_CONFIDENCE_PATTERNS: RegExp[] = [
  /\bdone\b/i,
  /\bcompleted?\b/i,
  /\bfinished?\b/i,
  /\bmerged?\b/i,
  /\bready\s+for\s+review\b/i,
  /\bsubmitted?\b/i,
  /\bpushed?\b/i,
  /\bcreated?\s+pr\b/i,
  /\bfixed\b/i,
];

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  updatedAt: string;
  assigneeAgentId: string | null;
  blockedBy?: { id: string; status: string }[];
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorAgentId: string | null;
  authorUserId: string | null;
}

export type WatchdogActionType = 'auto_closed' | 'warned' | 'escalated';

export interface WatchdogAction {
  issue: Issue;
  action: WatchdogActionType;
  reason: string;
  lastComment?: Comment;
}

// --- Pure logic (exported for testing) ---

export function matchesPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function getCommentAgeMs(commentDate: string, now: Date = new Date()): number {
  return now.getTime() - new Date(commentDate).getTime();
}

export function classifyCommentAge(
  commentDate: string,
  now: Date = new Date(),
): 'recent' | 'warn' | 'auto_close' {
  const ageMs = getCommentAgeMs(commentDate, now);
  if (ageMs >= AUTO_CLOSE_THRESHOLD_MS) return 'auto_close';
  if (ageMs >= WARN_THRESHOLD_MS) return 'warn';
  return 'recent';
}

export function getLastAgentComment(
  comments: Comment[],
  assigneeAgentId: string | null,
): Comment | undefined {
  if (!assigneeAgentId) return undefined;
  const agentComments = comments.filter((c) => c.authorAgentId === assigneeAgentId);
  return agentComments[agentComments.length - 1];
}

export function hasCommentsAfter(comments: Comment[], targetComment: Comment): boolean {
  const targetTime = new Date(targetComment.createdAt).getTime();
  return comments.some(
    (c) => c.id !== targetComment.id && new Date(c.createdAt).getTime() > targetTime,
  );
}

export function shouldSkipIssue(issue: Issue): boolean {
  return Array.isArray(issue.blockedBy) && issue.blockedBy.length > 0;
}

export function determineAction(
  issue: Issue,
  comments: Comment[],
  now: Date = new Date(),
): WatchdogAction | null {
  if (shouldSkipIssue(issue)) return null;

  const lastAgentComment = getLastAgentComment(comments, issue.assigneeAgentId);
  if (!lastAgentComment) return null;

  if (hasCommentsAfter(comments, lastAgentComment)) return null;

  const ageClass = classifyCommentAge(lastAgentComment.createdAt, now);
  if (ageClass === 'recent') return null;

  const body = lastAgentComment.body;
  const isHighConf = matchesPatterns(body, HIGH_CONFIDENCE_PATTERNS);
  const isLowConf = matchesPatterns(body, LOW_CONFIDENCE_PATTERNS);

  if (!isHighConf && !isLowConf) return null;

  if (ageClass === 'auto_close') {
    if (isHighConf) {
      return {
        issue,
        action: 'auto_closed',
        reason: `Last agent comment (${lastAgentComment.createdAt}) contains high-confidence completion signal and is >6h old.`,
        lastComment: lastAgentComment,
      };
    }
    return {
      issue,
      action: 'escalated',
      reason: `Last agent comment (${lastAgentComment.createdAt}) contains possible completion signal (low confidence) and is >6h old.`,
      lastComment: lastAgentComment,
    };
  }

  // ageClass === 'warn' (2–6h)
  return {
    issue,
    action: 'warned',
    reason: `Last agent comment (${lastAgentComment.createdAt}) may indicate completion but status was not updated. Comment is 2–6h old.`,
    lastComment: lastAgentComment,
  };
}

// --- API helpers (private, side-effectful) ---

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID ?? '';

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'X-Paperclip-Run-Id': RUN_ID,
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiPatch(path: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${await res.text()}`);
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchStaleIssues(): Promise<Issue[]> {
  const data = await apiGet<Issue[] | { data: Issue[] }>(
    `/api/companies/${COMPANY_ID}/issues?status=in_progress,in_review&limit=200`,
  );
  return Array.isArray(data) ? data : data.data;
}

async function fetchComments(issueId: string): Promise<Comment[]> {
  const data = await apiGet<Comment[] | { data: Comment[] }>(`/api/issues/${issueId}/comments`);
  return Array.isArray(data) ? data : data.data;
}

async function executeAction(action: WatchdogAction): Promise<void> {
  const { issue } = action;

  switch (action.action) {
    case 'auto_closed':
      await apiPatch(`/api/issues/${issue.id}`, {
        status: 'done',
        comment: `**Watchdog auto-close**: ${action.reason}\n\nThis issue appeared complete based on comment analysis but was never transitioned to done.`,
      });
      break;
    case 'warned':
      await apiPost(`/api/issues/${issue.id}/comments`, {
        body: `**Watchdog warning**: ${action.reason}\n\nPlease update the status if this work is complete, or add context if it's still active.`,
      });
      break;
    case 'escalated':
      await apiPost(`/api/issues/${issue.id}/comments`, {
        body: `**Watchdog escalation**: ${action.reason}\n\nLow-confidence match — please review and update the status.`,
      });
      break;
  }
}

// --- Main entry ---

async function run(): Promise<WatchdogAction[]> {
  if (!API_URL || !API_KEY || !COMPANY_ID) {
    console.error('Missing required env: PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID');
    process.exit(1);
  }

  console.log(`[watchdog] Starting stale-run scan at ${new Date().toISOString()}`);
  const now = new Date();

  const issues = await fetchStaleIssues();
  console.log(`[watchdog] Found ${issues.length} issues in in_progress/in_review`);

  const actions: WatchdogAction[] = [];

  for (const issue of issues) {
    try {
      const comments = await fetchComments(issue.id);
      if (comments.length === 0) continue;

      const action = determineAction(issue, comments, now);
      if (!action) continue;

      await executeAction(action);
      actions.push(action);
      console.log(`[watchdog] ${action.action} ${issue.identifier}: ${issue.title}`);
    } catch (err) {
      console.error(`[watchdog] Error processing ${issue.identifier}:`, err);
    }
  }

  const ac = actions.filter((a) => a.action === 'auto_closed').length;
  const w = actions.filter((a) => a.action === 'warned').length;
  const e = actions.filter((a) => a.action === 'escalated').length;
  console.log(`[watchdog] Scan complete. ${actions.length} actions (${ac} auto-closed, ${w} warned, ${e} escalated)`);
  return actions;
}

run().catch((err) => {
  console.error('[watchdog] Fatal error:', err);
  process.exit(1);
});
