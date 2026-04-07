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

is_ip() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

if is_ip "$SERVER_ADDRESS"; then
    echo "Detected IP → using internal TLS"
    export TLS_CONFIG='tls internal'
else
    echo "Detected domain → using Cloudflare TLS"
    export TLS_CONFIG='tls { dns cloudflare {env.CF_API_TOKEN} }'
fi

if [ "$MULTIPLE_CADDY_GLOBAL" = "true" ]; then
    echo "Multiple global services enabled → using global Caddyfile"
    export COMPOSE_FILE="docker-compose.yml:docker-compose.caddy.yml"
else
    echo "Single global service → using local Caddyfile"
    export COMPOSE_FILE="docker-compose.yml:docker-compose.root-caddy.yml:docker-compose.caddy.yml"
fi
docker compose $@
unset COMPOSE_FILE