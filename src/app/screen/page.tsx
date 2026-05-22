'use client';

import React, { useState, useEffect } from 'react';
import { 
  fetchSettings, 
  fetchPlaylists, 
  resolveActivePlaylist,
  updateSettings,
  MediaItem,
  SignageSettings,
  Playlist
} from '@/lib/db';
import SignagePreview from '@/components/SignagePreview';

export default function ScreenPage() {
  const [loading, setLoading] = useState(true);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<SignageSettings | null>(null);
  const [activeTransitionStyle, setActiveTransitionStyle] = useState<string>('fade-scale');

  const loadSignageData = async () => {
    try {
      const fetchedSettings = await fetchSettings();
      setSettings(fetchedSettings);

      const fetchedPlaylists = await fetchPlaylists();
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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignageData();

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

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settings-synced-from-drive', handleBackgroundSync);
      window.removeEventListener('playlists-synced', handleBackgroundSync);
    };
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3 select-none">
        <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400 font-medium">Loading Signage Screen...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6 text-zinc-400">
        <p>No configuration found. Make sure you set up the controller panel first.</p>
      </div>
    );
  }

  return (
    <SignagePreview
      mediaList={mediaList}
      settings={settings}
      isFullscreen={false}
      onCloseFullscreen={() => {}}
      pureScreenMode={true}
      transitionStyle={activeTransitionStyle}
      onUpdateSettings={async (newSettings) => {
        await updateSettings(newSettings);
        setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      }}
    />
  );
}
