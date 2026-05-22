import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { normalizeGooglePrivateKey } from '../google-key';
export const dynamic = 'force-dynamic';

// Server-side cache for playlist
let cachedResponse: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds cache TTL
// Helper to authenticate and get Google Drive instance
function getDriveInstance() {
  const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const PRIVATE_KEY = normalizeGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!CLIENT_EMAIL || !PRIVATE_KEY || !FOLDER_ID) {
    throw new Error('Google Drive credentials are not configured on the server.');
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
  });

  return google.drive({ version: 'v3', auth, timeout: 5000 });
}

// GET: Fetch playlist.json from Google Drive folder
export async function GET() {
  const now = Date.now();

  // FAST PATH: Fresh cache
  if (cachedResponse && (now - lastFetchTime < CACHE_TTL)) {
    return NextResponse.json(cachedResponse);
  }

  // STALE-WHILE-REVALIDATE: Return stale data immediately, refresh in background
  if (cachedResponse) {
    refreshPlaylistCache().catch(() => {});
    return NextResponse.json({ ...cachedResponse, stale: true });
  }

  // FIRST LOAD: Blocking fetch (only happens once per server start)
  return await refreshPlaylistCache();
}

async function refreshPlaylistCache(): Promise<any> {
  const { NextResponse } = await import('next/server');
  const now = Date.now();
  try {
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const drive = getDriveInstance();

    // 1. Search for playlist.json in the folder
    const searchResponse = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name = 'playlist.json' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = searchResponse.data.files || [];
    if (files.length === 0) {
      const noPlaylistResponse = { success: true, playlists: null, message: 'No playlist file found on Drive.' };
      cachedResponse = noPlaylistResponse;
      lastFetchTime = now;
      return NextResponse.json(noPlaylistResponse);
    }

    const fileId = files[0].id!;

    // 2. Download the file content
    const fileResponse = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const chunks: any[] = [];
    const stream = fileResponse.data as Readable;

    const playlistJson = await new Promise<string>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    const parsed = JSON.parse(playlistJson);
    const successResponse = { success: true, playlists: parsed, fileId };

    cachedResponse = successResponse;
    lastFetchTime = now;

    return NextResponse.json(successResponse);

  } catch (error: any) {
    console.error('Google Drive Playlist Fetch Error:', error);
    // Graceful fallback — return null playlists so client uses localStorage
    const fallback = { success: true, playlists: null, message: 'Drive unavailable, using local playlists.' };
    cachedResponse = fallback;
    lastFetchTime = now - CACHE_TTL + 5000; // retry in 5s
    return NextResponse.json(fallback);
  }
}

// POST: Save/Overwrite playlist.json on Google Drive folder
export async function POST(req: Request) {
  try {
    // Invalidate cache immediately on updates
    cachedResponse = null;
    lastFetchTime = 0;
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const drive = getDriveInstance();
    const { playlists } = await req.json();

    if (!playlists || !Array.isArray(playlists)) {
      return NextResponse.json({ error: 'Invalid or missing playlists data' }, { status: 400 });
    }

    // 1. Search if playlist.json already exists
    const searchResponse = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name = 'playlist.json' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = searchResponse.data.files || [];
    const jsonString = JSON.stringify(playlists, null, 2);
    
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
          name: 'playlist.json',
          parents: [FOLDER_ID!],
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
      message: 'Playlist synced successfully to Google Drive.',
    });

  } catch (error: any) {
    console.error('Google Drive Playlist Sync Error:', error);
    let errorMessage = error.message || 'Failed to sync playlist to Google Drive';
    
    // Check for Service Account storage quota limit error
    if (errorMessage.includes('Service Accounts do not have storage quota') || 
        errorMessage.includes('storageQuotaExceeded') ||
        (error.code && error.code === 403)) {
      errorMessage = 'SERVICE_ACCOUNT_QUOTA_ERROR: Google Service Account storage limit reached (0-byte quota). Please create an empty file named "playlist.json" in your shared Google Drive folder first, so that you are the owner and it uses your 15 GB free personal quota.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
