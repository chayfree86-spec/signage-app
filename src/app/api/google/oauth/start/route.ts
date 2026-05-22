import { NextResponse } from 'next/server';
import { getOAuthClient } from '@/app/api/drive/google-auth';

export async function GET(request: Request) {
  try {
    const auth = getOAuthClient(request);
    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google OAuth is not configured.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
