#!/usr/bin/env bash

export COMPOSE_FILE="docker-compose.yml:docker-compose.caddy.yml"
docker compose $@
unset COMPOSE_FILE