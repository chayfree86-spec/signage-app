import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const isConfigured = !!(email && privateKey && folderId);

  let folderName: string | null = null;

  // Fetch the actual folder name from Google Drive
  if (isConfigured && privateKey && email && folderId) {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: email,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.get({
        fileId: folderId,
        fields: 'name',
      });
      folderName = res.data.name || null;
    } catch (err) {
      console.error('Failed to fetch folder name from Google Drive:', err);
      folderName = null;
    }
  }

  return NextResponse.json({
    configured: isConfigured,
    email: email || null,
    folderId: folderId || null,
    folderName: folderName,
  });
}
