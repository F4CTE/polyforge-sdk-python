# Polyforge — Backup & Recovery Guide

> Backup strategy, retention policies, and recovery procedures for all Polyforge data stores.

---

## Overview

```
                    ┌─────────────────────────────────────┐
                    │         Backup Targets               │
                    ├─────────────────────────────────────┤
                    │  RDS PostgreSQL  → Automated snapshots│
                    │  ElastiCache Redis → Daily snapshots  │
                    │  EC2 EBS Volumes → AWS Backup          │
                    │  Application Data → .polyforge exports │
                    └─────────────────────────────────────┘
```

---

## Database Backups (RDS)

### Automated daily snapshots

RDS is configured with a **35-day retention period** (set via `--backup-retention-period 35` in the deployment guide). AWS takes a daily snapshot automatically during the configured backup window.

### Manual snapshots before major deployments

Always create a manual snapshot before schema migrations or major releases:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier polyforge-db \
  --db-snapshot-identifier "polyforge-pre-deploy-$(date +%Y%m%d-%H%M%S)"
```

Verify the snapshot completed:

```bash
aws rds describe-db-snapshots \
  --db-instance-identifier polyforge-db \
  --query 'DBSnapshots[-1].{Id:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}' \
  --output table
```

### Point-in-time recovery (PITR)

RDS supports point-in-time recovery to **any second within the last 35 days**. This uses continuous transaction log archiving, not just daily snapshots.

```bash
# Find the latest restorable time
aws rds describe-db-instances \
  --db-instance-identifier polyforge-db \
  --query 'DBInstances[0].LatestRestorableTime' --output text
```

### Cross-region snapshot copy for DR

For disaster recovery, copy the latest snapshot to a secondary region:

```bash
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier "polyforge-pre-deploy-20250101-120000" \
  --target-db-snapshot-identifier "polyforge-dr-20250101" \
  --source-region us-east-1 \
  --region us-west-2
```

---

## Steps to Restore from Snapshot

### 1 — Create new RDS instance from snapshot

```bash
# Restore from a named snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier polyforge-db-restored \
  --db-snapshot-identifier "polyforge-pre-deploy-20250101-120000" \
  --db-instance-class db.t3.medium \
  --no-publicly-accessible

# Or restore to a specific point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier polyforge-db \
  --target-db-instance-identifier polyforge-db-restored \
  --restore-time "2025-01-15T14:30:00Z" \
  --db-instance-class db.t3.medium \
  --no-publicly-accessible
```

Wait for the instance to become available:

```bash
aws rds wait db-instance-available --db-instance-identifier polyforge-db-restored
```

### 2 — Update PgBouncer connection strings

Get the new endpoint:

```bash
NEW_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier polyforge-db-restored \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "New endpoint: $NEW_ENDPOINT"
```

Update `/opt/polyforge/.env.prod`:

```bash
ssh -i ~/.ssh/polyforge.pem ec2-user@$EC2_HOST
cd /opt/polyforge

# Update DATABASE_URL and DIRECT_DATABASE_URL with the new endpoint
sed -i "s|@.*:5432/polymarket|@$NEW_ENDPOINT:5432/polymarket|g" .env.prod
```

### 3 — Verify data integrity

```bash
# Connect and run basic checks
psql -h $NEW_ENDPOINT -U poly -d polymarket -c "
  SELECT COUNT(*) AS users FROM users;
  SELECT COUNT(*) AS strategies FROM strategies;
  SELECT COUNT(*) AS orders FROM orders;
  SELECT MAX(created_at) AS latest_record FROM audit_logs;
"
```

### 4 — Switch DNS (if multi-region)

If restoring in a different region, update the DNS A record for `polyforge.app` to point to the new region's EC2 instance.

### 5 — Restart services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate
curl -s https://polyforge.app/api/v1/health | jq .
```

---

## Redis Backup

### ElastiCache daily snapshots

ElastiCache takes daily automatic snapshots. Configure retention:

```bash
aws elasticache modify-replication-group \
  --replication-group-id polyforge-redis \
  --snapshot-retention-limit 7 \
  --snapshot-window "03:00-04:00"
```

### Manual Redis backup

Create an on-demand snapshot before deployments:

```bash
aws elasticache create-snapshot \
  --replication-group-id polyforge-redis \
  --snapshot-name "polyforge-redis-pre-deploy-$(date +%Y%m%d)"
```

### Redis RDB export for manual backup

Export a snapshot to S3 for long-term retention:

```bash
aws elasticache copy-snapshot \
  --source-snapshot-name "polyforge-redis-pre-deploy-20250101" \
  --target-snapshot-name "polyforge-redis-export-20250101" \
  --target-bucket "polyforge-backups"
```

### Redis recovery

Restore from snapshot:

```bash
aws elasticache create-replication-group \
  --replication-group-id polyforge-redis-restored \
  --replication-group-description "Restored Polyforge Redis" \
  --snapshot-name "polyforge-redis-pre-deploy-20250101" \
  --cache-node-type cache.t3.micro \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled
```

> **Note:** Redis is used as a cache and for ephemeral state (feature flags, rate limiters). If a snapshot is unavailable, Redis can be rebuilt from scratch — cache is transient and will repopulate on its own. Feature flags (e.g., `config:invite_only`) will need to be re-set via the admin panel.

---

## EBS Volumes

### EC2 EBS snapshots via AWS Backup

Configure AWS Backup to snapshot the EC2 EBS volume daily:

```bash
# Create a backup plan
aws backup create-backup-plan --backup-plan '{
  "BackupPlanName": "polyforge-ebs-daily",
  "Rules": [{
    "RuleName": "daily-ebs",
    "TargetBackupVaultName": "Default",
    "ScheduleExpression": "cron(0 5 * * ? *)",
    "Lifecycle": { "DeleteAfterDays": 30 }
  }]
}'
```

### Automated lifecycle policy

Use Amazon Data Lifecycle Manager to automate EBS snapshot retention:

```bash
aws dlm create-lifecycle-policy \
  --description "Polyforge EBS snapshots" \
  --state ENABLED \
  --execution-role-arn "arn:aws:iam::role/AWSDataLifecycleManagerDefaultRole" \
  --policy-details '{
    "PolicyType": "EBS_SNAPSHOT_MANAGEMENT",
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [{"Key": "Project", "Value": "polyforge"}],
    "Schedules": [{
      "Name": "daily",
      "CreateRule": { "Interval": 24, "IntervalUnit": "HOURS" },
      "RetainRule": { "Count": 14 }
    }]
  }'
```

---

## Application Data

### Strategy export (.polyforge files)

Users can export their strategies as `.polyforge` files from the UI. This serves as a user-level backup of strategy configurations, block layouts, and parameters.

These exports are JSON files that can be re-imported to recreate strategies on any Polyforge instance.

### Audit logs

Audit logs are **append-only** — enforced by a PostgreSQL INSERT-only rule on the `audit_logs` table. Audit data is never modified or deleted during normal operations. Logs are included in all RDS snapshots and PITR restores.

---

## Recovery Time Objectives

| Metric | Target | Method |
|--------|--------|--------|
| **RTO** (Recovery Time Objective) | < 1 hour | Restore from RDS snapshot + service restart |
| **RPO** (Recovery Point Objective) | < 5 minutes | PITR via continuous transaction log archiving |

### Breakdown

| Recovery step | Expected time |
|---------------|---------------|
| Create RDS instance from snapshot | ~20 minutes |
| Update connection strings | ~5 minutes |
| Verify data integrity | ~5 minutes |
| Restart services | ~5 minutes |
| Smoke test | ~5 minutes |
| **Total** | **~40 minutes** |

---

## Backup Verification Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Verify RDS automated snapshots exist | Weekly | DevOps |
| Test PITR restore to a throwaway instance | Monthly | DevOps |
| Verify ElastiCache snapshots exist | Weekly | DevOps |
| Test full recovery runbook (end-to-end) | Quarterly | Team |
| Verify cross-region snapshot copy | Monthly | DevOps |

---

*Previous: [Launch Runbook](./03-launch-runbook.md) | Next: [Incident Response](./05-incident-response.md)*
