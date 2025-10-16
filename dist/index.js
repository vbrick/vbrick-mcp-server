#!/usr/bin/env node
import { authenticateVbrickAndScheduleRefresh, config, formatResponse, getFolderPath, setVbrickAccessToken } from "./config.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import open from "open";

//#region src/server.ts
const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename);
const REDIRECT_URI = `http://localhost:${config.oauth.port}/oauth/callback`;
let oauthAccessToken = null;
let refreshToken = null;
let tokenExpiresTimeout = null;
async function startOAuthHandler() {
	startListening(http.createServer(async (req, res) => {
		try {
			const parsedUrl = new URL(req.url || "http://localhost", `http://${req.headers.host || "localhost"}`);
			if (isLoginRequest(parsedUrl, req)) return await showLoginLink(res);
			if (isCallbackRequest(parsedUrl, req)) return handleCallback(req, res, parsedUrl);
			return handleNotFound(res);
		} catch (err) {
			handleServerError(res, err);
		}
	}));
}
function startListening(server$1) {
	const port = config.oauth.port;
	const backupPort = config.oauth.backupPort;
	let listenPort = port;
	function onListen(p) {
		console.warn(`OAuth2 server listening on port ${p}`);
	}
	function onError(err) {
		if (err.code === "EADDRINUSE" && listenPort !== backupPort) {
			console.warn(`Port ${port} in use, trying backup port ${backupPort}...`);
			server$1.close(() => {
				listenPort = backupPort;
				server$1.listen(backupPort, () => onListen(backupPort));
			});
		} else {
			if (err.code === "EADDRINUSE") console.error(`Both primary port ${port} and backup port ${backupPort} are in use. Exiting.`);
			else console.error("OAuth2 server error:", err);
			process.exit(1);
		}
	}
	server$1.on("error", onError);
	function shutdownServer() {
		server$1.close(() => {
			console.warn("OAuth2 server stopped.");
		});
	}
	process.on("SIGINT", shutdownServer);
	process.on("SIGTERM", shutdownServer);
	server$1.listen(port, () => onListen(port));
}
async function showLoginLink(res) {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);
	res.setHeader("Set-Cookie", `code_verifier=${codeVerifier}; Path=/; HttpOnly`);
	const responseType = "response_type=code";
	const client_id = `client_id=${encodeURIComponent(config.oauth.clientId)}`;
	const redirect_uri = `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
	const code_challenge = `code_challenge=${encodeURIComponent(codeChallenge)}`;
	const loginUrl = `${config.vbrickRevTenantUrl}/api/v2/oauth2/authorize?${responseType}&${client_id}&${redirect_uri}&${code_challenge}&code_challenge_method=S256`;
	const html = (await getHtmlTemplate("redirect.html")).replace(/\{\{LOGIN_URL\}\}/g, loginUrl);
	res.writeHead(200, { "Content-Type": "text/html" });
	res.end(html);
}
function base64urlEncode(buffer) {
	return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function generateCodeVerifier() {
	return base64urlEncode(crypto.randomBytes(48));
}
function generateCodeChallenge(codeVerifier) {
	return base64urlEncode(crypto.createHash("sha256").update(codeVerifier).digest());
}
function scheduleTokenRefresh(tokenJson, code, codeVerifier) {
	if (!tokenJson.refresh_token || !tokenJson.expires_in) return;
	refreshToken = tokenJson.refresh_token;
	const expiresInMs = tokenJson.expires_in * 1e3;
	if (tokenExpiresTimeout) clearTimeout(tokenExpiresTimeout);
	tokenExpiresTimeout = setTimeout(() => {
		refreshAccessToken(code, codeVerifier, refreshToken);
	}, Math.max(expiresInMs - 1e4, 1e3));
}
function refreshAccessToken(code, codeVerifier, refreshToken$1) {
	const tokenUrl = `${config.vbrickRevTenantUrl}/api/v2/oauth2/token`;
	const postData = JSON.stringify({
		code,
		client_id: config.oauth.clientId,
		grant_type: "refresh_token",
		redirect_uri: REDIRECT_URI,
		refresh_token: refreshToken$1,
		code_verifier: codeVerifier
	});
	const tokenUrlObj = new URL(tokenUrl);
	const protocolPort = tokenUrlObj.protocol === "https:" ? 443 : 80;
	const port = tokenUrlObj.port ? parseInt(tokenUrlObj.port) : protocolPort;
	const options = {
		hostname: tokenUrlObj.hostname,
		port,
		path: "/api/v2/oauth2/token",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Length": Buffer.byteLength(postData)
		}
	};
	const tokenReq = (tokenUrlObj.protocol === "https:" ? https : http).request(options, (tokenRes) => {
		let data = "";
		tokenRes.on("data", (chunk) => {
			data += chunk;
		});
		tokenRes.on("end", () => {
			if (tokenRes.statusCode === 200) {
				let tokenJson;
				try {
					tokenJson = JSON.parse(data);
					oauthAccessToken = tokenJson.access_token || null;
					setVbrickAccessToken(oauthAccessToken || "");
					scheduleTokenRefresh(tokenJson, code, codeVerifier);
					console.warn("Token refreshed successfully.", tokenJson);
				} catch (err) {
					console.error("Failed to parse refresh token response:", err);
				}
			} else console.error(`Token refresh failed: ${data}`);
		});
	});
	tokenReq.on("error", (err) => {
		console.error("Token refresh request error:", err);
	});
	tokenReq.write(postData);
	tokenReq.end();
}
function isLoginRequest(parsedUrl, req) {
	return config.oauth?.enabled && parsedUrl.pathname === "/" && req.method === "GET";
}
function isCallbackRequest(parsedUrl, req) {
	return parsedUrl.pathname === "/oauth/callback" && req.method === "GET";
}
function handleCallback(req, res, parsedUrl) {
	console.warn("OAuth2 callback received");
	const code = parsedUrl.searchParams.get("code")?.replace(/ /g, "+") || "";
	if (typeof code !== "string" || code.length === 0) {
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end("Missing code parameter.");
		return;
	}
	const cookieHeader = req.headers["cookie"] || "";
	const codeVerifierMatch = /code_verifier=([^;]+)/.exec(cookieHeader);
	const codeVerifier = codeVerifierMatch ? codeVerifierMatch[1] : null;
	if (!codeVerifier) {
		console.error("Missing code_verifier cookie.");
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end("Missing code_verifier cookie.");
		return;
	}
	exchangeToken(code, codeVerifier, res);
}
function handleNotFound(res) {
	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("Not found.");
}
function handleServerError(res, err) {
	console.warn(err);
	res.writeHead(500, { "Content-Type": "text/plain" });
	res.end("Internal server error.");
	console.error("Server error:", err);
}
function exchangeToken(code, codeVerifier, res) {
	const tokenUrl = `${config.vbrickRevTenantUrl}/api/v2/oauth2/token`;
	const postData = JSON.stringify({
		grant_type: "authorization_code",
		code,
		code_verifier: codeVerifier,
		client_id: config.oauth.clientId,
		redirect_uri: REDIRECT_URI
	});
	const tokenUrlObj = new URL(tokenUrl);
	const protocolPort = tokenUrlObj.protocol === "https:" ? 443 : 80;
	const port = tokenUrlObj.port ? parseInt(tokenUrlObj.port) : protocolPort;
	const options = {
		hostname: tokenUrlObj.hostname,
		port,
		path: "/api/v2/oauth2/token",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Length": Buffer.byteLength(postData)
		}
	};
	const tokenReq = (tokenUrlObj.protocol === "https:" ? https : http).request(options, (tokenRes) => {
		let data = "";
		tokenRes.on("data", (chunk) => {
			data += chunk;
		});
		tokenRes.on("end", async () => {
			if (tokenRes.statusCode === 200) {
				let tokenJson;
				try {
					tokenJson = JSON.parse(data);
					oauthAccessToken = tokenJson.access_token || null;
					setVbrickAccessToken(oauthAccessToken || "");
					scheduleTokenRefresh(tokenJson, code, codeVerifier);
					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(await getHtmlTemplate("success.html"));
					console.warn("OAuth2 access token set:", oauthAccessToken);
				} catch (err) {
					console.error("Failed to parse token response:", err);
					res.writeHead(500, { "Content-Type": "text/plain" });
					res.end("Failed to parse token response.");
				}
			} else {
				res.writeHead(tokenRes.statusCode || 500, { "Content-Type": "text/plain" });
				res.end(`Token exchange failed: ${data}`);
			}
		});
	});
	tokenReq.on("error", (err) => {
		console.error("Token request error:", err);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end(`Token request error: ${err.message}`);
	});
	tokenReq.write(postData);
	tokenReq.end();
}
async function getHtmlTemplate(templateName) {
	const templatePath = path.join(getFolderPath("../src/templates"), templateName);
	return await fs.promises.readFile(templatePath, "utf8");
}
function getOAuthAccessToken() {
	return oauthAccessToken;
}

//#endregion
//#region src/index.ts
const server = new McpServer({
	name: "rev-mcp-server",
	version: "1.0.0"
});
function registerAuthorizeTool() {
	server.tool("vbick_authorize", "This tool will let the user get logged in. You will not get a confirmation until the user logs in, so wait for that.", {}, async function(_args, _extra) {
		const loginUrl = `http://localhost:${config.oauth.port}/`;
		console.warn("Pop open a browser window with the login link");
		open(loginUrl);
		const maxWaitMs = 2e4;
		const pollIntervalMs = 1e3;
		let waited = 0;
		while (!getOAuthAccessToken() && waited < maxWaitMs) {
			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
			waited += pollIntervalMs;
		}
		if (getOAuthAccessToken()) return formatResponse("✅ Login successful!", "text");
		else return formatResponse("⏳ The login process is still pending. Use the who-am-i tool to keep checking if the login succeeded, or run the authorize tool again.", "text");
	});
}
async function registerTools() {
	const toolsDir = getFolderPath("tools");
	const toolFiles = fs.readdirSync(toolsDir).filter((file) => file.endsWith(".ts") || file.endsWith(".js"));
	for (const file of toolFiles) {
		const toolModule = await import(pathToFileURL(path.join(toolsDir, file)).href);
		for (const exportKey of Object.keys(toolModule)) {
			const tool = toolModule[exportKey];
			console.warn(`Registering tool: ${tool.name}`);
			server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
		}
	}
}
async function main() {
	if (config.oauth.enabled) {
		await startOAuthHandler();
		registerAuthorizeTool();
	}
	await authenticateVbrickAndScheduleRefresh();
	await registerTools();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.warn("Rev MCP Server running on stdio");
	console.warn(`Tenant: ${config.vbrickRevTenantUrl}, OAuth: ${config.oauth.enabled ? "enabled" : "disabled"}`);
}
process.on("SIGINT", () => {
	console.warn("Received SIGINT. Exiting...");
	process.exit(0);
});
process.on("SIGTERM", () => {
	console.warn("Received SIGTERM. Exiting...");
	process.exit(0);
});
main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});

//#endregion
export {  };
//# sourceMappingURL=index.js.map