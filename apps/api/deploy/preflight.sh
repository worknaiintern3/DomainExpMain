#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
compose config --quiet
python3 "$DEPLOY_DIR/preflight.py" "$(env_value BACKEND_HOST_PORT)"
