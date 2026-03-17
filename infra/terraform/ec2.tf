# ─── Polyforge — EC2 Instance ────────────────────────────────────────────────

# ── Elastic IP ────────────────────────────────────────────────────────────────

resource "aws_eip" "main" {
  domain = "vpc"
  tags   = { Name = "${local.name}-eip" }
}

resource "aws_eip_association" "main" {
  instance_id   = aws_instance.main.id
  allocation_id = aws_eip.main.id
}

# ── EC2 Instance ──────────────────────────────────────────────────────────────

resource "aws_instance" "main" {
  ami                    = var.ec2_ami
  instance_type          = var.ec2_instance_type
  key_name               = var.ec2_key_name
  subnet_id              = aws_subnet.public_1a.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.ec2_root_volume_size_gb
    iops                  = 3000
    throughput            = 125
    delete_on_termination = true
    encrypted             = true
  }

  # Disable accidental termination in production
  disable_api_termination = true

  # User data: bootstrap Docker, clone repo, fetch secrets, start services
  user_data = base64encode(templatefile("${path.module}/templates/user_data.sh.tpl", {
    aws_region    = var.aws_region
    project       = var.project
    environment   = var.environment
  }))

  # Wait for CloudWatch agent config to apply before considering ready
  tags = { Name = "${local.name}-server" }

  lifecycle {
    # Prevent Terraform from replacing the instance on AMI updates.
    # Use SSM Patch Manager or manual AMI refresh instead.
    ignore_changes = [ami, user_data]
  }
}

# ── CloudWatch: EC2 memory + disk metrics via CloudWatch Agent ────────────────
# The agent config is pushed to Parameter Store; the EC2 user_data installs the agent.

resource "aws_ssm_parameter" "cloudwatch_agent_config" {
  name  = "/polyforge/prod/cloudwatch-agent-config"
  type  = "String"
  value = jsonencode({
    agent = {
      metrics_collection_interval = 60
      run_as_user                 = "cwagent"
    }
    metrics = {
      append_dimensions = {
        InstanceId   = "$${aws:InstanceId}"
        InstanceType = "$${aws:InstanceType}"
      }
      metrics_collected = {
        mem = {
          measurement                 = ["mem_used_percent"]
          metrics_collection_interval = 60
        }
        disk = {
          measurement                 = ["used_percent"]
          metrics_collection_interval = 60
          resources                   = ["/"]
        }
        swap = {
          measurement                 = ["swap_used_percent"]
          metrics_collection_interval = 60
        }
      }
    }
  })
}
