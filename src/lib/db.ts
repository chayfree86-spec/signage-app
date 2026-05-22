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

const SETTINGS_STORAGE_KEY = 'signage_settings';
const SETTINGS_LAST_LOCAL_WRITE_KEY = 'signage_settings_last_local_write';
const SETTINGS_CLOUD_OVERWRITE_GRACE_MS = 10000;
const CONTENT_UPDATE_CHANNEL = 'signage_content_updates';

function broadcastContentUpdate(type: 'settings' | 'playlists', payload: unknown): void {
  if (typeof window === 'undefined') return;

  const message = { type, payload, timestamp: Date.now() };
  window.dispatchEvent(new CustomEvent('signage-content-updated', { detail: message }));

  if ('BroadcastChannel' in window) {
    const channel = new window.BroadcastChannel(CONTENT_UPDATE_CHANNEL);
    channel.postMessage(message);
    channel.close();
  }
}

function readLocalSettingsSnapshot(): SignageSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!saved) return DEFAULT_SETTINGS;

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeLocalSettingsSnapshot(settings: SignageSettings): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  localStorage.setItem(SETTINGS_LAST_LOCAL_WRITE_KEY, String(Date.now()));
}

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
    request.onupgradeneeded = () => {
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
  
  const localSettings = readLocalSettingsSnapshot();
  
  // Fire-and-forget background sync from cloud sources (does NOT block return)
  syncSettingsFromSourcesInBackground();
  
  return localSettings;
}

// Background sync: prefer Supabase, then fall back to Drive.
function syncSettingsFromSourcesInBackground(): void {
  if (typeof window === 'undefined') return;

  (async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('settings').select('*').limit(1);
        if (!error && data && data.length > 0) {
          publishCloudSettings(data[0]);
          return;
        }
      } catch {
        // Supabase failed, try Drive.
      }
    }

    const isDriveConfigured = await checkGoogleDriveConfigured();
    if (!isDriveConfigured) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/drive/settings', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          publishCloudSettings(data.settings);
        }
      }
    } catch {
      // Silently ignore Drive sync failures — local data is already returned
    }
  })().catch(() => {});
}

function publishCloudSettings(settings: Partial<SignageSettings>): void {
  const lastLocalWrite = Number(localStorage.getItem(SETTINGS_LAST_LOCAL_WRITE_KEY) || 0);
  if (lastLocalWrite && Date.now() - lastLocalWrite < SETTINGS_CLOUD_OVERWRITE_GRACE_MS) {
    return;
  }

  const cloudSettings = { ...DEFAULT_SETTINGS, ...settings };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cloudSettings));
  window.dispatchEvent(new CustomEvent('settings-synced-from-drive', { detail: cloudSettings }));
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
  const current = readLocalSettingsSnapshot();
  const updated = { ...current, ...settings };

  let serverSynced = false;

  try {
    serverSynced = await syncSettingsToSupabase(updated) || serverSynced;
  } catch (error) {
    console.error('Settings Supabase sync failed:', error);
  }

  try {
    serverSynced = await syncSettingsToDrive(updated) || serverSynced;
  } catch (error) {
    console.error('Settings Drive sync failed:', error);
  }

  if (!serverSynced) {
    console.warn('Settings server sync failed, keeping local fallback copy.');
  }

  if (typeof window !== 'undefined') {
    writeLocalSettingsSnapshot(updated);
    broadcastContentUpdate('settings', updated);
    window.dispatchEvent(new CustomEvent('settings-synced-from-drive', { detail: updated }));
  }

  return updated;
}

async function syncSettingsToSupabase(settings: SignageSettings): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    window.dispatchEvent(new CustomEvent('supabase-syncing'));
    const dbPayload = sanitizeSettingsForDb(settings);

    // Get settings count first
    const { data, error: selectError } = await supabase.from('settings').select('id').limit(1);
    if (selectError) throw selectError;

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
    return true;
  } catch (e) {
    console.error('Supabase settings update failed in db.ts:', e);
    window.dispatchEvent(new CustomEvent('supabase-synced', { detail: { success: false, error: (e as Error).message } }));
    throw e;
  }
}

async function syncSettingsToDrive(settings: SignageSettings): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const configured = await checkGoogleDriveConfigured();
  if (!configured) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/drive/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Failed to sync settings to Drive');
      throw new Error(errText);
    }

    return true;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const id = crypto.randomUUID();
  const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
  const name = file.name;
  const size = file.size;
  const created_at = new Date().toISOString();

  // Find next position index
  const list = await fetchMedia();
  const position = list.length > 0 ? Math.max(...list.map(m => m.position)) + 1 : 0;

  // Uploads are local-first so the controller stays responsive offline.
  // Playlist sync moves local Blob media to Supabase after the UI update.
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

export async function saveUploadedMediaToSupabase(file: File): Promise<MediaItem> {
  const id = crypto.randomUUID();
  const type: MediaItem['type'] = file.type.startsWith('video/') ? 'video' : 'image';
  const list = await fetchMedia();
  const position = list.length > 0 ? Math.max(...list.map(m => m.position)) + 1 : 0;
  const createdAt = new Date().toISOString();
  const publicUrl = await uploadSupabaseMediaFile(id, type, file, file.name);

  const mediaItem: MediaItem = {
    id,
    type,
    url: publicUrl,
    name: file.name,
    size: file.size,
    position,
    active: true,
    created_at: createdAt,
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.from('media').insert([mediaItem]);
  if (error) throw error;

  return mediaItem;
}

async function uploadSupabaseMediaFile(
  id: string,
  type: MediaItem['type'],
  file: Blob,
  filename: string
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const bucketName = type === 'video' ? 'videos' : 'images';
  const fileExt = filename.split('.').pop() || '';
  const filePath = fileExt ? `${id}.${fileExt}` : id;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  if (!data.publicUrl) {
    throw new Error(`Supabase did not return a public URL for ${bucketName}/${filePath}.`);
  }

  return data.publicUrl;
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
      // Regenerate Blob URLs BEFORE returning so images load immediately
      await regenerateBlobUrls(parsed);
      // Deep clone to avoid mutating cached data
      const result = parsed.map(p => ({
        ...p,
        items: p.items.map(item => ({ ...item })),
      }));
      // Trigger background sync from authoritative sources
      syncPlaylistsFromSourcesInBackground();
      return result;
    } catch {
      // Fall through to build default
    }
  }

  // FIRST RUN: return a usable local playlist immediately.
  // Remote sources are refreshed in the background so the TV screen never stays
  // stuck on the loading state while Drive or Supabase responds slowly.
  const defaultPlaylist: Playlist = {
    id: 'default-playlist',
    name: 'Default Playlist',
    active: true,
    is_online: true,
    schedule_enabled: false,
    items: [],
    created_at: new Date().toISOString(),
    transition_style: 'fade-scale',
  };

  const initialList = [defaultPlaylist];
  localStorage.setItem('signage_playlists', JSON.stringify(initialList));
  syncPlaylistsFromSourcesInBackground();
  return initialList;
}

export async function syncScreenPlaylistsFromSupabase(): Promise<Playlist[]> {
  if (typeof window === 'undefined') return [];

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const [{ data: playlistRows, error: playlistError }, { data: mediaRows, error: mediaError }] = await Promise.all([
        supabase.from('playlists').select('*').order('created_at', { ascending: true }),
        supabase.from('media').select('*').order('position', { ascending: true }),
      ]);

      if (playlistError) throw playlistError;
      if (mediaError) throw mediaError;

      if (playlistRows && playlistRows.length > 0) {
        const mediaById = new Map<string, MediaItem>();
        for (const row of mediaRows || []) {
          const id = String(row.id || '');
          if (id) {
            mediaById.set(id, mapSupabaseMediaRow(row));
          }
        }

        const cloudPlaylists = mapSupabasePlaylists(playlistRows, mediaById);
        localStorage.setItem('signage_playlists', JSON.stringify(cloudPlaylists));
        return cachePlaylistsForLocalPlayback(cloudPlaylists);
      }
    } catch (error) {
      console.warn('Supabase TV playlist sync failed, using local cache:', error);
    }
  }

  const localPlaylists = await fetchPlaylists();
  return cachePlaylistsForLocalPlayback(localPlaylists);
}

function mapSupabaseMediaRow(row: Record<string, unknown>): MediaItem {
  const id = String(row.id || '');
  return {
    id,
    type: row.type === 'video' ? 'video' : 'image',
    url: String(row.url || ''),
    name: String(row.name || `media-${id.slice(0, 6)}`),
    size: Number(row.size || 0),
    position: Number(row.position || 0),
    active: !!row.active,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function mapSupabasePlaylists(
  rows: Record<string, unknown>[],
  mediaById: Map<string, MediaItem>
): Playlist[] {
  return rows.map(row => {
    const items = Array.isArray(row.items)
      ? row.items.map(item => {
          const playlistItem = item as MediaItem;
          const cloudMedia = mediaById.get(playlistItem.id);
          return cloudMedia ? { ...playlistItem, ...cloudMedia } : playlistItem;
        })
      : [];

    return {
      id: String(row.id || ''),
      name: String(row.name || 'Playlist'),
      active: !!row.active,
      is_online: !!row.is_online,
      schedule_enabled: !!row.schedule_enabled,
      schedule_start_date: row.schedule_start_date ? String(row.schedule_start_date) : undefined,
      schedule_end_date: row.schedule_end_date ? String(row.schedule_end_date) : undefined,
      schedule_start_time: row.schedule_start_time ? String(row.schedule_start_time) : undefined,
      schedule_end_time: row.schedule_end_time ? String(row.schedule_end_time) : undefined,
      items,
      created_at: String(row.created_at || new Date().toISOString()),
      transition_style: (row.transition_style as Playlist['transition_style']) || 'fade-scale',
    };
  });
}

async function cachePlaylistsForLocalPlayback(playlists: Playlist[]): Promise<Playlist[]> {
  const priorityItemId = findPriorityPlaybackItemId(playlists);
  let priorityCached = false;

  const localPlaylists = await Promise.all(playlists.map(async playlist => ({
    ...playlist,
    items: await Promise.all(playlist.items.map(async item => {
      if (!priorityCached && item.id === priorityItemId) {
        priorityCached = true;
        return cacheMediaForLocalPlayback(item);
      }

      return getCachedMediaForLocalPlayback(item);
    })),
  })));

  void cacheRemainingMediaForLocalPlayback(playlists, priorityItemId);
  return localPlaylists;
}

function findPriorityPlaybackItemId(playlists: Playlist[]): string | undefined {
  const activePlaylist = resolveActivePlaylist(playlists);
  return activePlaylist?.items.find(item => item.active)?.id;
}

async function getCachedMediaForLocalPlayback(item: MediaItem): Promise<MediaItem> {
  const cachedBlob = await getLocalFile(item.id);
  if (!cachedBlob) {
    return item;
  }

  return {
    ...item,
    url: makeBlobUrl(item.id, cachedBlob),
    localBlob: cachedBlob,
  };
}

async function cacheRemainingMediaForLocalPlayback(
  playlists: Playlist[],
  priorityItemId?: string
): Promise<void> {
  const remainingItems = playlists.flatMap(playlist =>
    playlist.items.filter(item => item.id !== priorityItemId)
  );

  await Promise.all(remainingItems.map(cacheMediaForLocalPlayback));
}

async function cacheMediaForLocalPlayback(item: MediaItem): Promise<MediaItem> {
  const cachedItem = await getCachedMediaForLocalPlayback(item);
  if (cachedItem.localBlob) {
    return cachedItem;
  }

  if (!isDownloadableMediaUrl(item.url)) {
    return item;
  }

  try {
    const blob = await downloadMediaBlob(item.url);
    await saveLocalFile(item.id, blob, item.name);
    await saveLocalMeta(item);
    return {
      ...item,
      url: makeBlobUrl(item.id, blob),
      localBlob: blob,
    };
  } catch (error) {
    console.warn(`TV media cache failed for ${item.id}, using remote URL:`, error);
    return item;
  }
}

function isDownloadableMediaUrl(url: string): boolean {
  return url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('/');
}

async function downloadMediaBlob(url: string): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Media download failed with status ${response.status}.`);
    }

    return response.blob();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Regenerate blob URLs for local media items (sync version, awaited)
async function regenerateBlobUrls(playlists: Playlist[]): Promise<void> {
  for (const playlist of playlists) {
    for (const item of playlist.items) {
      // Blob URLs from localStorage or cloud sync can point at an old document.
      // Only reuse URLs created by this page; otherwise restore from IndexedDB.
      if (item.url && item.url.startsWith('blob:')) {
        const activeUrl = activeBlobUrls.get(item.id);
        if (activeUrl === item.url) {
          continue;
        }
      }
      // Skip remote URLs (Google Drive, external)
      if (item.url && (item.url.startsWith('/api/drive/') || item.url.startsWith('http'))) {
        continue;
      }
      const blob = await getLocalFile(item.id);
      if (blob) {
        item.url = makeBlobUrl(item.id, blob);
        item.localBlob = blob;
      }
    }
  }
}

// Background sync from Supabase then Drive (fire-and-forget)
function syncPlaylistsFromSourcesInBackground(): void {
  if (typeof window === 'undefined') return;

  (async () => {
    // Try Supabase first
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const [{ data: playlistRows, error: playlistError }, { data: mediaRows, error: mediaError }] = await Promise.all([
          supabase.from('playlists').select('*').order('created_at', { ascending: true }),
          supabase.from('media').select('*').order('position', { ascending: true }),
        ]);

        if (playlistError) throw playlistError;
        if (mediaError) throw mediaError;

        if (playlistRows && playlistRows.length > 0) {
          const mediaById = new Map<string, MediaItem>();
          for (const row of mediaRows || []) {
            const id = String(row.id || '');
            if (id) {
              mediaById.set(id, mapSupabaseMediaRow(row));
            }
          }

          const parsed = mapSupabasePlaylists(playlistRows, mediaById);

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

export async function savePlaylists(playlists: Playlist[]): Promise<Playlist[]> {
  if (typeof window === 'undefined') return playlists;

  let cloudPlaylists = playlists;
  let serverSynced = false;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      window.dispatchEvent(new CustomEvent('supabase-syncing'));
      cloudPlaylists = await syncLocalPlaylistMediaToSupabase(playlists);
      await syncPlaylistsToSupabase(cloudPlaylists);
      serverSynced = true;
      window.dispatchEvent(new CustomEvent('supabase-synced', { detail: { success: true } }));
    } catch (err) {
      console.error('Error syncing playlists to Supabase:', err);
      window.dispatchEvent(new CustomEvent('supabase-synced', {
        detail: { success: false, error: (err as Error).message },
      }));
    }
  }

  try {
    serverSynced = await syncPlaylistsToDrive(cloudPlaylists) || serverSynced;
  } catch (err) {
    console.error('Error syncing playlists to Google Drive:', err);
  }

  if (!serverSynced) {
    console.warn('Playlist server sync failed, keeping local fallback copy.');
  }

  localStorage.setItem('signage_playlists', JSON.stringify(cloudPlaylists));
  broadcastContentUpdate('playlists', cloudPlaylists);
  window.dispatchEvent(new CustomEvent('playlists-synced', {
    detail: { success: true, source: serverSynced ? 'server' : 'local-fallback', playlists: cloudPlaylists },
  }));

  return cloudPlaylists;
}

async function syncLocalPlaylistMediaToSupabase(playlists: Playlist[]): Promise<Playlist[]> {
  const syncedMedia: MediaItem[] = [];
  let changed = false;

  const migrated = await Promise.all(playlists.map(async playlist => ({
    ...playlist,
    items: await Promise.all(playlist.items.map(async item => {
      if (!needsSupabaseMediaUpload(item)) {
        return item;
      }

      const blob = item.localBlob instanceof Blob ? item.localBlob : await getLocalFile(item.id);
      if (!blob) {
        return item;
      }

      const url = await uploadSupabaseMediaFile(item.id, item.type, blob, item.name);
      const cloudItem = { ...item };
      delete cloudItem.localBlob;
      const syncedItem = { ...cloudItem, url };
      syncedMedia.push(syncedItem);
      changed = true;
      return syncedItem;
    })),
  })));

  if (syncedMedia.length > 0) {
    await upsertSupabaseMedia(syncedMedia);
  }

  return changed ? migrated : playlists;
}

function needsSupabaseMediaUpload(item: MediaItem): boolean {
  if (item.localBlob instanceof Blob || item.url.startsWith('blob:')) {
    return true;
  }

  return !item.url.startsWith('/') && !item.url.startsWith('http');
}

async function upsertSupabaseMedia(items: MediaItem[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const rows = items.map(item => ({
    id: item.id,
    type: item.type,
    url: item.url,
    name: item.name,
    size: item.size,
    position: item.position,
    active: item.active,
    created_at: item.created_at,
  }));
  const { error } = await supabase.from('media').upsert(rows);
  if (error) throw error;
}

async function syncPlaylistsToSupabase(playlists: Playlist[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

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
    created_at: p.created_at,
  }));

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
}

async function syncPlaylistsToDrive(playlists: Playlist[]): Promise<boolean> {
  const configured = await checkGoogleDriveConfigured();
  if (!configured) return false;

  window.dispatchEvent(new CustomEvent('playlists-syncing'));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('/api/drive/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Failed to sync to Google Drive');
      window.dispatchEvent(new CustomEvent('playlists-synced', {
        detail: { success: false, error },
      }));
      return false;
    }

    const data = await res.json();
    window.dispatchEvent(new CustomEvent('playlists-synced', {
      detail: { success: true, message: data.message },
    }));
    return true;
  } catch (err) {
    console.error('Error syncing playlists to Google Drive:', err);
    window.dispatchEvent(new CustomEvent('playlists-synced', {
      detail: { success: false, error: (err as Error).message },
    }));
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function resolveActivePlaylist(playlists: Playlist[]): Playlist | null {
  if (!playlists || playlists.length === 0) return null;

  // Deep clone to avoid mutating the original array (which causes React state corruption)
  const cloned: Playlist[] = playlists.map(p => ({
    ...p,
    items: p.items.map(item => ({ ...item })),
  }));

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

  // Reset online flags on cloned array only
  cloned.forEach(p => {
    p.is_online = false;
  });

  // 1. Try to find a scheduled playlist that is active and currently matches the schedule
  let onlinePlaylist: Playlist | null = null;

  for (const playlist of cloned) {
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
    const manualActive = cloned.find(p => p.active && !p.schedule_enabled);
    if (manualActive) {
      manualActive.is_online = true;
      onlinePlaylist = manualActive;
    }
  }

  // 3. Fallback to default playlist if nothing else resolved
  if (!onlinePlaylist) {
    const defaultPlay = cloned.find(p => p.id === 'default-playlist') || cloned[0];
    if (defaultPlay) {
      defaultPlay.is_online = true;
      onlinePlaylist = defaultPlay;
    }
  }

  // Only write back if is_online flags actually changed, and throttle writes
  if (typeof window !== 'undefined') {
    const lastWrite = localStorage.getItem('signage_playlists_last_resolve');
    const now2 = Date.now();
    // Throttle: only write to localStorage max once per 5 seconds from resolveActivePlaylist
    if (!lastWrite || now2 - parseInt(lastWrite, 10) > 5000) {
      localStorage.setItem('signage_playlists', JSON.stringify(cloned));
      localStorage.setItem('signage_playlists_last_resolve', String(now2));
    }
  }

  return onlinePlaylist;
}
