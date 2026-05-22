import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getDriveContext } from '../google-auth';

export const dynamic = 'force-dynamic';

const SETTINGS_FILENAME = 'signage_settings.json';

// Server-side cache for settings
let cachedResponse: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds cache TTL

// GET: Fetch signage_settings.json from Google Drive folder
export async function GET(req: Request) {
  const now = Date.now();

  // FAST PATH: Return fresh cached response immediately
  if (cachedResponse && (now - lastFetchTime < CACHE_TTL)) {
    return NextResponse.json(cachedResponse);
  }

  // STALE-WHILE-REVALIDATE: Return stale cache immediately while refreshing in background
  if (cachedResponse) {
    // Trigger background refresh (fire-and-forget)
    refreshSettingsCache(req).catch(() => {});
    return NextResponse.json({ ...cachedResponse, stale: true });
  }

  // FIRST LOAD: Must fetch from Drive (blocking, but only once)
  return await refreshSettingsCache(req);
}

// Fetches from Drive and updates cache. Returns a NextResponse.
async function refreshSettingsCache(req: Request): Promise<any> {
  const { NextResponse } = await import('next/server');
  const now = Date.now();
  try {
    const { drive, folderId } = await getDriveContext(req, 5000);

    // 1. Search for signage_settings.json in the folder
    const searchResponse = await drive.files.list({
      q: `'${folderId}' in parents and name = '${SETTINGS_FILENAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = searchResponse.data.files || [];
    if (files.length === 0) {
      const noSettingsResponse = { success: true, settings: null, message: 'No settings file found on Drive.' };
      cachedResponse = noSettingsResponse;
      lastFetchTime = now;
      return NextResponse.json(noSettingsResponse);
    }

    const fileId = files[0].id!;

    // 2. Download the file content
    const fileResponse = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Convert stream to string
    const chunks: any[] = [];
    const stream = fileResponse.data as Readable;

    const settingsJson = await new Promise<string>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    const parsed = JSON.parse(settingsJson);
    const successResponse = { success: true, settings: parsed, fileId };

    cachedResponse = successResponse;
    lastFetchTime = now;

    return NextResponse.json(successResponse);

  } catch (error: any) {
    console.error('Google Drive Settings Fetch Error:', error);
    // On failure, return a graceful null-settings response instead of 500
    // so the client can fall back to localStorage without blocking
    const fallback = { success: true, settings: null, message: 'Drive unavailable, using local settings.' };
    // Cache for 5s on failure to avoid hammering Drive on errors
    cachedResponse = fallback;
    lastFetchTime = now - CACHE_TTL + 5000;
    return NextResponse.json(fallback);
  }
}

// POST: Save/Overwrite signage_settings.json on Google Drive folder
export async function POST(req: Request) {
  try {
    // Invalidate cache immediately on updates
    cachedResponse = null;
    lastFetchTime = 0;
    const { drive, folderId } = await getDriveContext(req, 5000);
    const { settings } = await req.json();

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid or missing settings data' }, { status: 400 });
    }

    // 1. Search if signage_settings.json already exists
    const searchResponse = await drive.files.list({
      q: `'${folderId}' in parents and name = '${SETTINGS_FILENAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = searchResponse.data.files || [];
    const jsonString = JSON.stringify(settings, null, 2);
    
    let response: any;

    if (files.length > 0) {
      // 2a. Update existing file
      const fileId = files[0].id!;
      response = await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: 'application/json',
          body: Readable.from(Buffer.from(jsonString)),
        },
        fields: 'id, name',
      });
    } else {
      // 2b. Create new file
      response = await drive.files.create({
        requestBody: {
          name: SETTINGS_FILENAME,
          parents: [folderId],
        },
        media: {
          mimeType: 'application/json',
          body: Readable.from(Buffer.from(jsonString)),
        },
        fields: 'id, name',
      });
    }

    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      name: response.data.name,
      message: 'Settings synced successfully to Google Drive.',
    });

  } catch (error: any) {
    console.error('Google Drive Settings Sync Error:', error);
    let errorMessage = error.message || 'Failed to sync settings to Google Drive';
    
    // Check for Service Account storage quota limit error
    if (errorMessage.includes('Service Accounts do not have storage quota') || 
        errorMessage.includes('storageQuotaExceeded') ||
        (error.code && error.code === 403)) {
      errorMessage = 'SERVICE_ACCOUNT_QUOTA_ERROR: Google Service Account storage limit reached. Please create an empty file named "signage_settings.json" in your shared Google Drive folder first.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
