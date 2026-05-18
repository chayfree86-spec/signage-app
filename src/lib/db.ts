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
async function saveLocalMeta(meta: Omit<MediaItem, 'url'>): Promise<void> {
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
async function getLocalMetaList(): Promise<Omit<MediaItem, 'url'>[]> {
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
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          youtube_url: data.youtube_url ?? DEFAULT_SETTINGS.youtube_url,
          youtube_enabled: !!data.youtube_enabled,
          qr_text: data.qr_text ?? DEFAULT_SETTINGS.qr_text,
          qr_enabled: !!data.qr_enabled,
          qr_position: data.qr_position ?? DEFAULT_SETTINGS.qr_position,
          qr_size: Number(data.qr_size ?? DEFAULT_SETTINGS.qr_size),
          slide_duration: Number(data.slide_duration ?? DEFAULT_SETTINGS.slide_duration),
          mute: !!data.mute,
        };
      } else {
        // Table exists but no settings row exists yet - insert default
        const { error: insertError } = await supabase
          .from('settings')
          .insert([DEFAULT_SETTINGS]);
        if (insertError) console.warn('Could not insert default settings in Supabase', insertError);
        return DEFAULT_SETTINGS;
      }
    } catch (e) {
      console.warn('Supabase settings fetch failed, checking local storage:', e);
    }
  }

  // Local Fallback
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('signage_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
  }
  return DEFAULT_SETTINGS;
}

export async function updateSettings(settings: Partial<SignageSettings>): Promise<SignageSettings> {
  const current = await fetchSettings();
  const updated = { ...current, ...settings };

  // Write to Supabase if active
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Get settings count first
      const { data } = await supabase.from('settings').select('id').limit(1);
      if (data && data.length > 0) {
        // Update existing row (assuming single-row layout)
        const { error } = await supabase
          .from('settings')
          .update(updated)
          .eq('id', data[0].id);
        if (error) throw error;
      } else {
        // Insert new settings row
        const { error } = await supabase
          .from('settings')
          .insert([updated]);
        if (error) throw error;
      }
    } catch (e) {
      console.warn('Supabase settings update failed, falling back to local:', e);
    }
  }

  // Local fallback
  if (typeof window !== 'undefined') {
    localStorage.setItem('signage_settings', JSON.stringify(updated));
  }
  return updated;
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
      const blob = await getLocalFile(meta.id);
      if (blob) {
        const url = makeBlobUrl(meta.id, blob);
        listWithUrls.push({
          ...meta,
          url,
          localBlob: blob,
        });
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

export async function uploadMediaItem(file: File): Promise<MediaItem> {
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

  const saved = localStorage.getItem('signage_playlists');
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Playlist[];
      
      // Dynamic regeneration of Blob URLs for all local files in playlists
      // to resolve broken thumbnails on browser page reloads
      for (const playlist of parsed) {
        for (const item of playlist.items) {
          const blob = await getLocalFile(item.id);
          if (blob) {
            item.url = makeBlobUrl(item.id, blob);
            item.localBlob = blob;
          }
        }
      }
      
      return parsed;
    } catch {
      // JSON parse error, rebuild default below
    }
  }

  // Seeding: Fetch existing flat media list to build initial Default Playlist
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
  return initialList;
}

export function savePlaylists(playlists: Playlist[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('signage_playlists', JSON.stringify(playlists));
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

  // Write changes back to persistent storage to sync indicators
  savePlaylists(playlists);

  return onlinePlaylist;
}
