import { describe, it, expect } from 'vitest';
import {
  isRealFailure,
  isPending,
  classifyPR,
  extractRunId,
  formatFailureComment,
  formatStaleComment,
  formatSummaryComment,
  EXPECTED_BRANCH_FAILURES,
  STALE_PR_DAYS,
  type CheckRun,
  type PRData,
  type CIFailure,
  type StalePR,
  type MonitorResult,
} from './ci-monitor';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeCheck(overrides: Partial<CheckRun> = {}): CheckRun {
  return {
    __typename: 'CheckRun',
    name: 'Lint',
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: 'https://github.com/F4CTE/PolyForge/actions/runs/123/job/456',
    workflowName: 'CI',
    completedAt: '2026-04-21T10:00:00Z',
    startedAt: '2026-04-21T09:58:00Z',
    ...overrides,
  };
}

function makePR(overrides: Partial<PRData> = {}): PRData {
  return {
    number: 100,
    title: 'Test PR',
    headRefName: 'fix/test',
    updatedAt: '2026-04-21T10:00:00Z',
    author: { login: 'F4CTE', name: 'Shems' },
    statusCheckRollup: [],
    url: 'https://github.com/F4CTE/PolyForge/pull/100',
    repo: 'F4CTE/PolyForge',
    ...overrides,
  };
}

// ─── isRealFailure ───────────────────────────────────────────────────

describe('isRealFailure', () => {
  it('returns true for a completed check with FAILURE conclusion', () => {
    expect(isRealFailure(makeCheck({ conclusion: 'FAILURE' }))).toBe(true);
  });

  it('returns false for a successful check', () => {
    expect(isRealFailure(makeCheck({ conclusion: 'SUCCESS' }))).toBe(false);
  });

  it('returns false for a skipped check', () => {
    expect(isRealFailure(makeCheck({ conclusion: 'SKIPPED' }))).toBe(false);
  });

  it('returns false for an in-progress check', () => {
    expect(isRealFailure(makeCheck({ status: 'IN_PROGRESS', conclusion: null }))).toBe(false);
  });

  it('returns false for expected branch failures (Deploy to Dev)', () => {
    expect(isRealFailure(makeCheck({ name: 'Deploy to Dev', conclusion: 'FAILURE' }))).toBe(false);
  });

  it('returns false for expected branch failures (Deploy to Production)', () => {
    expect(isRealFailure(makeCheck({ name: 'Deploy to Production', conclusion: 'FAILURE' }))).toBe(false);
  });

  it('returns true for non-deploy failures', () => {
    expect(isRealFailure(makeCheck({ name: 'Test', conclusion: 'FAILURE' }))).toBe(true);
    expect(isRealFailure(makeCheck({ name: 'Build', conclusion: 'FAILURE' }))).toBe(true);
    expect(isRealFailure(makeCheck({ name: 'Lint', conclusion: 'FAILURE' }))).toBe(true);
  });
});

// ─── isPending ───────────────────────────────────────────────────────

describe('isPending', () => {
  it('returns true for IN_PROGRESS status', () => {
    expect(isPending(makeCheck({ status: 'IN_PROGRESS' }))).toBe(true);
  });

  it('returns true for QUEUED status', () => {
    expect(isPending(makeCheck({ status: 'QUEUED' }))).toBe(true);
  });

  it('returns true for PENDING status', () => {
    expect(isPending(makeCheck({ status: 'PENDING' }))).toBe(true);
  });

  it('returns false for COMPLETED status', () => {
    expect(isPending(makeCheck({ status: 'COMPLETED' }))).toBe(false);
  });
});

// ─── classifyPR ──────────────────────────────────────────────────────

describe('classifyPR', () => {
  const now = new Date('2026-04-21T12:00:00Z');

  it('classifies a PR with no checks as clean and not stale', () => {
    const pr = makePR({ updatedAt: '2026-04-21T10:00:00Z', statusCheckRollup: [] });
    const result = classifyPR(pr, now);
    expect(result.failed).toHaveLength(0);
    expect(result.pending).toHaveLength(0);
    expect(result.isStale).toBe(false);
    expect(result.daysSinceUpdate).toBe(0);
  });

  it('detects real failures in statusCheckRollup', () => {
    const pr = makePR({
      statusCheckRollup: [
        makeCheck({ name: 'Lint', conclusion: 'SUCCESS' }),
        makeCheck({ name: 'Test', conclusion: 'FAILURE' }),
        makeCheck({ name: 'Deploy to Dev', conclusion: 'FAILURE' }),
      ],
    });
    const result = classifyPR(pr, now);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].name).toBe('Test');
  });

  it('detects pending checks', () => {
    const pr = makePR({
      statusCheckRollup: [
        makeCheck({ name: 'Build', status: 'IN_PROGRESS', conclusion: null }),
        makeCheck({ name: 'Lint', status: 'COMPLETED', conclusion: 'SUCCESS' }),
      ],
    });
    const result = classifyPR(pr, now);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].name).toBe('Build');
  });

  it('detects stale PRs beyond threshold', () => {
    const staleDate = new Date(now.getTime() - (STALE_PR_DAYS + 1) * 24 * 60 * 60 * 1000);
    const pr = makePR({ updatedAt: staleDate.toISOString() });
    const result = classifyPR(pr, now);
    expect(result.isStale).toBe(true);
    expect(result.daysSinceUpdate).toBeGreaterThanOrEqual(STALE_PR_DAYS);
  });

  it('marks recent PRs as not stale', () => {
    const pr = makePR({ updatedAt: '2026-04-20T10:00:00Z' });
    const result = classifyPR(pr, now);
    expect(result.isStale).toBe(false);
  });

  it('handles null statusCheckRollup gracefully', () => {
    const pr = makePR({ statusCheckRollup: undefined as any });
    const result = classifyPR(pr, now);
    expect(result.failed).toHaveLength(0);
    expect(result.pending).toHaveLength(0);
  });
});

// ─── extractRunId ────────────────────────────────────────────────────

describe('extractRunId', () => {
  it('extracts run ID from a details URL', () => {
    expect(extractRunId('https://github.com/F4CTE/PolyForge/actions/runs/24731643765/job/72347440525'))
      .toBe('24731643765');
  });

  it('returns null for a URL without a run ID', () => {
    expect(extractRunId('https://github.com/F4CTE/PolyForge')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractRunId('')).toBeNull();
  });
});

// ─── formatFailureComment ────────────────────────────────────────────

describe('formatFailureComment', () => {
  it('returns empty string for no failures', () => {
    expect(formatFailureComment([])).toBe('');
  });

  it('formats a single failure with check details', () => {
    const failures: CIFailure[] = [{
      repo: 'F4CTE/PolyForge',
      pr: makePR({ number: 42, title: 'fix: broken lint', headRefName: 'fix/lint' }),
      failedChecks: [makeCheck({ name: 'Lint', conclusion: 'FAILURE' })],
    }];

    const result = formatFailureComment(failures);
    expect(result).toContain('CI Failure Report');
    expect(result).toContain('F4CTE/PolyForge#42');
    expect(result).toContain('fix: broken lint');
    expect(result).toContain('**Lint**');
    expect(result).toContain('View logs');
  });

  it('formats multiple failures across repos', () => {
    const failures: CIFailure[] = [
      {
        repo: 'F4CTE/PolyForge',
        pr: makePR({ number: 1 }),
        failedChecks: [makeCheck({ name: 'Test', conclusion: 'FAILURE' })],
      },
      {
        repo: 'F4CTE/polyforge-mcp',
        pr: makePR({ number: 2, repo: 'F4CTE/polyforge-mcp' }),
        failedChecks: [makeCheck({ name: 'Build', conclusion: 'FAILURE' })],
      },
    ];

    const result = formatFailureComment(failures);
    expect(result).toContain('F4CTE/PolyForge#1');
    expect(result).toContain('F4CTE/polyforge-mcp#2');
  });
});

// ─── formatStaleComment ──────────────────────────────────────────────

describe('formatStaleComment', () => {
  it('returns empty string for no stale PRs', () => {
    expect(formatStaleComment([])).toBe('');
  });

  it('formats stale PRs with CI status', () => {
    const stalePRs: StalePR[] = [{
      repo: 'F4CTE/PolyForge',
      pr: makePR({ number: 99, title: 'old feature' }),
      daysSinceUpdate: 14,
      hasCIFailure: true,
    }];

    const result = formatStaleComment(stalePRs);
    expect(result).toContain('Stale PR Report');
    expect(result).toContain('14d stale');
    expect(result).toContain('CI failing');
  });

  it('shows CI passing for stale PRs without failures', () => {
    const stalePRs: StalePR[] = [{
      repo: 'F4CTE/PolyForge',
      pr: makePR(),
      daysSinceUpdate: 10,
      hasCIFailure: false,
    }];

    const result = formatStaleComment(stalePRs);
    expect(result).toContain('CI passing');
  });
});

// ─── formatSummaryComment ────────────────────────────────────────────

describe('formatSummaryComment', () => {
  it('formats a clean run with no failures', () => {
    const result: MonitorResult = {
      scannedRepos: 5,
      totalPRs: 10,
      failures: [],
      stalePRs: [],
      pendingPRs: [],
      timestamp: '2026-04-21T12:00:00.000Z',
    };

    const output = formatSummaryComment(result);
    expect(output).toContain('CI/CD Monitor');
    expect(output).toContain('5** repos');
    expect(output).toContain('10** open PRs');
    expect(output).toContain('No CI failures detected');
  });

  it('includes failure section when failures exist', () => {
    const result: MonitorResult = {
      scannedRepos: 5,
      totalPRs: 3,
      failures: [{
        repo: 'F4CTE/PolyForge',
        pr: makePR(),
        failedChecks: [makeCheck({ name: 'Test', conclusion: 'FAILURE' })],
      }],
      stalePRs: [],
      pendingPRs: [],
      timestamp: '2026-04-21T12:00:00.000Z',
    };

    const output = formatSummaryComment(result);
    expect(output).toContain('Failures (1)');
    expect(output).toContain('CI Failure Report');
  });

  it('includes pending CI section', () => {
    const result: MonitorResult = {
      scannedRepos: 5,
      totalPRs: 2,
      failures: [],
      stalePRs: [],
      pendingPRs: [{
        repo: 'F4CTE/PolyForge',
        pr: makePR(),
        pendingChecks: [makeCheck({ name: 'Build', status: 'IN_PROGRESS' })],
      }],
      timestamp: '2026-04-21T12:00:00.000Z',
    };

    const output = formatSummaryComment(result);
    expect(output).toContain('Pending CI (1 PRs still running)');
    expect(output).toContain('Build');
  });
});

// ─── EXPECTED_BRANCH_FAILURES ────────────────────────────────────────

describe('EXPECTED_BRANCH_FAILURES', () => {
  it('contains deploy steps', () => {
    expect(EXPECTED_BRANCH_FAILURES).toContain('Deploy to Dev');
    expect(EXPECTED_BRANCH_FAILURES).toContain('Deploy to Production');
  });

  it('does not contain core CI steps', () => {
    expect(EXPECTED_BRANCH_FAILURES).not.toContain('Lint');
    expect(EXPECTED_BRANCH_FAILURES).not.toContain('Test');
    expect(EXPECTED_BRANCH_FAILURES).not.toContain('Build');
  });
});
