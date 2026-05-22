import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { normalizeGooglePrivateKey } from './google-key';

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

function updateEnvFile(updates: Record<string, string | null>) {
  const envPath = path.join(process.cwd(), '.env.local');
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const lines = content.split(/\r?\n/);
  const updatedKeys = new Set<string>();

  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return line;

    const key = trimmed.substring(0, firstEq).trim();
    if (!(key in updates)) return line;

    updatedKeys.add(key);
    const value = updates[key];
    return value === null ? `# ${key} is disconnected` : `${key}=${value}`;
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== null && !updatedKeys.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  });

  fs.writeFileSync(envPath, nextLines.join('\n'), 'utf8');
}

export function saveDriveEnv(updates: Record<string, string | null>) {
  updateEnvFile(updates);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value.replace(/^"|"$/g, '');
    }
  });
}

export function getOAuthRedirectUri(request: Request) {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }

  return `${new URL(request.url).origin}/api/google/oauth/callback`;
}

export function getOAuthClient(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth Client ID and Client Secret are not configured.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, getOAuthRedirectUri(request));
}

function getStoredOAuthTokens() {
  const raw = process.env.GOOGLE_OAUTH_TOKENS;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(raw.replace(/^"|"$/g, ''));
    } catch {
      return null;
    }
  }
}

async function getOAuthAuth(request?: Request) {
  if (!request) return null;

  const tokens = getStoredOAuthTokens();
  if (!tokens) return null;

  const auth = getOAuthClient(request);
  auth.setCredentials(tokens);
  return auth;
}

function getServiceAccountAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  if (!clientEmail || !privateKey) return null;

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: DRIVE_SCOPES,
  });
}

async function ensureDriveFolder(drive: ReturnType<typeof google.drive>) {
  const configuredFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (configuredFolderId) return configuredFolderId;

  const folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'Chay Signage Storage';
  const existing = await drive.files.list({
    q: `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1,
  });

  const found = existing.data.files?.[0]?.id;
  if (found) {
    saveDriveEnv({ GOOGLE_DRIVE_FOLDER_ID: found });
    return found;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  if (!created.data.id) {
    throw new Error('Google Drive folder could not be created.');
  }

  saveDriveEnv({ GOOGLE_DRIVE_FOLDER_ID: created.data.id });
  return created.data.id;
}

export async function getDriveContext(request?: Request, timeout = 5000) {
  const auth = await getOAuthAuth(request) || getServiceAccountAuth();
  if (!auth) {
    throw new Error('Google Drive is not connected. Use Sign in with Google or service-account setup.');
  }

  const drive = google.drive({ version: 'v3', auth, timeout });
  const folderId = await ensureDriveFolder(drive);

  return { drive, folderId };
}

export function getGoogleDriveConnectionMode() {
  if (getStoredOAuthTokens()) return 'oauth';
  if (getServiceAccountAuth()) return 'service-account';
  return 'none';
}
