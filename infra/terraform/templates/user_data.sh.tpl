#!/usr/bin/env bash
# ─── EC2 Bootstrap — runs once on first launch ───────────────────────────────
# Installs Docker, AWS CLI, CloudWatch Agent, then starts Polyforge.

set -euo pipefail
exec > >(tee /var/log/polyforge-bootstrap.log | logger -t polyforge-bootstrap) 2>&1

LOG() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

LOG "=== Polyforge EC2 Bootstrap ==="
LOG "Region: ${aws_region} | Project: ${project} | Env: ${environment}"

# ── System packages ───────────────────────────────────────────────────────────

LOG "Installing system packages…"
yum update -y
yum install -y \
    docker \
    git \
    jq \
    curl \
    unzip \
    amazon-cloudwatch-agent

# ── Docker ────────────────────────────────────────────────────────────────────

LOG "Starting Docker…"
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Docker Compose v2 (plugin)
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version

# ── AWS CLI v2 ────────────────────────────────────────────────────────────────

LOG "Installing AWS CLI v2…"
if ! command -v aws &>/dev/null || ! aws --version 2>&1 | grep -q "aws-cli/2"; then
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp/awscliv2
    /tmp/awscliv2/aws/install --update
    rm -rf /tmp/awscliv2 /tmp/awscliv2.zip
fi
aws --version

# ── App directory ─────────────────────────────────────────────────────────────

LOG "Setting up /opt/polyforge…"
mkdir -p /opt/polyforge/scripts
chown -R ec2-user:ec2-user /opt/polyforge

# ── CloudWatch Agent ──────────────────────────────────────────────────────────

LOG "Configuring CloudWatch Agent…"
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c "ssm:/polyforge/prod/cloudwatch-agent-config" \
    -s || LOG "WARNING: CloudWatch agent config fetch failed — will retry on next start"

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent || true

# ── certbot ───────────────────────────────────────────────────────────────────

LOG "Installing certbot…"
pip3 install certbot --quiet || yum install -y certbot

# ── Swap (helps under memory pressure) ───────────────────────────────────────

if ! swapon --show | grep -q '/swapfile'; then
    LOG "Creating 4 GB swapfile…"
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── Kernel tuning for high-concurrency services ───────────────────────────────

cat >> /etc/sysctl.conf << 'SYSCTL'
# Polyforge — network tuning
net.core.somaxconn        = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max               = 1000000
SYSCTL
sysctl -p

# Raise ulimit for Docker (and all children)
cat > /etc/security/limits.d/polyforge.conf << 'LIMITS'
*    soft nofile 65535
*    hard nofile 65535
root soft nofile 65535
root hard nofile 65535
LIMITS

# ── Signal completion ─────────────────────────────────────────────────────────

LOG "=== Bootstrap complete ==="
LOG ""
LOG "Next steps (run as ec2-user):"
LOG "  1. Copy docker-compose.prod.yml to /opt/polyforge/"
LOG "  2. sudo bash /opt/polyforge/scripts/fetch-secrets.sh --region ${aws_region}"
LOG "  3. sudo bash /opt/polyforge/scripts/issue-certs.sh"
LOG "  4. ECR_REGISTRY=<account>.dkr.ecr.${aws_region}.amazonaws.com \\"
LOG "     IMAGE_TAG=<tag> \\"
LOG "     docker compose -f /opt/polyforge/docker-compose.prod.yml \\"
LOG "       --env-file /opt/polyforge/.env.prod up -d"
