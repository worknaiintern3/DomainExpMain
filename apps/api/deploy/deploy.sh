#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
lock_deployment
expected="${1:-}"
[[ -z "$expected" || "$expected" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid requested commit' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || {
  echo 'Unexpected production source changes; refusing destructive reset.' >&2; exit 1;
}
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
bash "$DEPLOY_DIR/preflight.sh"
previous_image="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
other_ids=''
while IFS= read -r id; do
  if [[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$id")" != domainexp_app ]]; then
    other_ids+="$id "
  fi
done < <(docker ps -q)
assert_others_running() {
  local id
  for id in $other_ids; do
    [[ "$(docker inspect -f '{{.State.Running}}' "$id")" == true ]] || {
      echo 'An existing unrelated container is no longer running.' >&2; return 1;
    }
  done
}
rollback() {
  local status=$?
  trap - ERR
  echo 'Deployment failed; rolling back DomainExp only.' >&2
  git reset --hard "$PREVIOUS_COMMIT" || { echo 'Git rollback failed.' >&2; exit "$status"; }
  if [[ -n "$previous_image" ]]; then
    export API_IMAGE="$previous_image"
    if ! docker image inspect "$previous_image" >/dev/null 2>&1; then compose build backend || true; fi
    if compose up -d --no-deps --wait --wait-timeout 120 backend && verify_local; then
      echo 'Previous backend restored and healthy.' >&2
    else
      echo 'Rollback health verification failed; inspect only this project.' >&2
    fi
  else
    echo 'First deployment: no previous running backend exists.' >&2
  fi
  assert_others_running || true
  exit "$status"
}
trap rollback ERR
git fetch origin main
target="$(git rev-parse origin/main)"
if [[ -n "$expected" && "$target" != "$expected" ]]; then
  echo 'origin/main moved; refusing to deploy a different revision. The next queued push will deploy.' >&2
  false
fi
git checkout -B main "$target"
git reset --hard "$target"
export API_IMAGE="domainexp_app_api:$target"
bash "$DEPLOY_DIR/preflight.sh"
compose config --quiet
compose build backend
if [[ "$(env_value RUN_MIGRATIONS)" == true ]]; then
  compose run --rm --no-deps migrate
fi
compose up -d --no-deps --remove-orphans --wait --wait-timeout 150 backend
[[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" == true ]]
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER")" == healthy ]]
verify_local
if [[ "${DOMAINEXP_INITIAL_SETUP:-0}" != 1 ]]; then verify_public; fi
assert_others_running
printf '%s\n' "$PREVIOUS_COMMIT" > "$DEPLOY_DIR/.previous-commit"
printf '%s\n' "$target" > "$DEPLOY_DIR/.current-commit"
trap - ERR
if [[ "${DOMAINEXP_INITIAL_SETUP:-0}" == 1 ]]; then
  echo 'Initial backend ready; domain deployment remains pending one-time SSL/Nginx installation.'
else
  echo "SUCCESS: $DOMAIN at exact main revision $target"
fi
