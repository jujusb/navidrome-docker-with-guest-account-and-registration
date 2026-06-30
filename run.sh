#!/usr/bin/env bash

ensure_network() {
    local net=$1
    if ! docker network inspect "$net" >/dev/null 2>&1; then
        echo "Creating network: $net"
        docker network create "$net"
    fi
}
ensure_network caddy_net
ensure_network navidrome_internal_net

export COMPOSE_FILE="docker-compose.yml:docker-compose.caddy.yml"
docker compose $@
unset COMPOSE_FILE