import dotenv from 'dotenv';
import path from 'node:path';
import { getFolderPath } from './vbrickUtilities.ts'

const env = process.env.NODE_ENV;

let envFile = '.env';

if (env) {
    envFile = `.env.${env}`;
}

let envpath = path.join(getFolderPath('..'), envFile);

console.warn(`Loading environment variables from ${envpath}`);
dotenv.config({ path: envpath, quiet: true });

export const config = {
    vbrickRevTenantUrl: process.env.VBRICK_REV_TENANT_URL?.replace(/\/$/, '') || "https://tenant.rev.vbrick.com",
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
