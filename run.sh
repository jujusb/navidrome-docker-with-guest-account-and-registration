#!/usr/bin/env bash
if [[ -z "$CURRENT_SERVICE" ]]; then
    CURRENT_SERVICE=$(basename "$PWD")
fi
export COMPOSE_PROJECT_NAME="$CURRENT_SERVICE"
export NAVIDROME_DATA_SUBDIR="$CURRENT_SERVICE"

export COMPOSE_FILE="docker-compose.yml:docker-compose.caddy.yml"
docker compose $@
unset COMPOSE_FILE
unset NAVIDROME_DATA_SUBDIR
unset COMPOSE_PROJECT_NAME