'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  RotateCw, 
  Cloud, 
  CheckCircle2, 
  Upload, 
  Settings2, 
  Info,
  Layers,
  Radio,
  FileImage,
  QrCode,
  Monitor
} from 'lucide-react';
import { 
  fetchSettings, 
  updateSettings, 
  fetchMedia, 
  MediaItem, 
  SignageSettings,
  Playlist,
  fetchPlaylists,
  savePlaylists,
  resolveActivePlaylist
} from '@/lib/db';
import PlaylistManager from '@/components/PlaylistManager';
import YouTubeControl from '@/components/YouTubeControl';
import QRCodeControl from '@/components/QRCodeControl';
import GeneralSettings from '@/components/GeneralSettings';
import SignagePreview from '@/components/SignagePreview';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allUploadedMedia, setAllUploadedMedia] = useState<MediaItem[]>([]);
  const [settings, setSettings] = useState<SignageSettings | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncSeconds, setSyncSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<'media' | 'youtube' | 'qr' | 'system' | 'preview'>('preview');
  const [activeTransitionStyle, setActiveTransitionStyle] = useState<string>('fade-scale');

  // References for periodic counters
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ----------------------------------------------------
  // INITIALIZE DATA & POPULATE MOCK DATA ON FIRST LAUNCH
  // ----------------------------------------------------
  const loadSignageData = async () => {
    try {
      setLoading(true);
      const fetchedSettings = await fetchSettings();
      setSettings(fetchedSettings);

      let fetchedMedia = await fetchMedia();
      
      // Auto-prepopulate 2 premium mock media records on very first load if none exist
      // This is a master stroke for an amazing instant out-of-the-box user experience
      if (fetchedMedia.length === 0) {
        const mock1Url = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
        const mock2Url = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80';
        
        try {
          const defaultItems: MediaItem[] = [
            {
              id: 'mock-fluid-dark',
              type: 'image',
              url: mock1Url,
              name: 'Premium Dark Fluid Scenery.jpg',
              size: 245100,
              position: 0,
              active: true,
              created_at: new Date().toISOString()
            },
            {
              id: 'mock-yosemite',
              type: 'image',
              url: mock2Url,
              name: 'Scenic Yosemite Valley.jpg',
              size: 512400,
              position: 1,
              active: true,
              created_at: new Date().toISOString()
            }
          ];

          if (typeof window !== 'undefined') {
            const db = await indexedDB.open('SignageLocalDB', 1);
            db.onsuccess = () => {
              const database = db.result;
              const tx = database.transaction(['media_meta', 'media_files'], 'readwrite');
              tx.objectStore('media_meta').put(defaultItems[0]);
              tx.objectStore('media_meta').put(defaultItems[1]);
            };
          }
          fetchedMedia = defaultItems;
        } catch (mockError) {
          console.warn('Failed to pre-populate mock media list', mockError);
        }
      }

      setAllUploadedMedia(fetchedMedia);

      // Load Playlists
      const fetchedPlaylists = await fetchPlaylists();
      setPlaylists(fetchedPlaylists);

      // Resolve running active media for TV Preview Screen
      const activePlay = resolveActivePlaylist(fetchedPlaylists);
      if (activePlay) {
        setMediaList(activePlay.items);
        setActiveTransitionStyle(activePlay.transition_style || 'fade-scale');
      } else {
        setMediaList([]);
        setActiveTransitionStyle('fade-scale');
      }

      resetSyncTimer();
    } catch (e) {
      console.error('Failed to load signage panel data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignageData();

    // Start sync timer ticking
    syncTimerRef.current = setInterval(() => {
      setSyncSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, []);

  // ----------------------------------------------------
  // RUN REALTIME DATETIME PLAYLIST SCHEDULER TICKER LOOP
  // ----------------------------------------------------
  useEffect(() => {
    if (playlists.length === 0) return;

    const interval = setInterval(() => {
      const activePlay = resolveActivePlaylist(playlists);
      if (activePlay) {
        // Simple comparison of items count/order to prevent infinite react re-renders
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

  // ----------------------------------------------------
  // MUTATION WRAPPERS (RESET SYNC TIMER INSTANTLY)
  // ----------------------------------------------------
  function resetSyncTimer() {
    setSyncSeconds(0);
  }

  const handleReloadUploadedMedia = async () => {
    const list = await fetchMedia();
    setAllUploadedMedia(list);
  };

  const handlePlaylistsChange = (updatedPlaylists: Playlist[]) => {
    setPlaylists(updatedPlaylists);
    savePlaylists(updatedPlaylists);
    
    const activePlay = resolveActivePlaylist(updatedPlaylists);
    if (activePlay) {
      setMediaList(activePlay.items);
      setActiveTransitionStyle(activePlay.transition_style || 'fade-scale');
    } else {
      setMediaList([]);
      setActiveTransitionStyle('fade-scale');
    }
    resetSyncTimer();
  };

  const handleSettingsUpdate = async (partialSettings: Partial<SignageSettings>) => {
    if (!settings) return;
    const updated = await updateSettings(partialSettings);
    setSettings(updated);
    resetSyncTimer();
  };

  const triggerFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col font-sans">
      {/* Decorative ambient background glows */}
      <div className="glow-spot top-[-100px] left-[-100px]" />
      <div className="glow-spot bottom-[-150px] right-[-150px]" />

      {/* ----------------------------------------------------
          TOP HEADER SECTION
          ---------------------------------------------------- */}
      <header className="relative z-10 border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        {/* Title logo accent */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-500/10">
            <Tv size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              Digital Signage Controller
              <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                PRO v1.0
              </span>
            </h1>
            <p className="text-[10px] text-zinc-500">Single-Screen Display Admin Control Panel</p>
          </div>
        </div>

        {/* Screen online & Sync status panel */}
        <div className="flex items-center gap-3">
          {/* Sync Time Status Counter */}
          <div className="px-3.5 py-1.5 rounded-full bg-zinc-950/80 border border-zinc-900 text-xs text-zinc-400 flex items-center gap-1.5 shadow-inner">
            <RotateCw size={12} className={`text-zinc-600 ${syncSeconds < 2 ? 'animate-spin text-yellow-500' : ''}`} />
            Last Sync: <span className="text-yellow-500 font-bold font-mono">{syncSeconds}s ago</span>
          </div>

          {/* Screen Status Badge (Glowing emerald pulse) */}
          <div className="px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 flex items-center gap-2 shadow-inner shadow-emerald-500/5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 status-pulse"></span>
            </span>
            SCREEN ONLINE
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------
          MAIN TWO-COLUMN CONTROLLER FRAMEWORK
          ---------------------------------------------------- */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3 z-10 py-24 select-none">
          <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Loading admin panel, please wait...</p>
        </div>
      ) : (
        <main className="flex-1 w-full px-4 md:px-8 py-6 grid grid-cols-1 gap-6 z-10">
          
          {/* LEFT-SIDE ADMIN DASHBOARD CONTROLS (takes full width) */}
          <section className="w-full flex flex-col md:flex-row gap-5 items-start">
            
            {/* Beautiful Navigation Sidebar Menu (takes width on larger screens, full width flex-wrap on mobile) */}
            <div className="w-full md:w-52 shrink-0 flex flex-row md:flex-col gap-2 md:gap-2.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none z-10">
              
              {/* Tab Button 1: Live TV Preview */}
              <button 
                onClick={() => setActiveTab('preview')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none text-left ${
                  activeTab === 'preview' 
                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.05)]' 
                    : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/30 hover:text-white hover:border-zinc-800'
                }`}
              >
                <Monitor size={16} className={activeTab === 'preview' ? 'text-yellow-500' : 'text-zinc-500'} />
                <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">Live Simulator</span>
              </button>

              {/* Tab Button 2: Media Upload & Playlist */}
              <button 
                onClick={() => setActiveTab('media')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none text-left ${
                  activeTab === 'media' 
                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.05)]' 
                    : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/30 hover:text-white hover:border-zinc-800'
                }`}
              >
                <FileImage size={16} className={activeTab === 'media' ? 'text-yellow-500' : 'text-zinc-500'} />
                <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">Playlist Manager</span>
              </button>

              {/* Tab Button 3: YouTube Live */}
              <button 
                onClick={() => setActiveTab('youtube')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none text-left ${
                  activeTab === 'youtube' 
                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.05)]' 
                    : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/30 hover:text-white hover:border-zinc-800'
                }`}
              >
                <Radio size={16} className={activeTab === 'youtube' ? 'text-yellow-500 animate-pulse' : 'text-zinc-500'} />
                <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">YouTube Live</span>
              </button>

              {/* Tab Button 4: QR Customizer */}
              <button 
                onClick={() => setActiveTab('qr')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none text-left ${
                  activeTab === 'qr' 
                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.05)]' 
                    : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/30 hover:text-white hover:border-zinc-800'
                }`}
              >
                <QrCode size={16} className={activeTab === 'qr' ? 'text-yellow-500' : 'text-zinc-500'} />
                <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">QR Customizer</span>
              </button>

              {/* Tab Button 5: System Configurations */}
              <button 
                onClick={() => setActiveTab('system')}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none text-left ${
                  activeTab === 'system' 
                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.05)]' 
                    : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:bg-zinc-900/30 hover:text-white hover:border-zinc-800'
                }`}
              >
                <Settings2 size={16} className={activeTab === 'system' ? 'text-yellow-500' : 'text-zinc-500'} />
                <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">System Config</span>
              </button>
            </div>

            {/* Active Content Area (takes remaining width, expands dynamically with beautiful animations) */}
            <div className="flex-1 w-full z-10">
              
              {/* 1. LIVE TV PREVIEW CARD */}
              <div className={`glass-panel shadow-xl rounded-3xl p-5 transition-all duration-300 animate-fadeIn w-full flex flex-col items-center ${activeTab === 'preview' ? '' : 'hidden'}`}>
                <div className="w-full flex items-center justify-between border-b border-zinc-900 pb-3 mb-5">
                  <div className="flex items-center gap-2">
                    <Monitor size={18} className="text-yellow-500" />
                    <h2 className="text-sm md:text-base font-bold text-white uppercase tracking-wider">
                      Real-time TV Output Simulator
                    </h2>
                  </div>
                  <span className="text-[10px] text-zinc-500 bg-zinc-950/80 px-2.5 py-1 rounded-full border border-zinc-900 font-mono tracking-wider">
                    16:9 SCREEN RATIO
                  </span>
                </div>
                
                {settings && (
                  <div className="w-full max-w-5xl">
                    <SignagePreview
                      mediaList={mediaList}
                      settings={activeTab === 'preview' ? settings : { ...settings, mute: true }}
                      isFullscreen={isFullscreen}
                      onCloseFullscreen={closeFullscreen}
                      transitionStyle={activeTransitionStyle}
                      onUpdateSettings={handleSettingsUpdate}
                    />
                  </div>
                )}

                {/* Informative TV Helper Text */}
                <div className="w-full max-w-5xl mt-6 flex gap-3 p-4 rounded-2xl bg-zinc-950/30 border border-zinc-900">
                  <Info size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    This simulator behaves exactly as your physical digital signage TV screen would. Changes to playlist ordering, slide durations, and YouTube toggle update on this screen instantly. Use the configurations menu tabs on the left to customize content in real-time.
                  </p>
                </div>
              </div>

              {/* 2. MEDIA UPLOAD & PLAYLIST MANAGER CARD */}
              {activeTab === 'media' && (
                <div className="glass-panel shadow-xl rounded-3xl p-5 transition-all duration-300 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3 mb-4">
                    <FileImage size={18} className="text-yellow-500" />
                    <h2 className="text-sm md:text-base font-bold text-white uppercase tracking-wider">
                      Playlist Manager & Scheduler
                    </h2>
                  </div>
                  <PlaylistManager
                    playlists={playlists}
                    onPlaylistsChange={handlePlaylistsChange}
                    allUploadedMedia={allUploadedMedia}
                    onReloadUploadedMedia={handleReloadUploadedMedia}
                  />
                </div>
              )}

              {/* 3. YOUTUBE CONTROLLER CARD */}
              {activeTab === 'youtube' && (
                <div className="glass-panel shadow-xl rounded-3xl p-5 transition-all duration-300 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3 mb-4">
                    <Radio size={18} className="text-yellow-500 animate-pulse" />
                    <h2 className="text-sm md:text-base font-bold text-white uppercase tracking-wider">
                      YouTube Live Stream Controller
                    </h2>
                  </div>
                  {settings && (
                    <YouTubeControl
                      url={settings.youtube_url}
                      playlistsData={settings.youtube_playlists}
                      enabled={settings.youtube_enabled}
                      mute={settings.mute}
                      loop={settings.youtube_loop !== false}
                      onUpdate={handleSettingsUpdate}
                      slideDuration={settings.slide_duration}
                      activeId={settings.youtube_active_id}
                    />
                  )}
                </div>
              )}

              {/* 4. QR CODE OVERLAY CUSTOMIZER CARD */}
              {activeTab === 'qr' && (
                <div className="glass-panel shadow-xl rounded-3xl p-5 transition-all duration-300 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3 mb-4">
                    <QrCode size={18} className="text-yellow-500" />
                    <h2 className="text-sm md:text-base font-bold text-white uppercase tracking-wider">
                      QR Code Overlay Customizer
                    </h2>
                  </div>
                  {settings && (
                    <QRCodeControl
                      text={settings.qr_text}
                      enabled={settings.qr_enabled}
                      position={settings.qr_position}
                      size={settings.qr_size}
                      onUpdate={handleSettingsUpdate}
                    />
                  )}
                </div>
              )}

              {/* 5. GENERAL OPTIONS & ADVANCED STORAGE CARD */}
              {activeTab === 'system' && (
                <div className="glass-panel shadow-xl rounded-3xl p-5 transition-all duration-300 animate-fadeIn">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3 mb-4">
                    <Settings2 size={18} className="text-yellow-500" />
                    <h2 className="text-sm md:text-base font-bold text-white uppercase tracking-wider">
                      System Configurations
                    </h2>
                  </div>
                  {settings && (
                    <GeneralSettings
                      slideDuration={settings.slide_duration}
                      mute={settings.mute}
                      onUpdate={handleSettingsUpdate}
                      onTriggerFullscreen={triggerFullscreen}
                      onReloadData={loadSignageData}
                    />
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* ----------------------------------------------------
          FOOTER LEGAL DISCLAIMER
          ---------------------------------------------------- */}
      <footer className="relative z-10 border-t border-zinc-900 bg-zinc-950/40 text-center py-4 mt-auto text-zinc-600 text-[10.5px] tracking-wide flex flex-col md:flex-row items-center justify-center gap-2">
        <span>© 2026 Digital Signage Controller Inc. All rights reserved.</span>
        <span className="hidden md:inline text-zinc-800">•</span>
        <span className="text-yellow-500/60 font-semibold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded bg-zinc-900/50 border border-zinc-850">
          Single-Screen Authorized Version
        </span>
      </footer>

      {/* Dynamic simulated fullscreen background layer */}
      {isFullscreen && settings && (
        <SignagePreview
          mediaList={mediaList}
          settings={settings}
          isFullscreen={isFullscreen}
          onCloseFullscreen={closeFullscreen}
          transitionStyle={activeTransitionStyle}
        />
      )}
    </div>
  );
}
