/**
 * Cloudflare Worker: Header Authentication Display
 *
 * Parses Cloudflare Access JWT tokens and displays authentication information
 * Serves country flags from private R2 bucket
 */

interface Env {
	FLAGS: R2Bucket;
}

interface JWTPayload {
	email?: string;
	iat?: number;
	country?: string;
	sub?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Route: /secure - Main authentication display
		if (url.pathname === '/secure') {
			return handleSecure(request);
		}

		// Route: /secure/:country - Display country flag
		const countryMatch = url.pathname.match(/^\/secure\/([A-Z]{2})$/i);
		if (countryMatch) {
			const country = countryMatch[1].toUpperCase();
			return handleCountryFlag(country, env);
		}

		// Default route
		return new Response('Not Found. Try /secure', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handle /secure route - Parse JWT and display authentication info
 */
async function handleSecure(request: Request): Promise<Response> {
	// Get Cloudflare Access JWT from CF_Authorization cookie
	// Workers receive the cookie set by Access, not the header (which is added at origin)
	const cookieHeader = request.headers.get('Cookie');
	let jwtToken: string | null = null;

	if (cookieHeader) {
		const cookies = cookieHeader.split(';');
		for (const cookie of cookies) {
			const trimmed = cookie.trim();
			if (trimmed.startsWith('CF_Authorization=')) {
				jwtToken = trimmed.substring('CF_Authorization='.length);
				break;
			}
		}
	}

	if (!jwtToken) {
		return new Response(
			renderHTML('Authentication Required', '<p>No Cloudflare Access JWT found. Please authenticate.</p>'),
			{
				status: 401,
				headers: { 'Content-Type': 'text/html' }
			}
		);
	}

	try {
		// Decode JWT (base64url decode the payload)
		const payload = decodeJWT(jwtToken);

		const email = payload.email || 'Unknown';
		const country = payload.country || 'Unknown';
		const timestamp = payload.iat
			? new Date(payload.iat * 1000).toUTCString()
			: 'Unknown';

		// Build HTML response
		const message = `${email} authenticated at ${timestamp} from `;
		const countryLink = `<a href="/secure/${country}">${country}</a>`;

		const html = renderHTML(
			'Authentication Info',
			`<p>${message}${countryLink}</p>`
		);

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' }
		});

	} catch (error) {
		return new Response(
			renderHTML('Error', `<p>Error parsing JWT: ${error.message}</p>`),
			{
				status: 500,
				headers: { 'Content-Type': 'text/html' }
			}
		);
	}
}

/**
 * Handle /secure/:country route - Display country flag from R2
 */
async function handleCountryFlag(country: string, env: Env): Promise<Response> {
	try {
		// Fetch flag from R2 bucket
		const flagKey = `${country}.png`;
		const flag = await env.FLAGS.get(flagKey);

		if (!flag) {
			return new Response(
				renderHTML(
					`Flag for ${country}`,
					`<p>Flag for country code "${country}" not found.</p>
					<p><a href="/secure">← Back to authentication info</a></p>`
				),
				{
					status: 404,
					headers: { 'Content-Type': 'text/html' }
				}
			);
		}

		// Get flag image as blob
		const flagBlob = await flag.blob();

		// Create HTML page with flag image
		const html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Flag: ${country}</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						max-width: 800px;
						margin: 50px auto;
						padding: 20px;
						text-align: center;
					}
					.flag-container {
						margin: 30px 0;
						border: 1px solid #ddd;
						border-radius: 8px;
						padding: 20px;
						background: #f9f9f9;
					}
					.flag-container img {
						max-width: 100%;
						height: auto;
						border: 2px solid #333;
						box-shadow: 0 4px 6px rgba(0,0,0,0.1);
					}
					.back-link {
						margin-top: 30px;
						font-size: 16px;
					}
					.back-link a {
						color: #0066cc;
						text-decoration: none;
					}
					.back-link a:hover {
						text-decoration: underline;
					}
				</style>
			</head>
			<body>
				<h1>Country: ${country}</h1>
				<div class="flag-container">
					<img src="data:image/png;base64,${await blobToBase64(flagBlob)}" alt="Flag of ${country}">
				</div>
				<div class="back-link">
					<a href="/secure">← Back to authentication info</a>
				</div>
			</body>
			</html>
		`;

		return new Response(html, {
			headers: { 'Content-Type': 'text/html' }
		});

	} catch (error) {
		return new Response(
			renderHTML('Error', `<p>Error loading flag: ${error.message}</p>`),
			{
				status: 500,
				headers: { 'Content-Type': 'text/html' }
			}
		);
	}
}

/**
 * Decode JWT payload (simple base64url decode - no signature verification)
 * Note: In production, you should verify the JWT signature
 */
function decodeJWT(jwt: string): JWTPayload {
	const parts = jwt.split('.');
	if (parts.length !== 3) {
		throw new Error('Invalid JWT format');
	}

	// Decode payload (second part)
	const payload = parts[1];

	// Base64url decode
	const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
	const jsonPayload = atob(base64);

	return JSON.parse(jsonPayload);
}

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
	const arrayBuffer = await blob.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Render simple HTML page
 */
function renderHTML(title: string, content: string): string {
	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${title}</title>
			<style>
				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
					max-width: 800px;
					margin: 50px auto;
					padding: 20px;
					line-height: 1.6;
				}
				h1 {
					color: #333;
					border-bottom: 2px solid #0066cc;
					padding-bottom: 10px;
				}
				a {
					color: #0066cc;
					text-decoration: none;
					font-weight: bold;
				}
				a:hover {
					text-decoration: underline;
				}
				p {
					font-size: 18px;
					color: #555;
				}
			</style>
		</head>
		<body>
			<h1>${title}</h1>
			${content}
		</body>
		</html>
	`;
}
