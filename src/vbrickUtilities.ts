import { fileURLToPath } from "node:url";
import { config } from "./config.ts";
import path from "node:path";

let vbrickAccessToken: string | null = null;
let vbrickTokenRefreshTimeout: NodeJS.Timeout | null = null;

export async function makeVbrickRevApiRequest<T>(url: string): Promise<T | null> {
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
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    } 
    else if (contentType.includes("application/octet-stream") || contentType.includes("stream") || response.body) {
      // @ts-ignore: allow returning ReadableStream for caller to handle
      return response.body as any;
    } 
    else {
      // @ts-ignore: allow returning string for caller to handle
      return (await response.text()) as any;
    }
  } catch (error) {
    console.error("Error making Vbrick Rev request:", error);
    return null;
  }
}
function getVbrickAccessToken() {
  return vbrickAccessToken;
}

export function setVbrickAccessToken(token: string) {
  vbrickAccessToken = token;
}

export async function authenticateVbrickAndScheduleRefresh(): Promise<string | null> {
  console.warn("Authenticating with Vbrick...", config.apiKey);
  if (config.apiKey == null || config.apiKey === "") {
    return null;
  }

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
    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) {
      throw new Error(`Auth error! status: ${response.status}`);
    }
    const data = await response.json();
    const token = data.token || null;
    const expiresIn = data.expires_in || 3600; // seconds, fallback to 1 hour

    if (token) {
      vbrickAccessToken = token;
      if (vbrickTokenRefreshTimeout) clearTimeout(vbrickTokenRefreshTimeout);
      const refreshMs = Math.max((expiresIn - 60) * 1000, 10000); // at least 10s
      vbrickTokenRefreshTimeout = setTimeout(() => {
        authenticateVbrickAndScheduleRefresh().then((newToken) => {
          if (newToken) {
            console.warn("Vbrick token refreshed.");
          } else {
            console.error("Failed to refresh Vbrick token.");
          }
        });
      }, refreshMs);
    }
    return token;
  } catch (error) {
    console.error("Error authenticating with Vbrick:", error);
    return null;
  }
}

export function getFolderPath(folderName: string) : string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, folderName);
}

export function formatResponse(data: any, type: string): { content: { type: "text"; text: string }[] } {
  return {
    content: [
      {
        type: "text",
        text: type === "json" ? JSON.stringify(data, null, 2) : String(data)
      }
    ]
  };
}