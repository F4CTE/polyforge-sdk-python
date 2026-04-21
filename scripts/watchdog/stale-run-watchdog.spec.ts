import { describe, it, expect } from 'vitest';
import {
  matchesPatterns,
  classifyCommentAge,
  getCommentAgeMs,
  getLastAgentComment,
  hasCommentsAfter,
  shouldSkipIssue,
  determineAction,
  HIGH_CONFIDENCE_PATTERNS,
  LOW_CONFIDENCE_PATTERNS,
  WARN_THRESHOLD_MS,
  AUTO_CLOSE_THRESHOLD_MS,
  type Issue,
  type Comment,
} from './stale-run-watchdog';

// --- Helpers ---

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    identifier: 'POLA-100',
    title: 'Test issue',
    status: 'in_progress',
    updatedAt: '2026-04-20T10:00:00.000Z',
    assigneeAgentId: 'agent-1',
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    body: 'Some comment',
    createdAt: '2026-04-20T10:00:00.000Z',
    authorAgentId: 'agent-1',
    authorUserId: null,
    ...overrides,
  };
}

function hoursAgo(hours: number, from: Date = new Date('2026-04-21T00:00:00.000Z')): string {
  return new Date(from.getTime() - hours * 60 * 60 * 1000).toISOString();
}

const NOW = new Date('2026-04-21T00:00:00.000Z');

// --- matchesPatterns ---

describe('matchesPatterns', () => {
  it('matches high-confidence "PR merged"', () => {
    expect(matchesPatterns('PR merged to main', HIGH_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches high-confidence "resolved"', () => {
    expect(matchesPatterns('Resolved the flaky test issue', HIGH_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches high-confidence "fixed the bug"', () => {
    expect(matchesPatterns('Fixed the null pointer in auth', HIGH_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches high-confidence "deployed"', () => {
    expect(matchesPatterns('Deployed to production', HIGH_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches high-confidence "shipped"', () => {
    expect(matchesPatterns('Feature shipped', HIGH_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches high-confidence "status: done"', () => {
    expect(matchesPatterns('Status: done', HIGH_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('does not match unrelated text for high-confidence', () => {
    expect(matchesPatterns('Working on the migration', HIGH_CONFIDENCE_PATTERNS)).toBe(false);
  });

  it('matches low-confidence "done"', () => {
    expect(matchesPatterns('done', LOW_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches low-confidence "created PR"', () => {
    expect(matchesPatterns('Created PR #42', LOW_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('matches low-confidence "fixed"', () => {
    expect(matchesPatterns('Fixed', LOW_CONFIDENCE_PATTERNS)).toBe(true);
  });

  it('does not match random text for low-confidence', () => {
    expect(matchesPatterns('Investigating the issue now', LOW_CONFIDENCE_PATTERNS)).toBe(false);
  });
});

// --- classifyCommentAge ---

describe('classifyCommentAge', () => {
  it('returns "recent" for comment <2h old', () => {
    expect(classifyCommentAge(hoursAgo(1, NOW), NOW)).toBe('recent');
  });

  it('returns "warn" for comment exactly 2h old', () => {
    expect(classifyCommentAge(hoursAgo(2, NOW), NOW)).toBe('warn');
  });

  it('returns "warn" for comment 4h old', () => {
    expect(classifyCommentAge(hoursAgo(4, NOW), NOW)).toBe('warn');
  });

  it('returns "auto_close" for comment exactly 6h old', () => {
    expect(classifyCommentAge(hoursAgo(6, NOW), NOW)).toBe('auto_close');
  });

  it('returns "auto_close" for comment 12h old', () => {
    expect(classifyCommentAge(hoursAgo(12, NOW), NOW)).toBe('auto_close');
  });
});

// --- getCommentAgeMs ---

describe('getCommentAgeMs', () => {
  it('returns correct age in ms', () => {
    const age = getCommentAgeMs(hoursAgo(3, NOW), NOW);
    expect(age).toBe(3 * 60 * 60 * 1000);
  });
});

// --- getLastAgentComment ---

describe('getLastAgentComment', () => {
  it('returns the last comment by the assignee agent', () => {
    const comments = [
      makeComment({ id: 'c1', body: 'first', createdAt: hoursAgo(10, NOW) }),
      makeComment({ id: 'c2', body: 'second', createdAt: hoursAgo(5, NOW) }),
    ];
    expect(getLastAgentComment(comments, 'agent-1')?.id).toBe('c2');
  });

  it('returns undefined when no comments from assignee', () => {
    const comments = [makeComment({ authorAgentId: 'other-agent' })];
    expect(getLastAgentComment(comments, 'agent-1')).toBeUndefined();
  });

  it('returns undefined when assigneeAgentId is null', () => {
    const comments = [makeComment()];
    expect(getLastAgentComment(comments, null)).toBeUndefined();
  });
});

// --- hasCommentsAfter ---

describe('hasCommentsAfter', () => {
  it('returns true when a later comment exists', () => {
    const target = makeComment({ id: 'c1', createdAt: hoursAgo(5, NOW) });
    const later = makeComment({ id: 'c2', createdAt: hoursAgo(3, NOW), authorAgentId: 'other' });
    expect(hasCommentsAfter([target, later], target)).toBe(true);
  });

  it('returns false when no later comments', () => {
    const target = makeComment({ id: 'c1', createdAt: hoursAgo(3, NOW) });
    const earlier = makeComment({ id: 'c2', createdAt: hoursAgo(5, NOW) });
    expect(hasCommentsAfter([target, earlier], target)).toBe(false);
  });

  it('returns false for single comment thread', () => {
    const target = makeComment({ id: 'c1' });
    expect(hasCommentsAfter([target], target)).toBe(false);
  });
});

// --- shouldSkipIssue ---

describe('shouldSkipIssue', () => {
  it('skips issues with blockedByIssueIds', () => {
    const issue = makeIssue({ blockedBy: [{ id: 'blocker-1', status: 'in_progress' }] });
    expect(shouldSkipIssue(issue)).toBe(true);
  });

  it('does not skip issues with empty blockedBy', () => {
    const issue = makeIssue({ blockedBy: [] });
    expect(shouldSkipIssue(issue)).toBe(false);
  });

  it('does not skip issues with undefined blockedBy', () => {
    const issue = makeIssue({ blockedBy: undefined });
    expect(shouldSkipIssue(issue)).toBe(false);
  });
});

// --- determineAction (integration of all logic) ---

describe('determineAction', () => {
  it('returns null for issue with blockers', () => {
    const issue = makeIssue({ blockedBy: [{ id: 'b1', status: 'in_progress' }] });
    const comments = [makeComment({ body: 'PR merged', createdAt: hoursAgo(8, NOW) })];
    expect(determineAction(issue, comments, NOW)).toBeNull();
  });

  it('returns null when no agent comments', () => {
    const issue = makeIssue();
    const comments = [makeComment({ authorAgentId: 'other-agent', body: 'done' })];
    expect(determineAction(issue, comments, NOW)).toBeNull();
  });

  it('returns null when comments exist after the completion comment', () => {
    const issue = makeIssue();
    const comments = [
      makeComment({ id: 'c1', body: 'PR merged', createdAt: hoursAgo(8, NOW) }),
      makeComment({ id: 'c2', body: 'Wait, found a bug', createdAt: hoursAgo(7, NOW), authorAgentId: 'reviewer' }),
    ];
    expect(determineAction(issue, comments, NOW)).toBeNull();
  });

  it('returns null for recent comments (<2h)', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'PR merged', createdAt: hoursAgo(1, NOW) })];
    expect(determineAction(issue, comments, NOW)).toBeNull();
  });

  it('returns null for non-matching comment text', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'Investigating the issue', createdAt: hoursAgo(8, NOW) })];
    expect(determineAction(issue, comments, NOW)).toBeNull();
  });

  it('auto-closes for high-confidence + >6h', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'PR merged to main', createdAt: hoursAgo(8, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('auto_closed');
  });

  it('escalates for low-confidence + >6h', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'pushed the fix', createdAt: hoursAgo(8, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('escalated');
  });

  it('warns for high-confidence + 2-6h', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'Work is completed', createdAt: hoursAgo(3, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('warned');
  });

  it('warns for low-confidence + 2-6h', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'done', createdAt: hoursAgo(4, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('warned');
  });

  it('auto-closes for "resolved" keyword (high-confidence)', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'Resolved', createdAt: hoursAgo(7, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('auto_closed');
  });

  it('auto-closes for "fixed the issue" keyword (high-confidence)', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'Fixed the flaky test', createdAt: hoursAgo(7, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('auto_closed');
  });

  it('auto-closes for "deployed" without "to prod" (high-confidence)', () => {
    const issue = makeIssue();
    const comments = [makeComment({ body: 'Deployed', createdAt: hoursAgo(7, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('auto_closed');
  });

  it('works with in_review status', () => {
    const issue = makeIssue({ status: 'in_review' });
    const comments = [makeComment({ body: 'Shipped!', createdAt: hoursAgo(8, NOW) })];
    const action = determineAction(issue, comments, NOW);
    expect(action).not.toBeNull();
    expect(action!.action).toBe('auto_closed');
  });
});
