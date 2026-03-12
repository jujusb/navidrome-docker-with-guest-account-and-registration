#!/bin/sh

# Entrypoint script for Caddy
# Automatically generates Caddyfile from template, replacing YOUR_SERVER_IP with actual server address

# Get SERVER_ADDRESS from environment variable, or try to auto-detect
if [ -z "$SERVER_ADDRESS" ]; then
  # Try to get IP from the default gateway interface (works with BusyBox)
  # In Docker, the default route usually points to the host's IP
  SERVER_ADDRESS=$(ip route show default 2>/dev/null | awk '{print $3}')
  
  # If that doesn't work, try to get the container's own IP (skip loopback)
  if [ -z "$SERVER_ADDRESS" ]; then
    # Get first non-loopback IPv4 address
    SERVER_ADDRESS=$(ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | head -n 1 | awk '{print $2}' | cut -d/ -f1)
  fi
  
  # Fallback to localhost if all detection attempts fail
  if [ -z "$SERVER_ADDRESS" ]; then
    SERVER_ADDRESS="localhost"
  fi
  
  echo "[caddy-entrypoint] SERVER_ADDRESS not set, auto-detected: $SERVER_ADDRESS"
else
  echo "[caddy-entrypoint] Using SERVER_ADDRESS from environment: $SERVER_ADDRESS"
fi

# Generate Caddyfile from template
echo "[caddy-entrypoint] Generating Caddyfile from template with server address: $SERVER_ADDRESS"

# Use sed to replace YOUR_SERVER_IP placeholder
# Capture both stdout and stderr
SED_OUTPUT=$(sed 's|YOUR_SERVER_IP|'"$SERVER_ADDRESS"'|g' /Caddyfile.template 2>&1)
SED_EXIT=$?

if [ $SED_EXIT -eq 0 ]; then
  echo "$SED_OUTPUT" > /etc/caddy/Caddyfile
  echo "[caddy-entrypoint] Successfully generated Caddyfile"
  echo "[caddy-entrypoint] Generated Caddyfile (first 10 lines):"
  head -n 10 /etc/caddy/Caddyfile
else
  echo "[caddy-entrypoint] ERROR: sed failed with exit code $SED_EXIT" >&2
  echo "[caddy-entrypoint] sed output: $SED_OUTPUT" >&2
  # Copy template as-is if substitution fails (fallback)
  cp /Caddyfile.template /etc/caddy/Caddyfile
  echo "[caddy-entrypoint] Copied template as fallback"
fi

# Execute the command passed to the entrypoint (Caddy)
echo "[caddy-entrypoint] Starting Caddy..."
exec "$@"
