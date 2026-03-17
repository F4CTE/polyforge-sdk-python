# ─── Polyforge — ECR Repositories ────────────────────────────────────────────
#
# One repository per Docker image. Images are tagged with git commit SHAs.
# Lifecycle policy: keep last 10 tagged images, purge untagged after 1 day.

locals {
  services = [
    "gateway",
    "auth-service",
    "api-service",
    "admin-auth-service",
    "admin-api-service",
    "market-data-service",
    "strategy-engine",
    "order-service",
    "paper-order-service",
    "backtest-service",
    "notification-service",
    "bot-service",
    "signer-service",
  ]
}

resource "aws_ecr_repository" "services" {
  for_each = toset(local.services)

  name                 = "polyforge-${each.key}"
  image_tag_mutability = "MUTABLE"   # Allow re-tagging (e.g. latest)

  image_scanning_configuration {
    scan_on_push = true  # Free ECR basic scanning on every push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = "polyforge-${each.key}" }
}

# ── Lifecycle policy ──────────────────────────────────────────────────────────
# Keep the 10 most recently pushed tagged images.
# Expire untagged images after 1 day (build cache debris).

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", ""]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}
