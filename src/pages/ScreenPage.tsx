import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  fetchSettings, 
  syncScreenPlaylistsFromSupabase,
  resolveActivePlaylist,
  updateSettings,
  MediaItem,
  SignageSettings,
  Playlist
} from '@/lib/db';
import SignagePreview from '@/components/SignagePreview';
import { getSupabaseClient } from '@/lib/supabase';

const FALLBACK_SETTINGS: SignageSettings = {
  youtube_url: '',
  youtube_enabled: false,
  qr_text: '',
  qr_enabled: false,
  qr_position: 'bottom-right',
  qr_size: 120,
  slide_duration: 8,
  mute: true,
  youtube_active_id: '',
  youtube_playlists: '',
  youtube_loop: true,
};

export default function ScreenPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<SignageSettings>(FALLBACK_SETTINGS);
  const [activeTransitionStyle, setActiveTransitionStyle] = useState<string>('fade-scale');
  const isLoadingRef = useRef(false);

  const loadSignageData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const fetchedSettings = await fetchSettings();
      setSettings(fetchedSettings);

      const fetchedPlaylists = await loadScreenPlaylistsWithTimeout();
      setPlaylists(fetchedPlaylists);

      const activePlay = resolveActivePlaylist(fetchedPlaylists);
      if (activePlay) {
        setMediaList(activePlay.items);
        setActiveTransitionStyle(activePlay.transition_style || 'fade-scale');
      } else {
        setMediaList([]);
        setActiveTransitionStyle('fade-scale');
      }
    } catch (e) {
      console.error('Failed to load signage panel data:', e);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  const loadScreenPlaylistsWithTimeout = useCallback(async (): Promise<Playlist[]> => {
    const timeoutResult = new Promise<Playlist[]>((resolve) => {
      setTimeout(() => resolve(readCachedPlaylists()), 4000);
    });

    return Promise.race([
      syncScreenPlaylistsFromSupabase(),
      timeoutResult,
    ]);
  }, []);

  const readCachedPlaylists = useCallback((): Playlist[] => {
    try {
      const saved = localStorage.getItem('signage_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as Playlist[];
      }
    } catch {
      // Ignore invalid local cache and use default standby playlist.
    }

    return [{
      id: 'default-playlist',
      name: 'Default Playlist',
      active: true,
      is_online: true,
      schedule_enabled: false,
      items: [],
      created_at: new Date().toISOString(),
      transition_style: 'fade-scale',
    }];
  }, []);

  useEffect(() => {
    const initialLoadTimeout = setTimeout(() => {
      loadSignageData();
    }, 0);

    // Poll the database/local storage every 3 seconds to get updates in real-time
    const pollInterval = setInterval(() => {
      loadSignageData();
    }, 3000);

    // Sync across tabs using localStorage storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'signage_settings' || e.key === 'signage_playlists') {
        loadSignageData();
      }
    };

    const handleBackgroundSync = () => {
      loadSignageData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settings-synced-from-drive', handleBackgroundSync);
    window.addEventListener('playlists-synced', handleBackgroundSync);
    window.addEventListener('signage-content-updated', handleBackgroundSync);

    let contentChannel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      contentChannel = new window.BroadcastChannel('signage_content_updates');
      contentChannel.addEventListener('message', handleBackgroundSync);
    }

    const supabase = getSupabaseClient();
    const realtimeChannel = supabase
      ? supabase
          .channel('tv-screen-live-updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, handleBackgroundSync)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, handleBackgroundSync)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, handleBackgroundSync)
          .subscribe()
      : null;

    const handleResume = () => {
      loadSignageData();
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      clearTimeout(initialLoadTimeout);
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settings-synced-from-drive', handleBackgroundSync);
      window.removeEventListener('playlists-synced', handleBackgroundSync);
      window.removeEventListener('signage-content-updated', handleBackgroundSync);
      if (contentChannel) {
        contentChannel.removeEventListener('message', handleBackgroundSync);
        contentChannel.close();
      }
      if (supabase && realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [loadSignageData]);

  // Run Realtime Datetime Playlist Scheduler Ticker Loop (every second)
  useEffect(() => {
    if (playlists.length === 0) return;

    const interval = setInterval(() => {
      const activePlay = resolveActivePlaylist(playlists);
      if (activePlay) {
        const sameItems = mediaList.length === activePlay.items.length && 
                          mediaList.every((item, i) => item.id === activePlay.items[i]?.id && item.active === activePlay.items[i]?.active && item.slide_duration === activePlay.items[i]?.slide_duration);
        if (!sameItems) {
          setMediaList(activePlay.items);
        }

        // Dynamic synchronization of transition style
        const currentTransition = activePlay.transition_style || 'fade-scale';
        if (activeTransitionStyle !== currentTransition) {
          setActiveTransitionStyle(currentTransition);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [playlists, mediaList, activeTransitionStyle]);

  return (
    <SignagePreview
      mediaList={mediaList}
      settings={settings}
      isFullscreen={false}
      onCloseFullscreen={() => {}}
      pureScreenMode={true}
      playbackRole="screen"
      transitionStyle={activeTransitionStyle}
      onUpdateSettings={async (newSettings) => {
        await updateSettings(newSettings);
        setSettings(prev => ({ ...prev, ...newSettings }));
      }}
    />
  );
}
