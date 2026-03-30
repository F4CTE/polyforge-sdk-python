# Polyforge — Incident Response Plan

> Procedures for detecting, responding to, and recovering from production incidents.

---

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0** | Total outage, data loss, security breach | < 15 min | All services down, credential leak, database corruption |
| **P1** | Major feature broken, significant degradation | < 30 min | Strategy engine crash, orders not processing, auth failures |
| **P2** | Minor feature broken, workaround available | < 2 hours | Leaderboard error, email delays, bot notifications failing |
| **P3** | Cosmetic, non-urgent | Next business day | UI glitch, minor display issue, typo in email template |

---

## Detection

Incidents are detected via:

1. **CloudWatch Alarms** — CPU, memory, disk, error rates, RDS health
2. **Health endpoints** — `/api/v1/health` and `/auth/v1/health` polled every 60 seconds
3. **User reports** — via Telegram, Discord, or email
4. **Log monitoring** — CloudWatch Logs error patterns
5. **Admin panel** — Dashboard → Health shows service-level status

---

## Response Procedures

### Step 1 — Acknowledge incident

- Log the incident with timestamp, reporter, and initial symptoms
- Assign a severity level (P0–P3)
- Notify the on-call engineer

### Step 2 — Assess severity and impact

```bash
# Check all service health
curl -s https://polyforge.app/api/v1/health | jq .
curl -s https://polyforge.app/auth/v1/health | jq .
curl -s https://admin.polyforge.app/api/v1/health | jq .

# Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM --region us-east-1 \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Reason:StateReason}' \
  --output table

# Check service logs for errors
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
docker compose -f docker-compose.prod.yml logs --tail 100 --since 10m 2>&1 | grep -i error
```

### Step 3 — Communicate to stakeholders

- **P0/P1:** Immediate notification to entire team (Slack/Discord)
- **P0:** Post status page update within 15 minutes
- **P2:** Update assigned engineer, log in issue tracker
- **P3:** Add to backlog

### Step 4 — Investigate root cause

```bash
# Service-specific logs
docker compose -f docker-compose.prod.yml logs <service-name> --tail 200 -f

# Database connectivity
docker exec polyforge_api-service sh -c "npx prisma db execute --stdin <<< 'SELECT 1'"

# Redis connectivity
docker exec polyforge_api-service sh -c "redis-cli -u \$REDIS_URL ping"

# Check resource utilization
docker stats --no-stream
df -h
free -m
```

### Step 5 — Implement fix or rollback

See **Rollback Procedures** below. If the fix is straightforward, apply it directly. If not, roll back first and investigate offline.

### Step 6 — Verify resolution

```bash
# Full health check
curl -s https://polyforge.app/api/v1/health | jq .

# End-to-end verification
curl -s -X POST https://polyforge.app/auth/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}' | jq .status

# Monitor logs for 10 minutes
docker compose -f docker-compose.prod.yml logs -f --since 1m
```

### Step 7 — Post-mortem within 48 hours

All P0 and P1 incidents require a written post-mortem. P2 incidents get a post-mortem at team discretion.

---

## Rollback Procedures

### Application rollback — previous Docker images

```bash
# Roll back all services to a previous image tag
bash scripts/deploy.sh --tag <previous-tag>

# Or roll back a single service
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
cd /opt/polyforge

ECR_BASE=<account-id>.dkr.ecr.us-east-1.amazonaws.com
docker pull $ECR_BASE/polyforge/<service-name>:<previous-tag>
docker compose -f docker-compose.prod.yml up -d <service-name>
```

### Database rollback — restore from snapshot

If a migration caused data issues, restore from the pre-deploy snapshot:

```bash
# List recent snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier polyforge-db \
  --query 'DBSnapshots[-5:].{Id:DBSnapshotIdentifier,Created:SnapshotCreateTime}' \
  --output table

# Restore (see 04-backup-recovery.md for full procedure)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier polyforge-db-restored \
  --db-snapshot-identifier "<pre-deploy-snapshot-id>" \
  --db-instance-class db.t3.medium \
  --no-publicly-accessible
```

### Feature flag rollback — Redis toggle

Some features can be disabled without a deploy:

```bash
# Toggle invite-only mode via admin API
ADMIN_TOKEN="<admin_jwt>"
curl -s -X PATCH https://admin.polyforge.app/api/v1/config/invite-only \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

Or connect to Redis directly to toggle flags:

```bash
docker exec polyforge_api-service sh -c \
  "redis-cli -u \$REDIS_URL SET config:invite_only true"
```

---

## Escalation Matrix

| Severity | Who to notify | Communication channel |
|----------|---------------|----------------------|
| **P0** | Entire team + notify users | Slack/Discord #incidents, status page, user email |
| **P1** | Backend engineer + DevOps | Slack/Discord #incidents |
| **P2** | Assigned engineer | Issue tracker + Slack |
| **P3** | Backlog | Issue tracker |

### Escalation timeline

| Time elapsed | Action |
|-------------|--------|
| 0 min | On-call engineer acknowledges |
| 15 min (P0) / 30 min (P1) | If no progress, escalate to next engineer |
| 1 hour | If unresolved P0, all-hands response |
| 4 hours | If unresolved P0/P1, evaluate rollback as mandatory |

---

## Communication Templates

### Status page — investigating

```
[Investigating] We are currently investigating reports of [brief description].
Some users may experience [impact]. We will provide updates as we learn more.
```

### Status page — identified

```
[Identified] The issue has been identified as [root cause summary].
We are implementing a fix. Estimated resolution: [time estimate].
```

### Status page — resolved

```
[Resolved] The issue affecting [feature/service] has been resolved.
All services are operating normally. We apologize for the inconvenience.
A detailed post-mortem will be published within 48 hours.
```

### User email — outage notification

```
Subject: Polyforge Service Disruption — [Date]

Hi [Name],

We experienced a service disruption today affecting [description].
The issue lasted from [start time] to [end time] UTC.

What happened: [brief, non-technical explanation]
What we did: [resolution summary]
What we're doing to prevent this: [preventive measures]

We apologize for any inconvenience. If you have questions, reply to this email
or reach out on Discord.

— The Polyforge Team
```

### Internal Slack/Discord notification

```
🚨 **P[0/1] Incident — [Title]**
**Status:** Investigating / Identified / Resolved
**Impact:** [What users are experiencing]
**Started:** [timestamp UTC]
**Lead:** [engineer name]
**Thread:** [link to incident thread]
```

---

## Post-Mortem Template

Use this template for all P0/P1 post-mortems. Store completed post-mortems in `docs/post-mortems/`.

```markdown
# Post-Mortem: [Incident Title]

**Date:** YYYY-MM-DD
**Severity:** P0 / P1
**Duration:** [start time] — [end time] UTC ([total duration])
**Author:** [name]
**Status:** Draft / Final

## Summary

[1–2 sentence description of what happened and the impact.]

## Timeline (all times UTC)

| Time | Event |
|------|-------|
| HH:MM | [First sign of issue] |
| HH:MM | [Alert triggered / user report] |
| HH:MM | [Investigation started] |
| HH:MM | [Root cause identified] |
| HH:MM | [Fix deployed / rollback executed] |
| HH:MM | [Service restored] |

## Root Cause

[Detailed technical explanation of what went wrong and why.]

## Impact

- **Users affected:** [number or percentage]
- **Duration:** [minutes/hours]
- **Data loss:** [none / description]
- **Revenue impact:** [none / description]

## Resolution

[What was done to fix the issue. Include commands, PRs, or config changes.]

## Action Items

| Action | Owner | Priority | Due |
|--------|-------|----------|-----|
| [Preventive measure] | [name] | P1 | [date] |
| [Monitoring improvement] | [name] | P2 | [date] |
| [Documentation update] | [name] | P3 | [date] |

## Lessons Learned

- What went well: [detection speed, communication, etc.]
- What went poorly: [gaps in monitoring, slow response, etc.]
- Where we got lucky: [things that could have been worse]
```

---

*Previous: [Backup & Recovery](./04-backup-recovery.md) | Next: [Performance Tuning](./06-performance-tuning.md)*
