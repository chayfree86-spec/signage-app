import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    // Resolve dynamic params safely for all Next.js versions (including Next.js 15/16 async params)
    const resolvedParams = await context.params;
    const fileId = resolvedParams.fileId;

    if (!CLIENT_EMAIL || !PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Google Drive credentials are not configured on the server.' },
        { status: 500 }
      );
    }

    // Authenticate with Google Drive
    const auth = new google.auth.JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Fetch file metadata to get Content-Type and Content-Length
    const meta = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size',
    });

    const mimeType = meta.data.mimeType || 'application/octet-stream';
    const size = meta.data.size;

    // Fetch the actual file media stream from Google Drive
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const fileStream = response.data as any;

    return new Response(fileStream, {
      headers: {
        'Content-Type': mimeType,
        ...(size ? { 'Content-Length': size } : {}),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    console.error('Google Drive streaming error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stream file from Google Drive' },
      { status: 500 }
    );
  }
}
