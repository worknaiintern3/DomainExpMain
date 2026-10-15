#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
python3 "$DEPLOY_DIR/environment.py" "$DEPLOY_DIR/.env" validate
python3 "$DEPLOY_DIR/preflight.py" "$(env_value BACKEND_HOST_PORT)"
