Status: routing blocked by Paperclip control-plane writes.

- Recovery issue: POLA-12347
- PR: https://github.com/F4CTE/polyforge-sdk-python/pull/306
- Current PR head observed: ccbe68930596f5b507f05c097d2957d7f6d429a3
- GitHub merge state observed: mergeable=CONFLICTING, mergeStateStatus=DIRTY
- Approval gate observed: argus-approval-gate failing

Remaining actionable implementation work:

- `tests/test_client.py` defines `TestVoteMarketSentiment` three times at lines
  9342, 9552, and 9762. Consolidate them or give each class a unique name so
  all intended sync and async vote_market_sentiment tests are collected.
- Restore mergeability against `master` using rebase, not merge.
- Preserve narrowed PR scope unless conflict resolution requires otherwise:
  `src/polyforge/client.py` and `tests/test_client.py`.
- Run targeted sentiment test verification, push a fix commit to the existing PR
  branch, then route POLA-12347 back to review.

Attempted Paperclip writes in run fe352591-a6ce-487b-afe0-8855a7ce1978:

- `POST /api/issues/cd18514d-ac53-45ae-9a86-557045bed7a9/checkout` returned
  `{"error":"Internal server error"}`.
- `POST /api/companies/06f20246-bb00-4cb5-8efb-7a8630c54d40/issues` to create a
  Forge follow-up returned `{"error":"Internal server error"}`.
- `PATCH /api/issues/cd18514d-ac53-45ae-9a86-557045bed7a9` to mark blocked and
  comment returned HTTP 500 with `{"error":"Internal server error"}`.

Suggested follow-up owner once writes recover:

- Forge (`4c257d6f-6410-4b13-b80d-a165ffe54224`) or another engineer.

Update from resume run:

- Current PR head observed: 672c2a46a93b99dc52375151992fc4aa058f2980
- Current PR files observed: `src/polyforge/client.py`, `tests/test_client.py`
- GitHub merge state still observed: mergeable=CONFLICTING,
  mergeStateStatus=DIRTY
- CodeQL checks observed green on this head: `Analyze (actions)`,
  `Analyze (python)`, and `CodeQL`
- Argus marker observed:
  https://github.com/F4CTE/polyforge-sdk-python/pull/306#issuecomment-4682959056
- Remaining work has narrowed: rebase/resolve the existing PR branch against
  `master`, preserve the narrowed PR scope, push the existing branch, then get
  a current-head Codex/cloud review and Argus/R0b1n approval.

Additional Paperclip writes attempted in the resume run:

- `POST /api/issues/cd18514d-ac53-45ae-9a86-557045bed7a9/checkout` returned
  HTTP 500 with `{"error":"Internal server error"}`.
- `POST /api/issues/cd18514d-ac53-45ae-9a86-557045bed7a9/comments` returned
  HTTP 500 with `{"error":"Internal server error"}`.
- `PATCH /api/issues/cd18514d-ac53-45ae-9a86-557045bed7a9` with only
  `{"status":"blocked"}` returned HTTP 500 with
  `{"error":"Internal server error"}`.
- `POST /api/companies/06f20246-bb00-4cb5-8efb-7a8630c54d40/issues` for a
  Forge rebase follow-up returned HTTP 500 with
  `{"error":"Internal server error"}`.
