import http, { IncomingMessage, ServerResponse } from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { config } from "./config.ts";
import { getFolderPath, setVbrickAccessToken } from "./vbrickUtilities.ts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REDIRECT_URI = `http://localhost:${config.oauth.port}/oauth/callback`;

let oauthAccessToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiresTimeout: NodeJS.Timeout | null = null;

async function startOAuthHandler() {
	const server = http.createServer(async (req, res) => {
		try {
			const parsedUrl = new URL(req.url || "http://localhost", `http://${req.headers.host || "localhost"}`);
			if (isLoginRequest(parsedUrl, req)) return await showLoginLink(res);
			if (isCallbackRequest(parsedUrl, req)) return handleCallback(req, res, parsedUrl);
			return handleNotFound(res);
		} catch (err) {
			handleServerError(res, err);
		}
	});

	startListening(server);
}

function startListening(server: http.Server) {
	const port = config.oauth.port;
	const backupPort = config.oauth.backupPort;
	let listenPort = port;

	function onListen(p: number) {
		console.warn(`OAuth2 server listening on port ${p}`);
	}

	function onError(err: any) {
		if (err.code === 'EADDRINUSE' && listenPort !== backupPort) {
			console.warn(`Port ${port} in use, trying backup port ${backupPort}...`);
			server.close(() => {
				listenPort = backupPort;
				server.listen(backupPort, () => onListen(backupPort));
			});
		} else {
			if (err.code === 'EADDRINUSE') {
				console.error(`Both primary port ${port} and backup port ${backupPort} are in use. Exiting.`);
			}
			else {
				console.error('OAuth2 server error:', err);
			}
			process.exit(1);
		}
	}

	server.on('error', onError);

	function shutdownServer() {
		server.close(() => {
			console.warn("OAuth2 server stopped.");
		});
	}
	process.on("SIGINT", shutdownServer);
	process.on("SIGTERM", shutdownServer);

	server.listen(port, () => onListen(port));
}

async function showLoginLink(res: ServerResponse): Promise<void> {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	res.setHeader('Set-Cookie', `code_verifier=${codeVerifier}; Path=/; HttpOnly`);
	const responseType = "response_type=code";
	const client_id = `client_id=${encodeURIComponent(config.oauth.clientId)}`;
	const redirect_uri = `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
	const code_challenge = `code_challenge=${encodeURIComponent(codeChallenge)}`;
	const code_challenge_method = `code_challenge_method=S256`;
	const loginUrl = `${config.vbrickRevTenantUrl}/api/v2/oauth2/authorize?${responseType}&${client_id}&${redirect_uri}&${code_challenge}&${code_challenge_method}`;

	const html = (await getHtmlTemplate("redirect.html")).replace(/\{\{LOGIN_URL\}\}/g, loginUrl);
	res.writeHead(200, { "Content-Type": "text/html" });
	res.end(html);
}

function base64urlEncode(buffer: Buffer): string {
	return buffer.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function generateCodeVerifier(): string {
	return base64urlEncode(crypto.randomBytes(48));
}

function generateCodeChallenge(codeVerifier: string): string {
	const hash = crypto.createHash("sha256").update(codeVerifier).digest();
	return base64urlEncode(hash);
}


function scheduleTokenRefresh(tokenJson: any, code: string, codeVerifier: string) {
	if (!tokenJson.refresh_token || !tokenJson.expires_in) return;
	refreshToken = tokenJson.refresh_token;
	const expiresInMs = tokenJson.expires_in * 1000;
	if (tokenExpiresTimeout) clearTimeout(tokenExpiresTimeout);
	tokenExpiresTimeout = setTimeout(() => {
		refreshAccessToken(code, codeVerifier, refreshToken!);
	}, Math.max(expiresInMs - 10000, 1000)); // refresh 10s before expiry
}

function refreshAccessToken(code: string, codeVerifier: string, refreshToken: string) {
	const tokenUrl = `${config.vbrickRevTenantUrl}/api/v2/oauth2/token`;
	const postData = JSON.stringify({
		code,
		client_id: config.oauth.clientId,
		grant_type: "refresh_token",
		redirect_uri: REDIRECT_URI,
		refresh_token: refreshToken,
		code_verifier: codeVerifier
	});
	const tokenUrlObj = new URL(tokenUrl);
	const protocolPort = tokenUrlObj.protocol === "https:" ? 443 : 80;
	const port = tokenUrlObj.port ? parseInt(tokenUrlObj.port) : protocolPort;
	const options = {
		hostname: tokenUrlObj.hostname,
		port: port,
		path: "/api/v2/oauth2/token",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Length": Buffer.byteLength(postData)
		}
	};
	const protocol = tokenUrlObj.protocol === "https:" ? https : http;
	const tokenReq = protocol.request(options, (tokenRes: IncomingMessage) => {
		let data = "";
		tokenRes.on("data", (chunk) => { data += chunk; });
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
			} else {
				console.error(`Token refresh failed: ${data}`);
			}
		});
	});
	tokenReq.on("error", (err: Error) => {
		console.error("Token refresh request error:", err);
	});
	tokenReq.write(postData);
	tokenReq.end();
}

function isLoginRequest(parsedUrl: URL, req: http.IncomingMessage) {
	return config.oauth?.enabled && parsedUrl.pathname === "/" && req.method === "GET";
}

function isCallbackRequest(parsedUrl: URL, req: http.IncomingMessage) {
	return parsedUrl.pathname === "/oauth/callback" && req.method === "GET";
}

function handleCallback(req: http.IncomingMessage, res: ServerResponse, parsedUrl: URL) {
	console.warn("OAuth2 callback received");
	const code = parsedUrl.searchParams.get("code")?.replace(/ /g, "+") || "";

	if (typeof code !== "string" || code.length === 0) {
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end("Missing code parameter.");
		return;
	}
	// Retrieve code_verifier from cookie using RegExp.exec()
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

function handleNotFound(res: ServerResponse) {
	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("Not found.");
}

function handleServerError(res: ServerResponse, err: any) {
	console.warn(err);
	res.writeHead(500, { "Content-Type": "text/plain" });
	res.end("Internal server error.");
	console.error("Server error:", err);
}

function exchangeToken(code: string, codeVerifier: string, res: ServerResponse) {
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
		port: port,
		path: "/api/v2/oauth2/token",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Content-Length": Buffer.byteLength(postData)
		}
	};
	const protocol = tokenUrlObj.protocol === "https:" ? https : http;
	const tokenReq = protocol.request(options, (tokenRes: IncomingMessage) => {
		let data = "";
		tokenRes.on("data", (chunk) => { data += chunk; });
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
	tokenReq.on("error", (err: Error) => {
		console.error("Token request error:", err);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end(`Token request error: ${err.message}`);
	});
	tokenReq.write(postData);
	tokenReq.end();
}

async function getHtmlTemplate(templateName: string): Promise<string> {
  const templatePath = path.join(getFolderPath("templates"), templateName);
  const html = await fs.promises.readFile(templatePath, "utf8");
  return html;
}

function getOAuthAccessToken(): string | null {
	return oauthAccessToken;
}

export { startOAuthHandler, getOAuthAccessToken };
