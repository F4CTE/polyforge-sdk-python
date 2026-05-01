import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("../..", import.meta.url).pathname;
const terraformDir = join(repoRoot, "infra", "terraform");

function readTerraform(file) {
  return readFileSync(join(terraformDir, file), "utf8");
}

function allTerraform() {
  return readdirSync(terraformDir)
    .filter((file) => file.endsWith(".tf"))
    .map((file) => readTerraform(file))
    .join("\n");
}

function resourceBlock(source, type, name) {
  const marker = `resource "${type}" "${name}"`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} is missing`);

  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, `${marker} has no body`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }

  assert.fail(`${marker} has an unterminated body`);
}

test("Terraform references the Redis replication group instead of a nonexistent cluster", () => {
  const source = allTerraform();
  const secrets = readTerraform("secrets.tf");

  assert.equal(
    source.includes("aws_elasticache_cluster.main"),
    false,
    "aws_elasticache_cluster.main is not declared and breaks terraform plan",
  );
  assert.match(source, /aws_elasticache_replication_group\.main/);
  assert.match(
    secrets,
    /REDIS_URL\s*=\s*"rediss:\/\/:\$\{var\.redis_auth_token\}@\$\{aws_elasticache_replication_group\.main\.primary_endpoint_address\}:6379\/0"/,
  );
});

test("ElastiCache CloudWatch metrics are scoped to per-node cache clusters", () => {
  const source = readTerraform("cloudwatch.tf");
  const memory = resourceBlock(source, "aws_cloudwatch_metric_alarm", "redis_memory_high");
  const connections = resourceBlock(source, "aws_cloudwatch_metric_alarm", "redis_connections_high");

  assert.match(memory, /for_each\s*=\s*toset\(local\.redis_member_cluster_ids\)/);
  assert.match(memory, /CacheClusterId\s*=\s*each\.key/);
  assert.doesNotMatch(memory, /ReplicationGroupId/);

  assert.match(connections, /for_each\s*=\s*toset\(local\.redis_member_cluster_ids\)/);
  assert.match(connections, /CacheClusterId\s*=\s*each\.key/);
  assert.doesNotMatch(connections, /ReplicationGroupId/);
});

test("ElastiCache Redis enables at-rest encryption", () => {
  const source = readTerraform("elasticache.tf");
  const redis = resourceBlock(source, "aws_elasticache_replication_group", "main");

  assert.match(redis, /transit_encryption_enabled\s*=\s*true/);
  assert.match(redis, /at_rest_encryption_enabled\s*=\s*true/);
  assert.match(redis, /auth_token\s*=\s*var\.redis_auth_token/);
});

test("RDS backup failure alert uses PostgreSQL-compatible RDS events", () => {
  const source = readTerraform("cloudwatch.tf");
  const alertsPolicy = resourceBlock(source, "aws_sns_topic_policy", "alerts");

  assert.equal(
    source.includes("FailedSQLServerAgentJobsCount"),
    false,
    "SQL Server agent metric never emits for PostgreSQL RDS",
  );
  assert.match(
    source,
    /resource "aws_cloudwatch_event_rule" "rds_backup_failed"/,
  );
  assert.match(source, /"RDS-EVENT-0009"/);
  assert.match(
    source,
    /resource "aws_cloudwatch_event_target" "rds_backup_failed_alert"/,
  );
  assert.equal(
    source.includes('resource "aws_sns_topic_policy" "alerts_eventbridge"'),
    false,
    "the alerts SNS topic must be owned by a single topic policy resource",
  );
  assert.match(alertsPolicy, /Sid\s*=\s*"AllowElastiCachePublish"/);
  assert.match(alertsPolicy, /Sid\s*=\s*"AllowEventBridgePublish"/);
  assert.match(
    alertsPolicy,
    /Principal\s*=\s*\{\s*Service\s*=\s*"events\.amazonaws\.com"\s*\}/,
  );
  assert.match(
    alertsPolicy,
    /"aws:SourceArn"\s*=\s*aws_cloudwatch_event_rule\.rds_backup_failed\.arn/,
  );
});

test("VPC flow logs are retained in CloudWatch for network forensics", () => {
  const source = readTerraform("vpc.tf");
  const deliveryPolicy = resourceBlock(
    source,
    "aws_iam_role_policy",
    "vpc_flow_logs",
  );

  assert.match(source, /resource "aws_cloudwatch_log_group" "vpc_flow_logs"/);
  assert.match(source, /retention_in_days\s*=\s*30/);
  assert.match(source, /resource "aws_iam_role" "vpc_flow_logs"/);
  assert.match(source, /resource "aws_iam_role_policy" "vpc_flow_logs"/);
  assert.match(source, /resource "aws_flow_log" "main"/);
  assert.match(source, /traffic_type\s*=\s*"ALL"/);
  assert.match(source, /log_destination_type\s*=\s*"cloud-watch-logs"/);
  assert.match(source, /iam_role_arn\s*=\s*aws_iam_role\.vpc_flow_logs\.arn/);
  assert.match(
    source,
    /log_destination\s*=\s*aws_cloudwatch_log_group\.vpc_flow_logs\.arn/,
  );
  assert.match(
    deliveryPolicy,
    /Action\s*=\s*\[\s*"logs:DescribeLogGroups",?\s*\]\s*Resource\s*=\s*"\*"/,
  );
  assert.doesNotMatch(
    deliveryPolicy,
    /logs:DescribeLogGroups[\s\S]{0,200}aws_cloudwatch_log_group\.vpc_flow_logs\.arn/,
  );
  assert.match(deliveryPolicy, /"logs:CreateLogStream"/);
  assert.match(deliveryPolicy, /"logs:PutLogEvents"/);
  assert.match(deliveryPolicy, /"logs:DescribeLogStreams"/);
  assert.match(
    deliveryPolicy,
    /Resource\s*=\s*"\$\{aws_cloudwatch_log_group\.vpc_flow_logs\.arn\}:\*"/,
  );
});
