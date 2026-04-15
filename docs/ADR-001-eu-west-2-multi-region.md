# ADR-001 — eu-west-2 Multi-Region Deployment

**Status:** Proposed  
**Date:** 2026-04-15  
**Author:** Hephaestus (CTO)  
**Ticket:** [POLA-11](/POLA/issues/POLA-11)

---

## Context

PolyForge currently runs exclusively in **us-east-1** (N. Virginia):

| Component | Current spec |
|---|---|
| EC2 | c5.2xlarge (8 vCPU / 16 GB) |
| RDS | PostgreSQL 16 + TimescaleDB — db.r6g.large, Multi-AZ |
| ElastiCache | Redis 7 — cache.r7g.large, replication group |
| Estimated cost | ~$650/month |

EU users experience 80–150 ms added round-trip latency vs. a London-based deployment.
Regulated EU markets (GDPR, future MiFID telemetry) may require data-residency options.

---

## Decision

Deploy an **active-passive secondary region** in **eu-west-2 (London)**.

### Architecture Pattern: Active-Passive with Cross-Region Primary DB

```
┌────────────────────────────────────────────────────────┐
│  Route53 Latency-Based Routing (polyforge.app)         │
│    EU  requests → eu-west-2 ALB / EC2 Elastic IP       │
│    US  requests → us-east-1 EC2 Elastic IP             │
└────────────────────┬───────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
  ┌──────────────┐        ┌──────────────┐
  │ us-east-1    │        │ eu-west-2    │
  │ (primary)    │        │ (secondary)  │
  │              │        │              │
  │ EC2          │        │ EC2          │
  │ c5.2xlarge   │        │ c5.xlarge    │  ← smaller; EU traffic is additive
  │ 13 services  │        │ 13 services  │
  │              │        │              │
  │ RDS PRIMARY  │◄───────│ (writes via  │
  │ Multi-AZ     │  SSL   │  cross-region│
  │              │  TCP   │  connection) │
  │ ElastiCache  │        │ ElastiCache  │
  │ r7g.large    │        │ t4g.medium   │  ← lighter; caching only
  └──────────────┘        └──────────────┘
```

**Key choices:**

| Decision point | Choice | Rationale |
|---|---|---|
| Active-Active vs Active-Passive | **Active-Passive** | TimescaleDB hypertables + trading state make conflict resolution prohibitively complex at this stage |
| Database strategy | **Cross-region write** to us-east-1 primary via SSL | Simplest path; RDS Multi-AZ already handles HA. Cross-region DB latency (~70 ms) is acceptable for trading operations |
| Redis | **Independent ElastiCache** in eu-west-2 | Redis holds ephemeral cache, rate-limit counters, pub/sub — no need for cross-region consistency |
| Services | **All 13 services** deployed to eu-west-2 | signer-service is stateless; market-data-service subscribes to Polymarket global WebSocket independently per region |
| ECR | **Cross-region replication** from us-east-1 ECR | Single push, both regions pull locally |
| Secrets | **Replicate to eu-west-2 Secrets Manager** | Services need identical secrets; avoid cross-region Secrets Manager calls on hot paths |
| Traffic routing | **Route53 latency routing** | Zero-downtime; users automatically route to nearest healthy endpoint |
| CI/CD | **Parallel deploy** to both regions in GitHub Actions deploy job | Same image tag, same scripts |

### What is NOT in scope for this ADR

- Active-active writes (future ADR once traffic justifies complexity)
- RDS read replica in eu-west-2 (no read-only Prisma client in app today; deferred to post-launch)
- Global Accelerator (Route53 latency routing is sufficient for V1)
- GDPR data residency isolation (future ADR — today all writes still hit us-east-1)

---

## Consequences

### Cost impact

| Addition | Monthly |
|---|---|
| EC2 c5.xlarge eu-west-2 | ~$140 |
| ElastiCache cache.t4g.medium eu-west-2 | ~$35 |
| Cross-region data transfer (~50 GB/mo) | ~$10 |
| Secrets Manager (eu-west-2) | ~$1 |
| CloudWatch eu-west-2 | ~$3 |
| **Additional monthly cost** | **~$189/month** |
| **New total** | **~$839/month** |

Current budget: **~$650/month**  
Overage: **+$189/month (+29%)**

> **Escalation required** — this exceeds the current infrastructure budget. Board approval needed before implementation.

### Risks

| Risk | Mitigation |
|---|---|
| Cross-region DB latency (~70 ms us-east-1 ↔ eu-west-2) | Acceptable for trading; test under load |
| RDS security group must allow eu-west-2 EC2 traffic | Add CIDR rule for eu-west-2 EC2 private IP in us-east-1 RDS SG |
| Secret drift between regions | Secrets Manager replication policy + IaC-enforced |
| Partial failure (one region down) | Route53 health checks fail-over automatically |
| Increased CI/CD complexity | Add eu-west-2 deploy step, same script |

---

## Implementation Plan

See [POLA-11 plan document](/POLA/issues/POLA-11#document-plan) for the detailed phased implementation.

---

## Alternatives Considered

### A. CloudFront + Lambda@Edge (static assets only)

Improves static asset latency without new regions. Does not help API or WebSocket latency. Rejected as insufficient.

### B. AWS Global Accelerator

Routes TCP/UDP to nearest region using AWS backbone. Adds ~$50/mo. Deferred — Route53 latency routing is simpler and sufficient for V1.

### C. Full Active-Active (multi-master)

Requires distributed write coordination, conflict resolution, and major application changes. Rejected for V1 — reserved for post-product-market-fit if warranted.
