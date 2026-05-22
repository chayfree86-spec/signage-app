import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getDriveContext } from '../google-auth';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const { drive, folderId } = await getDriveContext(req, 3000);

    // Convert file arrayBuffer to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // File metadata on Google Drive
    const fileMetadata = {
      name: file.name,
      parents: [folderId],
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
