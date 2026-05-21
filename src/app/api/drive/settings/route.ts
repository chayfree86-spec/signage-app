import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

const SETTINGS_FILENAME = 'signage_settings.json';

// Helper to authenticate and get Google Drive instance
function getDriveInstance() {
  const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!CLIENT_EMAIL || !PRIVATE_KEY || !FOLDER_ID) {
    throw new Error('Google Drive credentials are not configured on the server.');
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
  });

  return google.drive({ version: 'v3', auth, timeout: 3000 });
}

// GET: Fetch signage_settings.json from Google Drive folder
export async function GET() {
  try {
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const drive = getDriveInstance();

    // 1. Search for signage_settings.json in the folder
    const searchResponse = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name = '${SETTINGS_FILENAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = searchResponse.data.files || [];
    if (files.length === 0) {
      // File does not exist yet
      return NextResponse.json({ success: true, settings: null, message: 'No settings file found on Drive.' });
    }

    const fileId = files[0].id!;

    // 2. Download the file content
    const fileResponse = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
      },
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

    return NextResponse.json({
      success: true,
      settings: parsed,
      fileId,
    });

  } catch (error: any) {
    console.error('Google Drive Settings Fetch Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings from Google Drive' },
      { status: 500 }
    );
  }
}

// POST: Save/Overwrite signage_settings.json on Google Drive folder
export async function POST(req: Request) {
  try {
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const drive = getDriveInstance();
    const { settings } = await req.json();

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid or missing settings data' }, { status: 400 });
    }

    // 1. Search if signage_settings.json already exists
    const searchResponse = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name = '${SETTINGS_FILENAME}' and trashed = false`,
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
