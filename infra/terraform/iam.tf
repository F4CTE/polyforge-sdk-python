# ─── Polyforge — IAM ─────────────────────────────────────────────────────────
#
# EC2 instance role — grants the running instance permission to:
#   - Pull images from ECR (all polyforge-* repos)
#   - Read secrets from Secrets Manager (polyforge/prod/*)
#   - Write logs to CloudWatch (log group /polyforge/prod)
#   - Describe itself (used by fetch-secrets.sh region detection)

# ── Instance role ─────────────────────────────────────────────────────────────

resource "aws_iam_role" "ec2" {
  name = "${local.name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ── ECR: pull images ──────────────────────────────────────────────────────────

resource "aws_iam_role_policy" "ecr_pull" {
  name = "${local.name}-ecr-pull"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:DescribeImages",
          "ecr:ListImages",
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/polyforge-*"
      },
    ]
  })
}

# ── Secrets Manager: read prod secrets ───────────────────────────────────────

resource "aws_iam_role_policy" "secrets_read" {
  name = "${local.name}-secrets-read"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "SecretsManagerRead"
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
      ]
      Resource = [
        "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:polyforge/prod/*",
      ]
    }]
  })
}

# ── CloudWatch Logs: create log streams + put events ─────────────────────────

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "${local.name}-cloudwatch-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "CloudWatchLogs"
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
        "logs:DescribeLogGroups",
      ]
      Resource = [
        "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/polyforge/*",
        "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/polyforge/*:*",
      ]
    }]
  })
}

# ── CloudWatch Agent: publish EC2 metrics (memory, disk) ─────────────────────

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# ── SSM: optional for secure shell access without SSH key ─────────────────────

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
