# Secure Echo Server Project

A demonstration of Cloudflare Access authentication with multi-IdP support (Google + Okta), serverless workers, and R2 storage.

## What It Does

**Unauthenticated users** hitting the root endpoint get their HTTP request headers echoed back as JSON - useful for debugging what Cloudflare is sending to your origin.

**Authenticated users** accessing `/secure` get personalized info extracted from their Cloudflare Access JWT:
- Email address
- Authentication timestamp
- Country (clickable link to view flag from R2)

## Architecture

```
User → Cloudflare Access (Auth) → Worker (JWT parsing) → Origin (Flask)
                                        ↓
                                   R2 Bucket (flags)
```

## Components

### Origin Server
- Flask app on GCP that echoes HTTP headers
- HTTPS-only with HSTS headers
- Connected via Cloudflare Tunnel (no direct internet access)

### Cloudflare Access
- Multi-IdP: Google OAuth + Okta OIDC
- Protects `/secure` routes
- Issues JWT tokens in `Cf-Access-Jwt-Assertion` header

### Cloudflare Worker
- Parses JWT tokens to extract user info
- Fetches country flags from private R2 bucket
- Returns formatted HTML responses

### R2 Storage
- Private bucket with 250 country flags (PNG)
- ISO 3166-1 alpha-2 codes (US.png, GB.png, etc.)

## Setup

1. Deploy Flask origin server with Cloudflare Tunnel
2. Configure Cloudflare Access with your IdPs
3. Create R2 bucket and upload flags:
   ```bash
   cd workers/header-auth-worker
   ./download-flags.sh
   # Upload flags/ to R2 via dashboard
   ```
4. Deploy Worker and configure route for `/secure*`

## Live URLs

- Unauthenticated: `https://tunnel.aiprovinggrounds.ai/`
- Authenticated: `https://tunnel.aiprovinggrounds.ai/secure`

## Project Structure

```
├── header-echo-server.py          # Flask origin
├── workers/header-auth-worker/    # JWT parsing worker
├── IMPLEMENTATION.md              # Detailed setup notes
└── README.md
```

## Security Notes

⚠️ **This is a demo** - JWT signatures are NOT verified. For production:
- Add JWT signature verification
- Implement rate limiting
- Add proper error handling and logging

## License

MIT
