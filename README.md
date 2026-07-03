# Navidrome with Caddy Reverse Proxy & Registration Portal

A complete Docker Compose setup for **Navidrome** music server with:
- **Caddy** reverse proxy (HTTPS on IP with internal CA)
- **Custom registration service** for user self-signup
- **Access portal** with guest mode, login, and registration forms

> **Note**: Throughout this guide, replace `YOUR_SERVER_IP` with your actual server IP address or domain name (e.g.,  `music.example.com`, or `192.168.1.100`).

## Architecture

```
┌─────────┐
│  Caddy  │ (Reverse proxy, TLS termination)
├─────────┤
│ - root (/) → Portal HTML
│ - /app/* → Navidrome SPA
│ - /rest/* → Navidrome API
│ - /register/* → Registration service
└─────────┘
     ↓
┌─────────────────────────────┐
│     Navidrome (4533)        │
│  - Music server & metadata  │
│  - Web player               │
└─────────────────────────────┘

┌──────────────────────────┐
│ Registration Service     │
│  - User self-signup      │
│  - Admin token mgmt      │
└──────────────────────────┘
```

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose installed
- Music library directory (configured in `docker-compose.yml`)
- Server IP or domain (e.g., `192.168.1.100`, `music.example.com`)

### 2. Configure Your Server Address

The **Caddyfile is automatically generated** at container startup with your server IP. Choose one option:

**Option A: Auto-Detect (Easiest)**

Just run the services—the system will auto-detect your server IP:
```bash
docker compose up -d
```
The entrypoint script uses `ip route show default` to find your IP.

**Option B: Set IP Explicitly**

Edit `.env` and set your server address:
```env
SERVER_ADDRESS=192.168.1.100
# or
SERVER_ADDRESS=music.example.com
```

Then start services:
```bash
docker compose up -d
```

If using a domain name, ensure DNS points to your server.

### 3. Set Admin Credentials

```bash
cd /home/ubuntu/navidrome

# Copy .env.sample to .env
cp .env.sample .env

# Edit .env with your admin credentials
nano .env

# (Optional) Set SERVER_ADDRESS if you want to use a specific IP/domain
# Edit the SERVER_ADDRESS line in .env
```

### 4. Start Services

```bash
docker compose up -d
```

The Caddyfile is automatically generated from the template using your IP.

Verify all containers are running:
```bash
docker compose ps
```

Check that the Caddyfile was generated correctly:
```bash
docker compose logs caddy | grep caddy-entrypoint
```

You should see:
```
[caddy-entrypoint] Generating Caddyfile from template with server address: <your-ip>
[caddy-entrypoint] Successfully generated Caddyfile
```

### 5. Access Portal

Visit: **`https://YOUR_SERVER_IP/`** (replace with your actual IP/domain)

Example: `https://192.168.1.100/` or `https://music.example.com/`

(Accept the self-signed certificate or trust the CA for seamless access.)

## Configuration

### Environment Variables (`.env`)

```env
# *** IMPORTANT: Set your server address ***
# Option 1: Explicit IP (e.g., 192.168.1.100 or music.example.com)
SERVER_ADDRESS=YOUR_SERVER_IP
# Option 2: Leave blank to auto-detect from network interface
# SERVER_ADDRESS=

# Admin credentials (used to create first user)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Navidrome options
ND_SCANSCHEDULE=1h          # How often to scan music library
ND_LOGLEVEL=info             # Logging level
ND_ENABLEDOWNLOADS=true      # Allow downloads
ND_ENABLESHARING=false       # Disable public shares by default
ND_ENABLEEXTERNALSERVICES=false  # Disable external metadata (privacy)

# Network ports
HTTP_PORT=80
HTTPS_PORT=443
```

## Usage

### Access Points

Replace `YOUR_SERVER_IP` with your actual server IP or domain:

| URL | Purpose |
|-----|----------|
| `https://YOUR_SERVER_IP/` | Access portal (guest, login, register) |
| `https://YOUR_SERVER_IP/app/` | Navidrome web player |
| `https://YOUR_SERVER_IP/rest/*` | Subsonic API (for mobile apps) |

### Portal Features

1. **Guest Login** - Browse as guest (read-only)
2. **Sign In** - Login with existing credentials
3. **Create Account** - Self-register a new user
4. **Create + Login** - Register and auto-login in one step

### Authentication

- Portal login persists JWT token to `localStorage`
- Token sent via `Authorization: Bearer <token>` header
- Admin token available in registration service logs for external use

## SSL/TLS Certificate

### HTTPS on IP Address or Domain

This setup uses **Caddy's internal CA** to issue certificates for your server:

```
https://YOUR_SERVER_IP  ← Self-signed, trusted via local CA
# OR
https://your-domain.com  ← Self-signed, trusted via local CA
```

### Trust the Certificate on Client Devices

#### macOS / iOS
1. Export CA: `docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root-ca.crt`
2. macOS: Keychain → Import `caddy-root-ca.crt` → Mark as trusted
3. iOS: Settings → Profile Downloaded → Install → Trust

#### Windows
1. Export CA: `docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root-ca.crt`
2. Run: `certutil -addstore Root caddy-root-ca.crt` (Admin prompt)

#### Android
1. Settings → Security → Install from storage
2. Select exported `caddy-root-ca.crt`

#### Linux
```bash
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt | \
  sudo tee /usr/local/share/ca-certificates/navidrome-local-ca.crt
sudo update-ca-certificates
```

## File Structure

```
navidrome/
├── .env                          # Configuration (credentials, SERVER_ADDRESS)
├── .env.sample                   # Example config template
├── Caddyfile.template            # Reverse proxy template (auto-substituted)
├── Caddyfile                     # Generated Caddyfile (auto-created per startup)
├── docker-compose.yml            # Service orchestration
├── README.md                     # This file
│
├── caddy/
│   ├── Dockerfile               # Custom Caddy image with entrypoint
│   └── entrypoint.sh            # Auto-generates Caddyfile from template
│
├── caddy_root/
│   └── index.html               # Access portal page
│
├── data/
│   └── caddy/                   # Persistent Caddy PKI (auto-managed)
│       └── pki/authorities/local/
│           └── root.crt         # Root CA (export for client trust)
│
├── docker/
│   └── data/                    # Navidrome data volume
│       ├── navidrome.db         # User, playlist, rating data
│       └── cache/               # Album art, images, transcodings
│
├── registration/
│   ├── server.js                # Registration API service
│   ├── package.json             # Node.js dependencies
│   └── Dockerfile               # Registration container build
│
└── music/                       # Music library (mounted read-only)
    ├── Chica/
    ├── Chico/
    ├── Guia voces/
    └── ...                      # Your music folders
```

## Services

### Navidrome
- **Container**: `navidrome`
- **Image**: `deluan/navidrome`
- **Port**: `4533` (internal, proxied via Caddy)
- **Data Path**: `/data` → `./docker/data`
- **Music Path**: `/music` → `/home/ubuntu/music` (read-only)

### Caddy
- **Container**: `caddy`
- **Image**: `caddy:2`
- **Ports**: 
  - `80` → HTTP (auto-redirect to HTTPS)
  - `443` → HTTPS with internal CA
- **Config**: `./Caddyfile`
- **Cert Storage**: `./caddy_certs` (persisted)

### Registration Service
- **Container**: `navidrome-registration`
- **Port**: `3000` (internal, proxied via Caddy at `/register`)
- **Language**: Node.js / Express
- **Admin Check**: Reads Navidrome DB to verify first admin exists

## Troubleshooting

### Music Library Not Appearing

1. Verify volume mount:
   ```bash
   docker compose exec navidrome ls -la /music/
   ```

2. If empty, check `docker-compose.yml` volume path is absolute (not relative).

3. Trigger library scan in Navidrome web UI:
   - Settings → Library → "Scan Library"

### Login Returns 401

1. Clear browser cache / localStorage:
   ```
   DevTools → Application → Local Storage → Clear All
   ```

2. Hard refresh portal: `Ctrl+Shift+R`

3. Check registration service logs:
   ```bash
   docker compose logs navidrome-registration
   ```

### Certificate Warning in Browser

- This is **expected** for self-signed CA
- Either:
  1. Trust the CA on your device (recommended)
  2. Click "Advanced" → "Proceed anyway" (temporary)

### Cannot Connect to Server

1. Verify services running:
   ```bash
   docker compose ps
   ```

2. Check Caddy logs:
   ```bash
   docker compose logs caddy
   ```

3. Test HTTP endpoint (replace YOUR_SERVER_IP with your actual IP/domain):
   ```bash
   curl -k https://YOUR_SERVER_IP/
   ```

## Useful Commands

```bash
# View logs for all services
docker compose logs -f

# View logs for specific service
docker compose logs -f navidrome
docker compose logs -f caddy
docker compose logs -f navidrome-registration

# Restart services
docker compose restart

# Stop all services
docker compose stop

# Remove all containers (data preserved)
docker compose down

# Full clean (removes volumes too)
docker compose down -v

# Execute command in container
docker compose exec navidrome sh
docker compose exec caddy sh

# Rebuild after code changes
docker compose up -d --build
```

## Advanced Configuration

### Change Server Address After Startup

1. Update `.env`:
   ```env
   SERVER_ADDRESS=your-new-domain.com
   ```

2. Restart Caddy:
   ```bash
   docker compose restart caddy
   ```

3. Verify the new Caddyfile was generated:
   ```bash
   docker compose logs caddy | grep caddy-entrypoint
   ```

### Disable TLS (HTTP Only)

Edit [Caddyfile.template](Caddyfile.template) and change:
```
https://YOUR_SERVER_IP {
```

To:
```
http://YOUR_SERVER_IP {
```

Then remove the `tls internal` line.

Restart to regenerate:
```bash
docker compose restart caddy
```

### Add Password Protection to Portal

Edit [caddy_root/index.html](caddy_root/index.html) and add HTTP Basic Auth check:
```html
<script>
  if (!localStorage.getItem('portal_auth')) {
    const pwd = prompt('Portal password:');
    if (pwd !== 'your-secret') window.location = '/';
    localStorage.setItem('portal_auth', '1');
  }
</script>
```

## Support & Documentation

- **Navidrome**: https://www.navidrome.org
- **Caddy**: https://caddyserver.com/docs
- **Subsonic API**: https://www.subsonic.org/pages/api.jsp (used by mobile apps)

## License

This configuration and portal UI are provided as-is. Navidrome is licensed under GPLv3.

---

**Last Updated**: March 2026  
**Tested On**: Ubuntu 22.04, Docker 24.0+, Caddy 2.x, Navidrome 0.60.3
