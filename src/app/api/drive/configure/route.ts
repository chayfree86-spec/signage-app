import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to update/clear keys in .env.local
function updateEnvFile(email: string | null, privateKey: string | null, folderId: string | null) {
  const envPath = path.join(process.cwd(), '.env.local');
  let content = '';
  
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  // Split lines while keeping track of original formatting
  const lines = content.split(/\r?\n/);
  const updatedKeys = new Set<string>();

  // Format the private key to escape newlines into \n representation if they are raw newlines
  let formattedKey = privateKey;
  if (privateKey) {
    // If it already has escaped \n, keep it, otherwise escape actual newlines
    const rawKey = privateKey.trim();
    const hasEscapedNewlines = rawKey.includes('\\n');
    if (hasEscapedNewlines) {
      formattedKey = rawKey;
    } else {
      formattedKey = rawKey.replace(/\r?\n/g, '\\n');
    }
    // Ensure it is wrapped in double quotes in the file
    formattedKey = `"${formattedKey}"`;
  }

  const updates: Record<string, string | null> = {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: email,
    GOOGLE_PRIVATE_KEY: formattedKey,
    GOOGLE_DRIVE_FOLDER_ID: folderId,
  };

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return line;

    const key = trimmed.substring(0, firstEq).trim();

    if (key in updates) {
      updatedKeys.add(key);
      const val = updates[key];
      if (val === null) {
        // Return empty or commented line if disconnecting
        return `# ${key} is disconnected`;
      }
      return `${key}=${val}`;
    }
    return line;
  });

  // Append any keys that weren't in the original file
  Object.entries(updates).forEach(([key, val]) => {
    if (val !== null && !updatedKeys.has(key)) {
      newLines.push(`${key}=${val}`);
    }
  });

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, privateKey, folderId } = body;

    // Handle Disconnect Action
    if (action === 'disconnect') {
      updateEnvFile(null, null, null);

      // Mutate environment variables in running memory
      delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      delete process.env.GOOGLE_PRIVATE_KEY;
      delete process.env.GOOGLE_DRIVE_FOLDER_ID;

      return NextResponse.json({
        success: true,
        message: 'Google Drive integration disconnected successfully.',
      });
    }

    // Handle Configure Action
    if (!email || !privateKey || !folderId) {
      return NextResponse.json(
        { error: 'Email, Private Key, and Folder ID are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim();
    const cleanFolderId = folderId.trim();
    // Normalize private key string: resolve escaped newlines to actual newlines for credential verification
    const cleanPrivateKey = privateKey.trim().replace(/\\n/g, '\n');

    let folderName = '';

    // 1. Validate credentials and folder access by attempting a drive instance fetch
    try {
      const auth = new google.auth.JWT({
        email: cleanEmail,
        key: cleanPrivateKey,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.get({
        fileId: cleanFolderId,
        fields: 'name, trashed',
      });

      if (res.data.trashed) {
        return NextResponse.json(
          { error: 'The specified Google Drive folder is in the trash bin.' },
          { status: 400 }
        );
      }

      folderName = res.data.name || cleanFolderId;
    } catch (authError: any) {
      console.error('Google Drive validation error:', authError);
      return NextResponse.json(
        {
          error: `Google Drive connection failed: ${authError.message || 'Invalid Service Account Email or Private Key, or folder access not shared with Service Account.'}`,
        },
        { status: 400 }
      );
    }

    // 2. Write valid credentials to .env.local
    updateEnvFile(cleanEmail, privateKey.trim(), cleanFolderId);

    // 3. Mutate process.env in the active running Node process memory
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = cleanEmail;
    process.env.GOOGLE_PRIVATE_KEY = privateKey.trim();
    process.env.GOOGLE_DRIVE_FOLDER_ID = cleanFolderId;

    return NextResponse.json({
      success: true,
      message: 'Google Drive integration configured and connected successfully!',
      folderName,
    });

  } catch (error: any) {
    console.error('Google Drive Configuration Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to configure Google Drive' },
      { status: 500 }
    );
  }
}
