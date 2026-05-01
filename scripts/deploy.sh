#!/usr/bin/env bash
# ─── Polyforge Production Deploy Script ──────────────────────────────────────
#
# Builds all Docker images, pushes to ECR, then rolls services with zero
# downtime (one service at a time via --no-deps + scale).
#
# Prerequisites (on the deploy machine or CI runner):
#   - AWS CLI configured with ECR push permissions
#   - Docker buildx installed (multi-platform support)
#   - SSH access to the EC2 instance
#
# Usage:
#   bash scripts/deploy.sh [--tag v1.2.3] [--push-only] [--deploy-only]
#
# Environment variables (override defaults):
#   AWS_ACCOUNT_ID   — AWS account ID (required)
#   AWS_REGION       — AWS region (default: us-east-1)
#   EC2_HOST         — EC2 instance hostname / IP (required for remote deploy)
#   EC2_USER         — SSH user (default: ec2-user)
#   EC2_KEY          — Path to SSH private key (default: ~/.ssh/polyforge.pem)
#   EC2_KNOWN_HOSTS_FILE — known_hosts file for strict SSH host verification
#   IMAGE_TAG        — Docker image tag (default: git SHA)

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID must be set}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
DEFAULT_IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || true)"
IMAGE_TAG="${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}"
EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ec2-user}"
EC2_KEY="${EC2_KEY:-$HOME/.ssh/polyforge.pem}"
EC2_KNOWN_HOSTS_FILE="${EC2_KNOWN_HOSTS_FILE:-$HOME/.ssh/known_hosts}"
COMPOSE_FILE="docker-compose.prod.yml"

PUSH_ONLY=0
DEPLOY_ONLY=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag)          IMAGE_TAG="$2";  shift 2 ;;
        --push-only)    PUSH_ONLY=1;     shift   ;;
        --deploy-only)  DEPLOY_ONLY=1;   shift   ;;
        *)              echo "Unknown: $1"; exit 1 ;;
    esac
done

if [[ -z "$IMAGE_TAG" ]]; then
    echo "IMAGE_TAG must be set when git SHA detection is unavailable" >&2
    exit 1
fi

if [[ ! "$IMAGE_TAG" =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "IMAGE_TAG contains unsupported characters for an ECR tag: $IMAGE_TAG" >&2
    exit 1
fi

log() { echo "[$(date -u +%H:%M:%SZ)] $*"; }
bold() { echo -e "\033[1m$*\033[0m"; }

# Service names — must match ECR repository names (polyforge-<service>)
SERVICES=(
    gateway
    auth-service
    api-service
    admin-auth-service
    admin-api-service
    market-data-service
    strategy-engine
    order-service
    paper-order-service
    backtest-service
    notification-service
    bot-service
    signer-service
)

# ── 1. ECR Login ──────────────────────────────────────────────────────────────

ecr_login() {
    log "Logging in to ECR ($ECR_REGISTRY)…"
    aws ecr get-login-password --region "$AWS_REGION" \
        | docker login --username AWS --password-stdin "$ECR_REGISTRY"
}

# ── 2. Build + push images ────────────────────────────────────────────────────

build_and_push() {
    bold "=== Build & push — tag: ${IMAGE_TAG} ==="

    for svc in "${SERVICES[@]}"; do
        local image="${ECR_REGISTRY}/polyforge-${svc}:${IMAGE_TAG}"
        log "Building ${svc}…"

        # The gateway Dockerfile is in services/gateway/;
        # all other services have their Dockerfile in services/<service>/
        if [[ "$svc" == "gateway" ]]; then
            docker build \
                --file "services/gateway/Dockerfile" \
                --tag "$image" \
                .
        else
            docker build \
                --file "services/${svc}/Dockerfile" \
                --tag "$image" \
                .
        fi

        log "Pushing ${svc} → ECR…"
        docker push "$image"
    done

    bold "=== All images pushed ==="
}

# ── 3. Ensure ECR repos exist ─────────────────────────────────────────────────

ensure_ecr_repos() {
    log "Ensuring ECR repositories exist…"
    for svc in "${SERVICES[@]}"; do
        aws ecr describe-repositories \
            --region "$AWS_REGION" \
            --repository-names "polyforge-${svc}" \
            --query 'repositories[0].repositoryName' \
            --output text 2>/dev/null && continue || true

        log "Creating ECR repo: polyforge-${svc}"
        aws ecr create-repository \
            --region "$AWS_REGION" \
            --repository-name "polyforge-${svc}" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256 \
            --query 'repository.repositoryUri' \
            --output text
    done
}

# ── 4. Remote deploy via SSH ──────────────────────────────────────────────────

remote_deploy() {
    if [[ -z "$EC2_HOST" ]]; then
        log "EC2_HOST not set — skipping remote deploy (run manually on the server)"
        return
    fi

    if [[ ! -f "$EC2_KNOWN_HOSTS_FILE" ]]; then
        log "Known hosts file not found: $EC2_KNOWN_HOSTS_FILE"
        log "Seed it before deploy, for example: ssh-keyscan -H \"$EC2_HOST\" >> \"$EC2_KNOWN_HOSTS_FILE\""
        exit 1
    fi

    local -a ssh_opts=(
        -i "$EC2_KEY"
        -o BatchMode=yes
        -o StrictHostKeyChecking=yes
        -o UserKnownHostsFile="$EC2_KNOWN_HOSTS_FILE"
    )

    bold "=== Deploying to ${EC2_USER}@${EC2_HOST} ==="

    # Ensure .env.prod is up to date on the server
    log "Refreshing secrets on EC2…"
    ssh "${ssh_opts[@]}" \
        "${EC2_USER}@${EC2_HOST}" \
        "sudo bash /opt/polyforge/scripts/fetch-secrets.sh --region ${AWS_REGION}"

    # Copy compose file to server
    log "Uploading compose file…"
    scp "${ssh_opts[@]}" \
        "$COMPOSE_FILE" \
        "${EC2_USER}@${EC2_HOST}:/opt/polyforge/${COMPOSE_FILE}"

    # Pull and restart on the server
    log "Pulling images + rolling update on EC2…"
    ssh "${ssh_opts[@]}" \
        "${EC2_USER}@${EC2_HOST}" \
        "AWS_REGION='${AWS_REGION}' ECR_REGISTRY='${ECR_REGISTRY}' IMAGE_TAG='${IMAGE_TAG}' COMPOSE_FILE='${COMPOSE_FILE}' bash -s" <<'REMOTE_DEPLOY'
        set -e
        cd /opt/polyforge

        PREVIOUS_IMAGE_TAG="$(cat .last-successful-image-tag 2>/dev/null || true)"
        rollback() {
            status=$?
            trap - ERR
            if [[ -n "$PREVIOUS_IMAGE_TAG" ]]; then
                echo "Deploy failed; rolling back to image tag $PREVIOUS_IMAGE_TAG"
                export IMAGE_TAG="$PREVIOUS_IMAGE_TAG"
                docker compose -f "$COMPOSE_FILE" --env-file .env.prod pull
                docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --remove-orphans
            else
                echo "Deploy failed and no previous successful image tag was recorded; manual rollback required."
            fi
            exit "$status"
        }
        trap rollback ERR

        # Log in to ECR from the server (uses instance IAM role)
        aws ecr get-login-password --region "$AWS_REGION" \
            | docker login --username AWS --password-stdin "$ECR_REGISTRY"

        # Pull all new images first (no downtime yet)
        docker compose -f "$COMPOSE_FILE" --env-file .env.prod pull

        # Restart services one by one, critical ones last
        # Non-critical (background workers) first
        for svc in notification-service bot-service backtest-service paper-order-service; do
            echo "Restarting $svc..."
            docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --no-deps "$svc"
            sleep 3
        done

        # Strategy + order pipeline
        for svc in market-data-service strategy-engine order-service; do
            echo "Restarting $svc..."
            docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --no-deps "$svc"
            sleep 5
        done

        # Signer last (order-service depends on it)
        docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --no-deps signer-service
        sleep 5

        # User-facing services (cause brief reconnects)
        docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --no-deps auth-service api-service
        sleep 5

        # Admin services
        docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --no-deps admin-auth-service admin-api-service
        sleep 3

        # Gateway last
        docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --no-deps gateway

        sleep 20
        curl -f https://polyforge.app/api/v1/health
        echo "$IMAGE_TAG" > .last-successful-image-tag
        trap - ERR

        echo 'Deploy complete.'
        docker compose -f "$COMPOSE_FILE" --env-file .env.prod ps
REMOTE_DEPLOY
}

# ── Main ──────────────────────────────────────────────────────────────────────

bold "Polyforge deploy — image tag: ${IMAGE_TAG}"

if [[ "$DEPLOY_ONLY" -eq 0 ]]; then
    ecr_login
    ensure_ecr_repos
    build_and_push
fi

if [[ "$PUSH_ONLY" -eq 0 ]]; then
    remote_deploy
fi

bold "Done."
