if [[ TLS_INTERNAL == "true" ]]; then 
	# Use Caddy's internal CA for HTTPS on an IP address.
	# This avoids ACME failures on raw IPs, but clients must trust this CA.
    export TLS_CONFIG='tls internal'
else
    export TLS_CONFIG='tls {
	    dns cloudflare {env.CF_API_TOKEN}
    }'
fi
echo $TLS_CONFIG
export COMPOSE_FILE=docker-compose.yml:docker-compose.caddy.yml
docker compose $@