'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  Play, 
  Image as ImageIcon, 
  Film, 
  QrCode, 
  X, 
  Monitor, 
  Clock,
  VolumeX,
  Volume2
} from 'lucide-react';

const Youtube = (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size || 24}
    height={props.size || 24}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
  >
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <polygon points="10 15 15 12 10 9" />
  </svg>
);

import { QRCodeSVG } from 'qrcode.react';
import { MediaItem, SignageSettings } from '@/lib/db';
import { getYouTubeId } from './YouTubeControl';

interface SignagePreviewProps {
  mediaList: MediaItem[];
  settings: SignageSettings;
  isFullscreen: boolean;
  onCloseFullscreen: () => void;
}

export default function SignagePreview({
  mediaList,
  settings,
  isFullscreen,
  onCloseFullscreen,
}: SignagePreviewProps) {
  const activeMedia = mediaList.filter(m => m.active);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const youtubeId = getYouTubeId(settings.youtube_url);

  // Helper functions for custom image editing features
  const getMediaStyle = (item: MediaItem): React.CSSProperties => {
    const filters = [];
    if (item.brightness !== undefined) filters.push(`brightness(${item.brightness}%)`);
    if (item.contrast !== undefined) filters.push(`contrast(${item.contrast}%)`);
    if (item.grayscale !== undefined) filters.push(`grayscale(${item.grayscale}%)`);
    if (item.blur !== undefined) filters.push(`blur(${item.blur}px)`);

    const transform = item.rotation ? `rotate(${item.rotation}deg)` : '';

    return {
      filter: filters.join(' ') || undefined,
      transform: transform || undefined,
      transition: 'filter 0.3s ease, transform 0.3s ease',
    };
  };

  const getScaleModeClass = (item: MediaItem) => {
    switch (item.scale_mode) {
      case 'contain':
        return 'object-contain';
      case 'stretch':
        return 'object-fill';
      case 'cover':
      default:
        return 'object-cover';
    }
  };

  const getOverlayPositionClass = (item: MediaItem) => {
    switch (item.overlay_text_position) {
      case 'top':
        return 'top-8 left-1/2 -translate-x-1/2';
      case 'middle':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'bottom':
      default:
        return 'bottom-12 left-1/2 -translate-x-1/2';
    }
  };

  const getOverlayTextColorClass = (color?: string) => {
    switch (color) {
      case 'yellow':
        return 'text-yellow-400 border-yellow-500/30 bg-black/85';
      case 'green':
        return 'text-emerald-400 border-emerald-500/30 bg-black/85';
      case 'red':
        return 'text-red-400 border-red-500/30 bg-black/85';
      case 'cyan':
        return 'text-cyan-400 border-cyan-500/30 bg-black/85';
      case 'white':
      default:
        return 'text-white border-zinc-800 bg-black/80';
    }
  };

  // ----------------------------------------------------
  // CAROUSEL LOOP LOGIC FOR IMAGES & VIDEOS
  // ----------------------------------------------------
  useEffect(() => {
    // Reset index if media list changes or YouTube gets enabled
    setCurrentIndex(0);
  }, [activeMedia.length, settings.youtube_enabled]);

  // Handle slideshow intervals
  useEffect(() => {
    // If YouTube is active, we don't advance the local media loop
    if (settings.youtube_enabled || activeMedia.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const currentItem = activeMedia[currentIndex];
    if (!currentItem) {
      setCurrentIndex(0);
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // If current item is an image, set a timeout to transition to next
    if (currentItem.type === 'image') {
      const duration = currentItem.slide_duration || settings.slide_duration;
      const durationMs = duration * 1000;
      timerRef.current = setTimeout(() => {
        handleNext();
      }, durationMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, activeMedia.length, settings.slide_duration, settings.youtube_enabled]);

  const handleNext = () => {
    if (activeMedia.length <= 1) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeMedia.length);
      setTransitioning(false);
    }, 450); // Match transition animation speed
  };

  const handleVideoEnded = () => {
    handleNext();
  };

  const currentItem = activeMedia[currentIndex];

  // ----------------------------------------------------
  // RENDER DYNAMIC SIGNAGE VIEW CONTENT
  // ----------------------------------------------------
  const renderSignageContent = () => {
    // 1. YouTube playback mode
    if (settings.youtube_enabled && youtubeId) {
      // Setup queries: autoplay, loop, mute, hide controls, custom playlist for loop support
      const muteParam = settings.mute ? '1' : '0';
      const embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=${muteParam}&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1`;

      return (
        <div className="w-full h-full bg-black relative">
          <iframe
            src={embedUrl}
            title="Digital Signage YouTube Player"
            className="w-full h-full border-0 pointer-events-none scale-102"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {/* Overlay to block any hover/touch interactions inside simulated display */}
          <div className="absolute inset-0 bg-transparent" />
        </div>
      );
    }

    // 2. Playlist media mode
    if (activeMedia.length > 0 && currentItem) {
      return (
        <div className={`w-full h-full relative bg-black flex items-center justify-center transition-opacity duration-500 ${
          transitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}>
          {currentItem.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentItem.url}
              autoPlay
              muted={settings.mute}
              onEnded={handleVideoEnded}
              className={`w-full h-full ${getScaleModeClass(currentItem)}`}
              style={getMediaStyle(currentItem)}
              playsInline
            />
          ) : (
            <img
              src={currentItem.url}
              alt={currentItem.name}
              className={`w-full h-full ${getScaleModeClass(currentItem)}`}
              style={getMediaStyle(currentItem)}
            />
          )}

          {/* Premium customized visual text overlay */}
          {currentItem.overlay_text && currentItem.overlay_text.trim() !== '' && (
            <div className={`absolute ${getOverlayPositionClass(currentItem)} z-10 px-5 py-2.5 rounded-2xl border text-center font-bold tracking-wide shadow-2xl backdrop-blur-md animate-pulse text-xs md:text-sm max-w-[85%] select-none ${getOverlayTextColorClass(currentItem.overlay_text_color)}`}>
              {currentItem.overlay_text}
            </div>
          )}

          {/* Media Info overlay bar (shows subtle active title on signage) */}
          <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-lg border border-zinc-800 text-[10px] text-zinc-300 font-medium flex items-center gap-1.5 pointer-events-none shadow-md">
            {currentItem.type === 'video' ? <Film size={11} className="text-yellow-500" /> : <ImageIcon size={11} className="text-zinc-400" />}
            {currentItem.name}
          </div>
        </div>
      );
    }

    // 3. Standby default state
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none">
        {/* Dynamic yellow gradient pulse backdrop */}
        <div className="absolute w-[200px] h-[200px] bg-yellow-500/5 blur-2xl rounded-full status-pulse" />
        
        <div className="relative z-10 space-y-3">
          <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-yellow-500 inline-block status-pulse shadow-lg shadow-yellow-500/5">
            <Tv size={32} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Signage Standby</h3>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[240px] mx-auto">
              No active media for display. Upload images/videos or enable YouTube stream on the left panel.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // FLOATING QR OVERLAY ANCHOR STYLE
  // ----------------------------------------------------
  const getQrPositionClasses = () => {
    switch (settings.qr_position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
      default:
        return 'bottom-4 right-4';
    }
  };

  // Render simulated view inside screen frame
  const playerScreen = (
    <div className="relative w-full h-full aspect-video bg-black rounded-lg overflow-hidden flex shadow-2xl">
      {/* Dynamic Player Content */}
      {renderSignageContent()}

      {/* Realtime QR Overlay */}
      {settings.qr_enabled && settings.qr_text.trim() !== '' && (
        <div 
          className={`absolute ${getQrPositionClasses()} p-2 bg-white rounded-xl shadow-2xl transition-all duration-300 border border-zinc-150 flex items-center justify-center`}
          style={{ 
            width: `${settings.qr_size}px`, 
            height: `${settings.qr_size}px`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
          }}
        >
          <div className="relative w-full h-full">
            <QRCodeSVG
              value={settings.qr_text}
              size={settings.qr_size - 16} // Subtract padding
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Screen Status Mini Badge */}
      <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded border border-zinc-800 text-[9px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
        LIVE TV PREVIEW
      </div>
    </div>
  );

  // Return full TV frame or simulated absolute fullscreen overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden">
        <div className="w-full max-w-[95vw] max-h-[95vh] aspect-video relative">
          {playerScreen}
        </div>

        {/* Exit fullscreen button */}
        <button
          onClick={onCloseFullscreen}
          className="absolute top-4 right-4 p-2 bg-zinc-900/80 border border-zinc-800 text-white rounded-full hover:bg-yellow-500 hover:text-black hover:scale-115 hover:rotate-90 transition-all duration-300 cursor-pointer shadow-2xl z-51"
          title="Exit Fullscreen"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  // standard dashboard right-side preview inside TV bezel
  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Premium ambient TV back glow */}
      <div className="relative w-full max-w-2xl bg-zinc-950/20 border border-zinc-900 rounded-3xl p-4 md:p-6 shadow-2xl">
        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/5 via-transparent to-yellow-500/5 blur-xl pointer-events-none rounded-3xl" />
        
        {/* Physical TV bezel frame */}
        <div className="relative border-8 border-zinc-900 bg-zinc-950 rounded-2xl p-1.5 shadow-2xl">
          {/* Inner bezel highlight */}
          <div className="absolute inset-0 border border-zinc-800/80 rounded-[10px] pointer-events-none" />
          
          {/* Screen Content Wrapper */}
          {playerScreen}
        </div>

        {/* TV stand simulator neck */}
        <div className="w-12 h-6 bg-zinc-900 border-x border-zinc-800 mx-auto relative -mt-[1px] shadow-md" />
        
        {/* TV stand base plate */}
        <div className="w-36 h-2 bg-zinc-900 border-t border-zinc-800 rounded-full mx-auto shadow-md" />
      </div>

      {/* Signage Status Display Specs */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <div className="px-3 py-1 bg-zinc-950/40 border border-zinc-900 rounded-full text-[10px] text-zinc-400 flex items-center gap-1.5">
          <Monitor size={11} className="text-zinc-500" />
          Aspect: <span className="text-yellow-500 font-mono">1920x1080 (16:9)</span>
        </div>
        <div className="px-3 py-1 bg-zinc-950/40 border border-zinc-900 rounded-full text-[10px] text-zinc-400 flex items-center gap-1.5">
          <Clock size={11} className="text-zinc-500" />
          Cycle: <span className="text-yellow-500 font-mono">{activeMedia.length} items</span>
        </div>
        <div className="px-3 py-1 bg-zinc-950/40 border border-zinc-900 rounded-full text-[10px] text-zinc-400 flex items-center gap-1.5">
          {settings.mute ? (
            <>
              <VolumeX size={11} className="text-red-500" />
              Audio: <span className="text-red-400 font-mono">Muted (OFF)</span>
            </>
          ) : (
            <>
              <Volume2 size={11} className="text-emerald-500" />
              Audio: <span className="text-emerald-400 font-mono">Active (ON)</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
