import { NextResponse } from 'next/server';
import { getDriveContext, getOAuthClient, saveDriveEnv } from '@/app/api/drive/google-auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/?googleDrive=missing-code`);
  }

  try {
    const auth = getOAuthClient(request);
    const { tokens } = await auth.getToken(code);

    saveDriveEnv({
      GOOGLE_OAUTH_TOKENS: JSON.stringify(tokens),
    });

    await getDriveContext(request);

    return NextResponse.redirect(`${origin}/?googleDrive=connected`);
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    return NextResponse.redirect(`${origin}/?googleDrive=failed`);
  }
}
