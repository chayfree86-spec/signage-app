import { getSupabaseClient } from './supabase';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  size: number;
  position: number;
  active: boolean;
  slide_duration?: number; // Custom duration override (in seconds)
  created_at: string;
  localBlob?: Blob; // Dynamic blob for local fallback URL regeneration
  scale_mode?: 'cover' | 'contain' | 'stretch';
  brightness?: number;
  contrast?: number;
  grayscale?: number;
  blur?: number;
  rotation?: number;
  overlay_text?: string;
  overlay_text_color?: string;
  overlay_text_position?: 'top' | 'middle' | 'bottom';
}

export interface Playlist {
  id: string;
  name: string;
  active: boolean;
  is_online: boolean;
  schedule_enabled: boolean;
  schedule_start_date?: string; // YYYY-MM-DD
  schedule_end_date?: string; // YYYY-MM-DD
  schedule_start_time?: string; // HH:MM
  schedule_end_time?: string; // HH:MM
  items: MediaItem[];
  created_at: string;
  transition_style?: 'fade-scale' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'zoom' | 'rotate';
}

export interface YouTubeItem {
  id: string;
  url: string;
  enabled: boolean;
  title?: string;
}

export interface YouTubePlaylist {
  id: string;
  name: string;
  active: boolean;
  items: YouTubeItem[];
  created_at: string;
}

export interface SignageSettings {
  youtube_url: string;
  youtube_enabled: boolean;
  qr_text: string;
  qr_enabled: boolean;
  qr_position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  qr_size: number;
  slide_duration: number;
  mute: boolean;
  youtube_active_id?: string;
  youtube_playlists?: string;
  youtube_loop?: boolean;
}

const DEFAULT_SETTINGS: SignageSettings = {
  youtube_url: 'https://www.youtube.com/watch?v=5qap5aO4i9A', // Beautiful ambient chill music video as default
  youtube_enabled: false,
  qr_text: 'https://github.com',
  qr_enabled: true,
  qr_position: 'bottom-right',
  qr_size: 120,
  slide_duration: 8,
  mute: true,
  youtube_active_id: '',
  youtube_playlists: '',
  youtube_loop: true,
};

// ----------------------------------------------------
// INDEXED DB IMPLEMENTATION FOR OFFLINE FILE STORAGE
// ----------------------------------------------------
const DB_NAME = 'SignageLocalDB';
const DB_VERSION = 1;

function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject('Window is undefined');
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('media_meta')) {
        db.createObjectStore('media_meta', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('media_files')) {
        db.createObjectStore('media_files', { keyPath: 'id' });
      }
    };
  });
}

// Helper to save binary file in IndexedDB
async function saveLocalFile(id: string, blob: Blob, filename: string): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media_files', 'readwrite');
    const store = tx.objectStore('media_files');
    const request = store.put({ id, blob, filename });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to get binary file from IndexedDB
async function getLocalFile(id: string): Promise<Blob | null> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media_files', 'readonly');
    const store = tx.objectStore('media_files');
    const request = store.get(id);
    request.onsuccess = () => {
      resolve(request.result ? request.result.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Helper to delete binary file from IndexedDB
async function deleteLocalFile(id: string): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media_files', 'readwrite');
    const store = tx.objectStore('media_files');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to save metadata in IndexedDB
async function saveLocalMeta(meta: MediaItem | Omit<MediaItem, 'url'>): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media_meta', 'readwrite');
    const store = tx.objectStore('media_meta');
    const request = store.put(meta);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper to get all metadata from IndexedDB
async function getLocalMetaList(): Promise<(MediaItem | Omit<MediaItem, 'url'>)[]> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media_meta', 'readonly');
    const store = tx.objectStore('media_meta');
    const request = store.getAll();
    request.onsuccess = () => {
      const list = request.result || [];
      // Sort by position
      list.sort((a, b) => a.position - b.position);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

// Helper to delete metadata from IndexedDB
async function deleteLocalMeta(id: string): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('media_meta', 'readwrite');
    const store = tx.objectStore('media_meta');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Keep track of active Blob URLs to revoke them and avoid memory leaks
const activeBlobUrls = new Map<string, string>();

function makeBlobUrl(id: string, blob: Blob): string {
  if (activeBlobUrls.has(id)) {
    // Reuse existing Blob URL to prevent revoking URLs still in use by other components
    return activeBlobUrls.get(id)!;
  }
  const url = URL.createObjectURL(blob);
  activeBlobUrls.set(id, url);
  return url;
}

// ----------------------------------------------------
// UNIFIED DATA CONTROLLER (SUPABASE + INDEXEDDB FALLBACK)
// ----------------------------------------------------

export async function fetchSettings(): Promise<SignageSettings> {
  // ============================================================
  // FAST PATH: Return from localStorage immediately (no network wait)
  // This ensures the loading screen disappears instantly.
  // Drive/Supabase sync happens in the background.
  // ============================================================
  
  let localSettings: SignageSettings = DEFAULT_SETTINGS;
  
  if (typeof window !== 'undefined') {
    // Try localStorage cache first — always instant
    const saved = localStorage.getItem('signage_settings');
    if (saved) {
      try {
        localSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        localSettings = DEFAULT_SETTINGS;
      }
    }
  }
  
  // Fire-and-forget background sync from Drive (does NOT block return)
  syncSettingsFromDriveInBackground();
  
  return localSettings;
}

// Background sync: fetches from Drive and updates localStorage silently
function syncSettingsFromDriveInBackground(): void {
  if (typeof window === 'undefined') return;
  
  checkGoogleDriveConfigured().then(async isDriveConfigured => {
    if (!isDriveConfigured) return;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/drive/settings', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          const driveSettings = { ...DEFAULT_SETTINGS, ...data.settings };
          localStorage.setItem('signage_settings', JSON.stringify(driveSettings));
          // Dispatch custom event so page can react to fresh data
          window.dispatchEvent(new CustomEvent('settings-synced-from-drive', { detail: driveSettings }));
        }
      }
    } catch {
      // Silently ignore Drive sync failures — local data is already returned
    }
  }).catch(() => {});
}



export function sanitizeSettingsForDb(settings: SignageSettings) {
  return {
    youtube_url: settings.youtube_url,
    youtube_enabled: settings.youtube_enabled,
    qr_text: settings.qr_text,
    qr_enabled: settings.qr_enabled,
    qr_position: settings.qr_position,
    qr_size: Number(settings.qr_size),
    slide_duration: Number(settings.slide_duration),
    mute: settings.mute,
    youtube_active_id: settings.youtube_active_id || null,
    youtube_playlists: settings.youtube_playlists || null,
    youtube_loop: settings.youtube_loop !== undefined ? settings.youtube_loop : true,
  };
}

export async function updateSettings(settings: Partial<SignageSettings>): Promise<SignageSettings> {
  const current = await fetchSettings();
  const updated = { ...current, ...settings };

  // Write to Supabase if active
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      window.dispatchEvent(new CustomEvent('supabase-syncing'));
      const dbPayload = sanitizeSettingsForDb(updated);
      
      // Get settings count first
      const { data } = await supabase.from('settings').select('id').limit(1);
      if (data && data.length > 0) {
        // Update existing row (assuming single-row layout)
        const { error } = await supabase
          .from('settings')
          .update(dbPayload)
          .eq('id', data[0].id);
        if (error) throw error;
      } else {
        // Insert new settings row
        const { error } = await supabase
          .from('settings')
          .insert([dbPayload]);
        if (error) throw error;
      }
      window.dispatchEvent(new CustomEvent('supabase-synced', { detail: { success: true } }));
    } catch (e) {
      console.error('Supabase settings update failed in db.ts:', e);
      window.dispatchEvent(new CustomEvent('supabase-synced', { detail: { success: false, error: (e as Error).message } }));
    }
  }

  // Local fallback
  if (typeof window !== 'undefined') {
    localStorage.setItem('signage_settings', JSON.stringify(updated));
  }

  // Background async sync to Google Drive for cross-PC persistence
  syncSettingsToDrive(updated);

  return updated;
}

// Background async sync settings to Google Drive (fire-and-forget)
function syncSettingsToDrive(settings: SignageSettings): void {
  if (typeof window === 'undefined') return;
  
  checkGoogleDriveConfigured().then(configured => {
    if (!configured) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/api/drive/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
      signal: controller.signal
    }).then(async res => {
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Failed to sync settings to Drive');
        console.warn('Drive settings sync failed:', errText);
      }
    }).catch(err => {
      clearTimeout(timeoutId);
      console.error('Error syncing settings to Google Drive:', err);
    });
  });
}

export async function fetchMedia(): Promise<MediaItem[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((item: any) => ({
          id: item.id,
          type: item.type === 'video' ? 'video' : 'image',
          url: item.url,
          name: item.name || `media-${item.id.slice(0, 6)}`,
          size: Number(item.size || 0),
          position: Number(item.position || 0),
          active: !!item.active,
          created_at: item.created_at || new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.warn('Supabase media fetch failed, loading from local:', e);
    }
  }

  // Local fallback loading
  try {
    const metaList = await getLocalMetaList();
    const listWithUrls: MediaItem[] = [];

    for (const meta of metaList) {
      // Check if it's a remote/stream URL (like Google Drive proxy or external mock URL)
      const hasRemoteUrl = 'url' in meta && (meta.url?.startsWith('/api/drive/') || meta.url?.startsWith('http'));
      
      if (hasRemoteUrl) {
        listWithUrls.push(meta as MediaItem);
        continue;
      }

      const blob = await getLocalFile(meta.id);
      if (blob) {
        const url = makeBlobUrl(meta.id, blob);
        listWithUrls.push({
          ...meta,
          url,
          localBlob: blob,
        } as MediaItem);
      } else {
        // Metadata exists but file is missing - let's cleanup
        await deleteLocalMeta(meta.id);
      }
    }
    return listWithUrls;
  } catch (error) {
    console.error('Failed to fetch local media:', error);
    return [];
  }
}

let cachedDriveConfigured: boolean | null = null;
let driveConfigPromise: Promise<boolean> | null = null;

export async function checkGoogleDriveConfigured(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Return immediately from in-memory cache (fastest path)
  if (cachedDriveConfigured !== null) {
    return cachedDriveConfigured;
  }

  // Check sessionStorage so the result survives React hot-reloads within a session
  try {
    const cached = sessionStorage.getItem('drive_configured');
    if (cached !== null) {
      cachedDriveConfigured = cached === 'true';
      return cachedDriveConfigured;
    }
  } catch {
    // sessionStorage not available — ignore
  }

  // Collapse concurrent calls into one fetch
  if (driveConfigPromise) {
    return driveConfigPromise;
  }

  driveConfigPromise = (async () => {
    try {
      const controller = new AbortController();
      // Server now responds instantly (just env var check), 3s timeout is generous
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/drive/status', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const result = !!data.configured;
        cachedDriveConfigured = result;
        try { sessionStorage.setItem('drive_configured', String(result)); } catch { /* ignore */ }
        return result;
      }
      cachedDriveConfigured = false;
      return false;
    } catch {
      cachedDriveConfigured = false;
      return false;
    } finally {
      driveConfigPromise = null;
    }
  })();

  return driveConfigPromise;
}

export async function uploadMediaItem(file: File): Promise<MediaItem> {
  const isDriveConfigured = await checkGoogleDriveConfigured();

  if (isDriveConfigured) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text() || 'Failed to upload to Google Drive');
      }

      const data = await res.json();
      if (!data.success || !data.file) {
        throw new Error('Invalid response from Google Drive upload API');
      }

      const driveFile = data.file;

      // Find next position index
      const list = await fetchMedia();
      const position = list.length > 0 ? Math.max(...list.map(m => m.position)) + 1 : 0;

      const mediaItem: MediaItem = {
        id: driveFile.id,
        type: driveFile.type,
        url: driveFile.url,
        name: driveFile.name,
        size: driveFile.size,
        position,
        active: true,
        created_at: driveFile.created_at,
      };

      // Save metadata in Supabase (if connected)
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { error: dbError } = await supabase
            .from('media')
            .insert([mediaItem]);

          if (dbError) throw dbError;
          return mediaItem;
        } catch (supabaseError) {
          console.warn('Google Drive media metadata sync to Supabase failed, saving locally:', supabaseError);
        }
      }

      // Local fallback for metadata: save in IndexedDB
      await saveLocalMeta(mediaItem);
      return mediaItem;

    } catch (e) {
      console.warn('Google Drive upload failed, falling back to standard storage methods:', e);
    }
  }

  const id = crypto.randomUUID();
  const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
  const name = file.name;
  const size = file.size;
  const created_at = new Date().toISOString();

  // Find next position index
  const list = await fetchMedia();
  const position = list.length > 0 ? Math.max(...list.map(m => m.position)) + 1 : 0;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Upload to Storage Bucket
      const bucketName = type === 'video' ? 'videos' : 'images';
      const fileExt = file.name.split('.').pop() || '';
      const filePath = `${id}.${fileExt}`;

      // Upload file bytes
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // 3. Create db record
      const mediaItem = {
        id,
        type,
        url: publicUrl,
        name,
        size,
        position,
        active: true,
        created_at,
      };

      const { error: dbError } = await supabase
        .from('media')
        .insert([mediaItem]);

      if (dbError) throw dbError;

      return mediaItem as MediaItem;
    } catch (e) {
      console.warn('Supabase media upload failed, falling back to local storage:', e);
    }
  }

  // Local fallback upload
  await saveLocalFile(id, file, name);
  const localMeta = {
    id,
    type,
    name,
    size,
    position,
    active: true,
    created_at,
  };
  await saveLocalMeta(localMeta);

  // Return item with local Blob URL
  const blobUrl = makeBlobUrl(id, file);
  return {
    ...localMeta,
    url: blobUrl,
    localBlob: file,
  };
}

export async function deleteMediaItem(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // 1. Get public url to find storage path
      const { data: record, error: fetchError } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (record) {
        const type = record.type;
        const bucketName = type === 'video' ? 'videos' : 'images';
        // Extract file path from URL (last segment)
        const parts = record.url.split('/');
        const filename = parts[parts.length - 1];

        // Delete from storage
        const { error: storageDeleteError } = await supabase.storage
          .from(bucketName)
          .remove([filename]);
        if (storageDeleteError) console.warn('Storage delete warning:', storageDeleteError);

        // Delete from table
        const { error: dbDeleteError } = await supabase
          .from('media')
          .delete()
          .eq('id', id);

        if (dbDeleteError) throw dbDeleteError;
        return;
      }
    } catch (e) {
      console.warn('Supabase media deletion failed, trying local fallback:', e);
    }
  }

  // Local fallback deletion
  await deleteLocalFile(id);
  await deleteLocalMeta(id);

  // Revoke Blob URL to free memory
  if (activeBlobUrls.has(id)) {
    URL.revokeObjectURL(activeBlobUrls.get(id)!);
    activeBlobUrls.delete(id);
  }
}

export async function toggleMediaActive(id: string, active: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('media')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
      return;
    } catch (e) {
      console.warn('Supabase media active toggle failed, trying local:', e);
    }
  }

  // Local fallback active toggle
  const metaList = await getLocalMetaList();
  const meta = metaList.find(m => m.id === id);
  if (meta) {
    meta.active = active;
    await saveLocalMeta(meta);
  }
}

export async function updatePlaylistOrder(orderedIds: string[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Perform batch updates in Supabase
      // Note: A single update RPC or multiple parallel updates. Since it's single-user, doing multiple updates is simple.
      const promises = orderedIds.map((id, index) =>
        supabase.from('media').update({ position: index }).eq('id', id)
      );
      await Promise.all(promises);
      return;
    } catch (e) {
      console.warn('Supabase playlist order update failed, trying local:', e);
    }
  }

  // Local fallback order update
  const metaList = await getLocalMetaList();
  for (const meta of metaList) {
    const index = orderedIds.indexOf(meta.id);
    if (index !== -1) {
      meta.position = index;
      await saveLocalMeta(meta);
    }
  }
}

// ----------------------------------------------------
// PLAYLIST CRUD & SCHEDULER UTILITIES
// ----------------------------------------------------

export async function fetchPlaylists(): Promise<Playlist[]> {
  if (typeof window === 'undefined') return [];

  // ============================================================
  // FAST PATH: Return from localStorage immediately.
  // Supabase/Drive sync will happen in background.
  // ============================================================
  const saved = localStorage.getItem('signage_playlists');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Playlist[];
      // Regenerate Blob URLs in background (non-blocking)
      regenerateBlobUrlsInBackground(parsed);
      // Trigger background sync from authoritative sources
      syncPlaylistsFromSourcesInBackground();
      return parsed;
    } catch {
      // Fall through to build default
    }
  }

  // FIRST RUN: No local data — try Supabase, Drive, then create default
  return await buildInitialPlaylists();
}

// Regenerate blob URLs for local media items (does not block)
function regenerateBlobUrlsInBackground(playlists: Playlist[]): void {
  (async () => {
    for (const playlist of playlists) {
      for (const item of playlist.items) {
        const blob = await getLocalFile(item.id);
        if (blob) {
          item.url = makeBlobUrl(item.id, blob);
          item.localBlob = blob;
        }
      }
    }
  })().catch(() => {});
}

// Background sync from Supabase then Drive (fire-and-forget)
function syncPlaylistsFromSourcesInBackground(): void {
  if (typeof window === 'undefined') return;

  (async () => {
    // Try Supabase first
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const parsed = data.map(row => ({
            id: row.id,
            name: row.name,
            active: !!row.active,
            is_online: !!row.is_online,
            schedule_enabled: !!row.schedule_enabled,
            schedule_start_date: row.schedule_start_date || undefined,
            schedule_end_date: row.schedule_end_date || undefined,
            schedule_start_time: row.schedule_start_time || undefined,
            schedule_end_time: row.schedule_end_time || undefined,
            items: Array.isArray(row.items) ? row.items : [],
            created_at: row.created_at,
            transition_style: row.transition_style || 'fade-scale',
          })) as Playlist[];

          localStorage.setItem('signage_playlists', JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('playlists-synced', { detail: { source: 'supabase', playlists: parsed } }));
          return; // Supabase succeeded, no need for Drive
        }
      } catch {
        // Supabase failed, try Drive
      }
    }

    // Try Google Drive
    const isDriveConfigured = await checkGoogleDriveConfigured();
    if (!isDriveConfigured) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/drive/playlist', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.playlists) {
          const parsed = data.playlists as Playlist[];
          localStorage.setItem('signage_playlists', JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent('playlists-synced', { detail: { source: 'drive', playlists: parsed } }));
        }
      }
    } catch {
      // Silently ignore
    }
  })().catch(() => {});
}

// First-run: build playlists from scratch when no local data exists
async function buildInitialPlaylists(): Promise<Playlist[]> {
  const supabase = getSupabaseClient();

  // Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const parsed = data.map(row => ({
          id: row.id,
          name: row.name,
          active: !!row.active,
          is_online: !!row.is_online,
          schedule_enabled: !!row.schedule_enabled,
          schedule_start_date: row.schedule_start_date || undefined,
          schedule_end_date: row.schedule_end_date || undefined,
          schedule_start_time: row.schedule_start_time || undefined,
          schedule_end_time: row.schedule_end_time || undefined,
          items: Array.isArray(row.items) ? row.items : [],
          created_at: row.created_at,
          transition_style: row.transition_style || 'fade-scale',
        })) as Playlist[];

        for (const playlist of parsed) {
          for (const item of playlist.items) {
            const blob = await getLocalFile(item.id);
            if (blob) { item.url = makeBlobUrl(item.id, blob); item.localBlob = blob; }
          }
        }
        localStorage.setItem('signage_playlists', JSON.stringify(parsed));
        return parsed;
      }
    } catch { /* ignore */ }
  }

  // Try Drive
  const isDriveConfigured = await checkGoogleDriveConfigured();
  if (isDriveConfigured) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/drive/playlist', { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.playlists) {
          const parsed = data.playlists as Playlist[];
          localStorage.setItem('signage_playlists', JSON.stringify(parsed));
          if (supabase) savePlaylists(parsed);
          return parsed;
        }
      }
    } catch { /* ignore */ }
  }

  // Create default playlist
  const existingMedia = await fetchMedia();
  const defaultPlaylist: Playlist = {
    id: 'default-playlist',
    name: 'Default Playlist',
    active: true,
    is_online: true,
    schedule_enabled: false,
    items: existingMedia,
    created_at: new Date().toISOString(),
  };

  const initialList = [defaultPlaylist];
  localStorage.setItem('signage_playlists', JSON.stringify(initialList));
  if (supabase) savePlaylists(initialList);
  if (isDriveConfigured) savePlaylists(initialList);

  return initialList;
}


export function savePlaylists(playlists: Playlist[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('signage_playlists', JSON.stringify(playlists));
  
  // 1. Sync to Supabase SQL Database in the background
  const supabase = getSupabaseClient();
  if (supabase) {
    const upsertData = playlists.map(p => ({
      id: p.id,
      name: p.name,
      active: p.active,
      is_online: p.is_online,
      schedule_enabled: p.schedule_enabled,
      schedule_start_date: p.schedule_start_date || null,
      schedule_end_date: p.schedule_end_date || null,
      schedule_start_time: p.schedule_start_time || null,
      schedule_end_time: p.schedule_end_time || null,
      items: p.items,
      transition_style: p.transition_style || 'fade-scale',
      created_at: p.created_at
    }));

    // Use an async IIFE to make background sync robust
    (async () => {
      try {
        window.dispatchEvent(new CustomEvent('supabase-syncing'));
        const { data: existing, error: selectError } = await supabase.from('playlists').select('id');
        if (selectError) throw selectError;

        const existingIds = existing ? existing.map((e: { id: string }) => e.id) : [];
        const currentIds = playlists.map(p => p.id);
        const toDelete = existingIds.filter(id => !currentIds.includes(id));
        
        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase.from('playlists').delete().in('id', toDelete);
          if (deleteError) throw deleteError;
        }
        
        const { error: upsertError } = await supabase.from('playlists').upsert(upsertData);
        if (upsertError) throw upsertError;

        window.dispatchEvent(new CustomEvent('supabase-synced', { detail: { success: true } }));
      } catch (err) {
        console.error('Error syncing playlists to Supabase:', err);
        window.dispatchEvent(new CustomEvent('supabase-synced', { detail: { success: false, error: (err as Error).message } }));
      }
    })();
  }

  // 2. Asynchronous background sync to Google Drive if configured
  checkGoogleDriveConfigured().then(configured => {
    if (configured) {
      window.dispatchEvent(new CustomEvent('playlists-syncing'));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      fetch('/api/drive/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists }),
        signal: controller.signal
      }).then(async res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          const errText = await res.text().catch(() => 'Failed to sync to Google Drive');
          window.dispatchEvent(new CustomEvent('playlists-synced', { 
            detail: { success: false, error: errText } 
          }));
          return;
        }
        const data = await res.json();
        window.dispatchEvent(new CustomEvent('playlists-synced', { detail: { success: true, message: data.message } }));
      }).catch(err => {
        clearTimeout(timeoutId);
        console.error('Error syncing playlists to Google Drive:', err);
        window.dispatchEvent(new CustomEvent('playlists-synced', { detail: { success: false, error: err.message } }));
      });
    }
  });
}

export function resolveActivePlaylist(playlists: Playlist[]): Playlist | null {
  if (!playlists || playlists.length === 0) return null;

  const now = new Date();
  
  // Format local date: YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const currentDateStr = `${year}-${month}-${day}`;

  // Format local time: HH:MM
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  // Reset online flags
  playlists.forEach(p => {
    p.is_online = false;
  });

  // 1. Try to find a scheduled playlist that is active and currently matches the schedule
  let onlinePlaylist: Playlist | null = null;

  for (const playlist of playlists) {
    if (!playlist.active) continue;

    if (playlist.schedule_enabled) {
      let dateMatch = true;
      let timeMatch = true;

      if (playlist.schedule_start_date && playlist.schedule_end_date) {
        dateMatch = currentDateStr >= playlist.schedule_start_date && 
                    currentDateStr <= playlist.schedule_end_date;
      }

      if (playlist.schedule_start_time && playlist.schedule_end_time) {
        timeMatch = currentTimeStr >= playlist.schedule_start_time && 
                    currentTimeStr <= playlist.schedule_end_time;
      }

      if (dateMatch && timeMatch) {
        playlist.is_online = true;
        if (!onlinePlaylist) {
          onlinePlaylist = playlist;
        }
      }
    }
  }

  // 2. If no playlist is online via scheduling, fallback to the first active manual playlist
  if (!onlinePlaylist) {
    const manualActive = playlists.find(p => p.active && !p.schedule_enabled);
    if (manualActive) {
      manualActive.is_online = true;
      onlinePlaylist = manualActive;
    }
  }

  // 3. Fallback to default playlist if nothing else resolved
  if (!onlinePlaylist) {
    const defaultPlay = playlists.find(p => p.id === 'default-playlist') || playlists[0];
    if (defaultPlay) {
      defaultPlay.is_online = true;
      onlinePlaylist = defaultPlay;
    }
  }

  // Write changes back to localStorage cache to sync indicators without triggering background Google Drive sync
  if (typeof window !== 'undefined') {
    localStorage.setItem('signage_playlists', JSON.stringify(playlists));
  }

  return onlinePlaylist;
}
