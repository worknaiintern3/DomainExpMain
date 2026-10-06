#!/usr/bin/env bash
set -Eeuo pipefail
# CI streams this exact pushed script, so a broken old preflight cannot block its fix.
expected="${1:-}"
repo="${2:-}"
if [[ -z "$repo" ]]; then repo="$(git -C "$(dirname -- "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"; fi
[[ "$repo" == /opt/domainexp-app && "$(realpath -- "$repo")" == "$repo" ]] || {
  echo 'Refusing deployment outside the dedicated /opt/domainexp-app checkout.' >&2; exit 1;
}
cd "$repo"
[[ "$(git rev-parse --show-toplevel)" == "$repo" ]] || { echo 'Unexpected repository root.' >&2; exit 1; }
[[ "$(git remote get-url origin)" == https://github.com/worknaiintern3/DomainExpMain.git ]] || {
  echo 'Unexpected production Git origin.' >&2; exit 1;
}
[[ -z "$expected" || "$expected" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid requested commit.' >&2; exit 1; }
exec 9>"$repo/apps/api/deploy/.deploy.lock"
flock -w 600 9 || { echo 'Another DomainExp deployment is running.' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || {
  echo 'Unexpected production source changes; refusing checkout.' >&2; exit 1;
}
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
previous_image=''
backend_changed=0
common_loaded=0
snapshot=''
existing="$(docker ps -aq --filter 'name=^/domainexp_app_backend$')"
if [[ -n "$existing" ]]; then
  [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$existing")" == domainexp_app &&
     "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$existing")" == backend ]] || {
    echo 'Backend name is owned by another project.' >&2; exit 1;
  }
  previous_image="$(docker inspect -f '{{.Image}}' "$existing")"
fi
rollback() {
  local status=$?
  trap - ERR
  echo 'Deployment failed; preserving database and rolling back only the backend revision.' >&2
  # Never emit raw Docker logs/inspection: they may include production credentials.
  if [[ "$common_loaded" == 1 && "$backend_changed" == 1 ]]; then
    if ! python3 "$DEPLOY_DIR/diagnostics.py"; then echo 'Sanitized diagnostics unavailable.' >&2; fi
  fi
  if [[ -n "$snapshot" ]]; then
    if ! python3 "$DEPLOY_DIR/infrastructure.py" verify "$snapshot" "$DEPLOY_DIR/.env"; then
      echo 'Protected infrastructure verification failed.' >&2
    fi
  fi
  if ! git reset --hard "$PREVIOUS_COMMIT"; then echo 'Checkout rollback failed.' >&2; exit "$status"; fi
  if [[ "$backend_changed" == 1 ]]; then
    if [[ -n "$previous_image" ]]; then
      export API_IMAGE="$previous_image"
      if compose up -d --no-deps --wait --wait-timeout 180 backend && verify_local; then
        echo 'Previous backend restored and healthy.' >&2
      else
        echo 'Previous backend restoration failed health verification.' >&2
      fi
    elif ! compose rm -s -f backend; then
      echo 'Failed first backend revision could not be removed.' >&2
    fi
  fi
  [[ -z "$snapshot" ]] || rm -f -- "$snapshot"
  exit "$status"
}
trap rollback ERR
git fetch --no-tags origin main
target="${expected:-$(git rev-parse origin/main)}"
git cat-file -e "$target^{commit}"
git merge-base --is-ancestor "$target" origin/main
git checkout -B main "$target"
[[ "$(git rev-parse HEAD)" == "$target" ]]
# shellcheck disable=SC1091
source "$repo/apps/api/deploy/common.sh"
common_loaded=1
bash "$DEPLOY_DIR/preflight.sh"
snapshot="$(mktemp)"
python3 "$DEPLOY_DIR/infrastructure.py" snapshot "$snapshot" "$DEPLOY_DIR/.env"
prepare_runtime_environment
export API_IMAGE="domainexp_app_api:$target"
compose config --quiet
compose build backend
# Validate the very same compiled parsers before migrations/replacement.
compose run --rm --no-deps -T --entrypoint node migrate deploy/check-runtime.cjs < /dev/null
if [[ "$(env_value RUN_MIGRATIONS)" == true ]]; then compose run --rm --no-deps -T migrate < /dev/null; fi
backend_changed=1
compose up -d --no-deps --wait --wait-timeout 180 backend
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" == true ]]
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" == healthy ]]
verify_local
if [[ "${DOMAINEXP_INITIAL_SETUP:-0}" != 1 ]]; then verify_public; fi
python3 "$DEPLOY_DIR/infrastructure.py" verify "$snapshot" "$DEPLOY_DIR/.env"
printf '%s\n' "$PREVIOUS_COMMIT" > "$DEPLOY_DIR/.previous-commit"
printf '%s\n' "$target" > "$DEPLOY_DIR/.current-commit"
rm -f -- "$snapshot"
trap - ERR
if [[ "${DOMAINEXP_INITIAL_SETUP:-0}" == 1 ]]; then
  echo 'Initial backend ready; HTTPS must pass before a normal deployment can succeed.'
else
  echo "SUCCESS: $DOMAIN at exact pushed revision $target"
fi
