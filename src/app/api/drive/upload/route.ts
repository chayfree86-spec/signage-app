import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

export async function POST(req: Request) {
  try {
    if (!CLIENT_EMAIL || !PRIVATE_KEY || !FOLDER_ID) {
      return NextResponse.json(
        { error: 'Google Drive credentials are not configured on the server.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Authenticate with Google Drive
    const auth = new google.auth.JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convert file arrayBuffer to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // File metadata on Google Drive
    const fileMetadata = {
      name: file.name,
      parents: [FOLDER_ID],
    };

    // Media body content stream
    const media = {
      mimeType: file.type,
      body: Readable.from(buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, size, mimeType',
    });

    const driveFile = response.data;

    // Set permission so that anyone with the link can read the file
    // This allows webContentLink direct embed URLs to work, though our proxy stream is the primary reliable option
    try {
      await drive.permissions.create({
        fileId: driveFile.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permissionError) {
      console.warn('Could not make Google Drive file public:', permissionError);
    }

    return NextResponse.json({
      success: true,
      file: {
        id: driveFile.id,
        name: driveFile.name,
        size: Number(driveFile.size || file.size),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: `/api/drive/file/${driveFile.id}`,
        driveViewUrl: driveFile.webViewLink,
        created_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Google Drive Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload to Google Drive' }, { status: 500 });
  }
}
