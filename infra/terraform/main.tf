# ─── Polyforge — Terraform Root ───────────────────────────────────────────────

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — create the S3 bucket and DynamoDB table first (one-time):
  #   aws s3api create-bucket --bucket polyforge-terraform-state --region us-east-1
  #   aws s3api put-bucket-versioning \
  #       --bucket polyforge-terraform-state \
  #       --versioning-configuration Status=Enabled
  #   aws dynamodb create-table \
  #       --table-name polyforge-terraform-locks \
  #       --attribute-definitions AttributeName=LockID,AttributeType=S \
  #       --key-schema AttributeName=LockID,KeyType=HASH \
  #       --billing-mode PAY_PER_REQUEST
  backend "s3" {
    bucket         = "polyforge-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "polyforge-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ─── Data sources ─────────────────────────────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
