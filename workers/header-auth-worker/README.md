# Header Authentication Worker

Cloudflare Worker that parses Cloudflare Access JWT tokens and displays authentication information with country flags stored in R2.

## Features

- **JWT Parsing**: Decodes Cloudflare Access JWT tokens from authenticated requests
- **Authentication Display**: Shows `${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}`
- **Country Flags**: Displays country flags from private R2 bucket
- **HTML Responses**: All responses returned as formatted HTML

## Architecture

```
User → Cloudflare Access (Auth) → Worker (JWT parsing) → HTML Response
                                      ↓
                                   R2 Bucket (Flags)
```

## Routes

### `/secure`
Main authentication endpoint. Parses the `Cf-Access-Jwt-Assertion` header and displays:
- User's email address
- Authentication timestamp
- Country (as clickable link to flag)

**Example Response:**
```
michaelsolsen@gmail.com authenticated at Thu, 02 Oct 2025 22:30:15 GMT from US
```
(where "US" is a link to `/secure/US`)

### `/secure/:country`
Displays the flag for the specified country code (ISO 3166-1 alpha-2).

**Example:**
- `/secure/US` - United States flag
- `/secure/CA` - Canada flag
- `/secure/GB` - United Kingdom flag

Flags are fetched from the private R2 bucket and displayed as base64-encoded images in HTML.

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI (`npx wrangler`)
- R2 bucket named `country-flags`

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create R2 Bucket

```bash
npx wrangler r2 bucket create country-flags
```

### 3. Upload Country Flags

Upload all 195+ country flags to R2:

```bash
./upload-all-flags.sh
```

Or upload a subset:

```bash
./upload-flags.sh  # Uploads 15 common countries
```

### 4. Configure Wrangler

The `wrangler.jsonc` file is already configured with the R2 binding:

```json
"r2_buckets": [
  {
    "binding": "FLAGS",
    "bucket_name": "country-flags"
  }
]
```

## Development

### Run Locally

```bash
npm run start
# or
npx wrangler dev
```

Access at: `http://localhost:8787/secure`

**Note:** Local development won't have the Cloudflare Access JWT header. You can test by manually setting the header or deploying to Cloudflare.

### Run Tests

```bash
npm test
```

## Deployment

### Deploy to Cloudflare

```bash
npm run deploy
# or
npx wrangler deploy
```

### Configure Route

After deployment, configure the Worker route in Cloudflare dashboard:

1. Go to **Workers & Pages** → Your Worker
2. Add route: `tunnel.yourdomain.com/secure*`
3. Or use a custom domain

### Integration with Cloudflare Access

This Worker is designed to work behind Cloudflare Access:

1. Set up Cloudflare Access application protecting your route
2. Configure IdPs (Google, Okta, etc.)
3. Access policies determine who can authenticate
4. Worker reads `Cf-Access-Jwt-Assertion` header from authenticated requests

## JWT Token Structure

The Worker decodes the JWT payload to extract:

```json
{
  "email": "user@example.com",
  "iat": 1696272615,
  "country": "US",
  "sub": "user-id-from-idp"
}
```

**Note:** This implementation does NOT verify JWT signatures. In production, you should verify the JWT signature using Cloudflare's public keys.

## Security Considerations

### Current Implementation
- ✅ Reads from private R2 bucket (not publicly accessible)
- ✅ Requires Cloudflare Access authentication
- ✅ HTML output is escaped to prevent XSS
- ⚠️ JWT signature is NOT verified

### Production Recommendations
- Add JWT signature verification
- Implement rate limiting
- Add content security policy headers
- Validate country codes against allowlist
- Add request logging and monitoring

## File Structure

```
header-auth-worker/
├── src/
│   └── index.ts              # Main Worker code
├── wrangler.jsonc            # Wrangler configuration
├── package.json              # Dependencies
├── upload-flags.sh           # Upload 15 common flags
├── upload-all-flags.sh       # Upload all 195+ flags
├── README.md                 # This file
└── test/
    └── index.spec.ts         # Tests
```

## Supported Countries

All 195+ countries with ISO 3166-1 alpha-2 codes are supported, including:

- US, CA, MX (North America)
- GB, DE, FR, IT, ES (Europe)
- CN, JP, IN, KR (Asia)
- AU, NZ (Oceania)
- BR, AR, CL (South America)
- ZA, EG, NG (Africa)
- And many more...

## API Reference

### Environment Variables

```typescript
interface Env {
  FLAGS: R2Bucket;  // R2 bucket containing country flag PNGs
}
```

### JWT Payload Interface

```typescript
interface JWTPayload {
  email?: string;    // User's email address
  iat?: number;      // Issued at timestamp (Unix epoch)
  country?: string;  // ISO 3166-1 alpha-2 country code
  sub?: string;      // Subject (user ID from IdP)
}
```

## Troubleshooting

### No JWT Found
**Error:** "No Cloudflare Access JWT found. Please authenticate."

**Solution:** Ensure the Worker route is protected by Cloudflare Access and you're accessing through the authenticated domain.

### Flag Not Found
**Error:** "Flag for country code 'XX' not found."

**Solutions:**
- Verify the country code is valid ISO 3166-1 alpha-2
- Check if the flag was uploaded to R2: `npx wrangler r2 object list country-flags`
- Re-upload flags: `./upload-all-flags.sh`

### Local Development Issues
**Problem:** JWT header not present when testing locally.

**Solutions:**
- Use `wrangler dev --remote` to test against deployed Worker
- Or manually add the header in your test requests
- Or deploy to Cloudflare and test there

## License

MIT

## Author

Created for Cloudflare CSE Lab demonstration.

## Related Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
