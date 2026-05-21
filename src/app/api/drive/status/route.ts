import { NextResponse } from 'next/server';

export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const isConfigured = !!(email && privateKey && folderId);

  return NextResponse.json({
    configured: isConfigured,
    email: email || null,
    folderId: folderId || null,
  });
}
