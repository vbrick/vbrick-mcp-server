import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

//#region src/vbrickUtilities.ts
let vbrickAccessToken = null;
let vbrickTokenRefreshTimeout = null;
async function makeVbrickRevApiRequest(url) {
	let token = getVbrickAccessToken();
	if (!token) {
		console.error("No Vbrick access token available");
		return null;
	}
	const headers = {
		"User-Agent": config.userAgent,
		Accept: "application/json",
		Authorization: `VBrick ${token}`
	};
	try {
		console.warn(`Headers: ${JSON.stringify(headers)}`);
		console.warn(`Making Vbrick Rev API request to: ${url}`);
		const response = await fetch(url, { headers });
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("application/json")) return await response.json();
		else if (contentType.includes("application/octet-stream") || contentType.includes("stream") || response.body) return response.body;
		else return await response.text();
	} catch (error) {
		console.error("Error making Vbrick Rev request:", error);
		return null;
	}
}
function getVbrickAccessToken() {
	return vbrickAccessToken;
}
function setVbrickAccessToken(token) {
	vbrickAccessToken = token;
}
async function authenticateVbrickAndScheduleRefresh() {
	console.warn("Authenticating with Vbrick...", config.apiKey);
	if (config.apiKey == null || config.apiKey === "") return null;
	const url = `${config.vbrickRevTenantUrl}/api/v2/authenticate`;
	const body = JSON.stringify({
		apiKey: config.apiKey,
		secret: config.secret
	});
	const headers = {
		"User-Agent": config.userAgent,
		"Content-Type": "application/json",
		Accept: "application/json"
	};
	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body
		});
		if (!response.ok) throw new Error(`Auth error! status: ${response.status}`);
		const data = await response.json();
		const token = data.token || null;
		const expiresIn = data.expires_in || 3600;
		if (token) {
			vbrickAccessToken = token;
			if (vbrickTokenRefreshTimeout) clearTimeout(vbrickTokenRefreshTimeout);
			const refreshMs = Math.max((expiresIn - 60) * 1e3, 1e4);
			vbrickTokenRefreshTimeout = setTimeout(() => {
				authenticateVbrickAndScheduleRefresh().then((newToken) => {
					if (newToken) console.warn("Vbrick token refreshed.");
					else console.error("Failed to refresh Vbrick token.");
				});
			}, refreshMs);
		}
		return token;
	} catch (error) {
		console.error("Error authenticating with Vbrick:", error);
		return null;
	}
}
function getFolderPath(folderName) {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	return path.join(__dirname, folderName);
}
function formatResponse(data, type) {
	return { content: [{
		type: "text",
		text: type === "json" ? JSON.stringify(data, null, 2) : String(data)
	}] };
}

//#endregion
//#region src/config.ts
const env = process.env.NODE_ENV;
let envFile = ".env";
if (env) envFile = `.env.${env}`;
let envpath = path.join(getFolderPath(".."), envFile);
console.warn(`Loading environment variables from ${envpath}`);
dotenv.config({
	path: envpath,
	quiet: true
});
const config = {
	vbrickRevTenantUrl: process.env.VBRICK_REV_TENANT_URL?.replace(/\/$/, "") || "https://tenant.rev.vbrick.com",
	userAgent: process.env.USER_AGENT || "rev-mcp-server-app/1.0",
	apiKey: process.env.API_KEY || "",
	secret: process.env.SECRET || "",
	oauth: {
		enabled: process.env.OAUTH_ENABLED ? process.env.OAUTH_ENABLED === "true" : true,
		clientId: process.env.OAUTH_CLIENT_ID || "vbrick-mcp-server",
		scopes: process.env.OAUTH_SCOPES || "openid profile email",
		port: process.env.OAUTH_PORT ? Number(process.env.OAUTH_PORT) : 8008,
		backupPort: process.env.OAUTH_BACKUP_PORT ? Number(process.env.OAUTH_BACKUP_PORT) : 8009
	}
};

//#endregion
export { authenticateVbrickAndScheduleRefresh, config, formatResponse, getFolderPath, makeVbrickRevApiRequest, setVbrickAccessToken };
//# sourceMappingURL=config.js.map