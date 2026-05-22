import { NextResponse } from 'next/server';
import { getGoogleDriveConnectionMode } from '../google-auth';

// Cache the configured status for 60 seconds to avoid repeated checks
let cachedStatus: { configured: boolean; email: string | null; folderId: string | null; mode: string } | null = null;
let cacheTime = 0;
const STATUS_CACHE_TTL = 60000; // 60 seconds

export async function GET() {
  const now = Date.now();

  // Return cached status if still fresh
  if (cachedStatus && now - cacheTime < STATUS_CACHE_TTL) {
    return NextResponse.json({ ...cachedStatus, folderName: null });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const mode = getGoogleDriveConnectionMode();

  const isConfigured = mode === 'oauth' || !!(email && privateKey && folderId);

  // Update cache
  cachedStatus = {
    configured: isConfigured,
    email: email || null,
    folderId: folderId || null,
    mode,
  };
  cacheTime = now;

  // Return instantly without making any Google Drive network call.
  // Folder name is not critical for functionality; it's display-only.
  return NextResponse.json({
    configured: isConfigured,
    email: mode === 'oauth' ? 'Google account connected' : email || null,
    folderId: folderId || null,
    mode,
    folderName: null,
  });
}
