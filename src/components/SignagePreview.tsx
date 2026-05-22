'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, 
  X, 
  Monitor, 
  Clock,
  VolumeX,
  Volume2,
  Star,
  CreditCard,
  Link
} from 'lucide-react';

const YoutubeIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const InstagramIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

import { QRCodeSVG } from 'qrcode.react';
import { MediaItem, SignageSettings } from '@/lib/db';
import { getYouTubeId, parseYouTubeUrls } from './YouTubeControl';
import { parseMultipleQrTexts, getQrItemValue } from './QRCodeControl';

interface SignagePreviewProps {
  mediaList: MediaItem[];
  settings: SignageSettings;
  isFullscreen: boolean;
  onCloseFullscreen: () => void;
  pureScreenMode?: boolean;
  transitionStyle?: string;
  onUpdateSettings?: (settings: Partial<SignageSettings>) => Promise<void>;
}

export default function SignagePreview({
  mediaList,
  settings,
  isFullscreen,
  onCloseFullscreen,
  pureScreenMode = false,
  transitionStyle = 'fade-scale',
  onUpdateSettings,
}: SignagePreviewProps) {
  const activeMedia = mediaList.filter(m => m.active);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [timeTicker, setTimeTicker] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [slideStartTime, setSlideStartTime] = useState(Date.now());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const [currentYoutubeIndex, setCurrentYoutubeIndex] = useState(0);
  const [youtubeProgress, setYoutubeProgress] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<any>(null);
  const lastLocalUpdateRef = useRef<number>(0);
  const displayIndex = activeMedia.length > 0
    ? Math.min(currentIndex, activeMedia.length - 1)
    : 0;
  const currentMedia = activeMedia[displayIndex];
  const currentSlideDuration = currentMedia?.slide_duration || settings.slide_duration;

  const activeYoutubeItems = parseYouTubeUrls(settings.youtube_url).filter(
    item => item.enabled && getYouTubeId(item.url)
  );

  const currentYoutubeIndexRef = useRef(currentYoutubeIndex);
  const activeYoutubeItemsRef = useRef(activeYoutubeItems);

  useEffect(() => {
    currentYoutubeIndexRef.current = currentYoutubeIndex;
  }, [currentYoutubeIndex]);

  useEffect(() => {
    activeYoutubeItemsRef.current = activeYoutubeItems;
  }, [activeYoutubeItems]);

  // Sync settings active youtube ID on settings updates
  useEffect(() => {
    // Skip external sync if we recently updated the setting locally to avoid race condition with polling
    if (Date.now() - lastLocalUpdateRef.current < 6000) {
      return;
    }

    const youtubeItems = parseYouTubeUrls(settings.youtube_url);
    const activeItems = youtubeItems.filter(
      item => item.enabled && getYouTubeId(item.url)
    );
    if (settings.youtube_active_id) {
      const idx = activeItems.findIndex(item => item.id === settings.youtube_active_id);
      if (idx !== -1) {
        setCurrentYoutubeIndex(idx);
        return;
      }
    }
    // If index out of bounds, default to 0
    if (currentYoutubeIndex >= activeItems.length) {
      setCurrentYoutubeIndex(0);
    }
  }, [settings.youtube_active_id, settings.youtube_url]);

  // Listen for manual play actions via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new window.BroadcastChannel('signage_play_status');
    broadcastChannelRef.current = channel;

    const handleMessage = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object' && e.data.type === 'play_youtube_item') {
        const itemId = e.data.itemId;
        const youtubeItems = parseYouTubeUrls(settings.youtube_url);
        const activeItems = youtubeItems.filter(
          item => item.enabled && getYouTubeId(item.url)
        );
        const idx = activeItems.findIndex(item => item.id === itemId);
        if (idx !== -1) {
          lastLocalUpdateRef.current = Date.now();
          setCurrentYoutubeIndex(idx);
        }
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [settings.youtube_url]);

  // Handle YouTube Video End
  const handleYoutubeVideoEnded = () => {
    const items = activeYoutubeItemsRef.current;
    const currentIndex = currentYoutubeIndexRef.current;
    const isLoopEnabled = settings.youtube_loop !== false;
    if (items.length === 0) return;
    if (items.length === 1) {
      // Replay the same video only if loop is enabled
      if (isLoopEnabled) {
        const player = playerRef.current;
        if (player && typeof player.seekTo === 'function' && typeof player.playVideo === 'function') {
          try {
            player.seekTo(0, true);
            player.playVideo();
          } catch (e) {
            console.error('Error replaying single video:', e);
          }
        }
      }
      return;
    }
    // If we're on the last video and loop is disabled, stop
    if (!isLoopEnabled && currentIndex >= items.length - 1) {
      return;
    }
    const nextIndex = (currentIndex + 1) % items.length;
    setCurrentYoutubeIndex(nextIndex);
    const nextItem = items[nextIndex];
    if (nextItem && onUpdateSettings) {
      lastLocalUpdateRef.current = Date.now();
      onUpdateSettings({ youtube_active_id: nextItem.id });
    }
  };

  // Initialize YouTube IFrame Player API
  useEffect(() => {
    if (!settings.youtube_enabled || !iframeRef.current) return;
    let player: any = null;
    let isDestroyed = false;

    const currentItem = activeYoutubeItems[currentYoutubeIndex];
    if (!currentItem) return;
    const videoId = getYouTubeId(currentItem.url);
    if (!videoId) return;

    const initPlayer = () => {
      if (isDestroyed || typeof window === 'undefined' || !(window as any).YT || !(window as any).YT.Player) return;
      try {
        player = new (window as any).YT.Player(iframeRef.current, {
          events: {
            onStateChange: (event: any) => {
              if (event.data === 0) { // 0 = YT.PlayerState.ENDED
                handleYoutubeVideoEnded();
              }
            }
          }
        });
        playerRef.current = player;
      } catch (e) {
        console.error('Error binding YouTube player:', e);
      }
    };

    if (typeof window !== 'undefined') {
      if (!(window as any).YT || !(window as any).YT.Player) {
        // Load YouTube IFrame Player API dynamically if not already loaded
        if (!document.getElementById('youtube-iframe-api')) {
          const tag = document.createElement('script');
          tag.id = 'youtube-iframe-api';
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }

        // Hook into global callback
        const prevCallback = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          if (prevCallback) prevCallback();
          initPlayer();
        };
      } else {
        // If script is already loaded, initialize the player
        setTimeout(initPlayer, 200);
      }
    }

    return () => {
      isDestroyed = true;
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy();
        } catch (e) {
          // ignore destroy errors
        }
      }
      playerRef.current = null;
    };
  }, [currentYoutubeIndex, settings.youtube_enabled, settings.youtube_url]);

  // Poll player progress
  useEffect(() => {
    if (!settings.youtube_enabled) {
      setYoutubeProgress(0);
      return;
    }

    const progressInterval = setInterval(() => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
        try {
          const current = player.getCurrentTime();
          const duration = player.getDuration();
          if (duration > 0) {
            setYoutubeProgress((current / duration) * 100);
          }
        } catch (e) {
          // ignore API errors before player is ready
        }
      }
    }, 250);

    return () => clearInterval(progressInterval);
  }, [settings.youtube_enabled, currentYoutubeIndex]);

  useEffect(() => {
    setSlideStartTime(Date.now());
  }, [currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTicker(Date.now());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!broadcastChannelRef.current) return;

    if (settings.youtube_enabled) {
      if (activeYoutubeItems.length > 0) {
        const currentItem = activeYoutubeItems[currentYoutubeIndex];
        if (currentItem) {
          broadcastChannelRef.current.postMessage({
            itemId: currentItem.id,
            progress: youtubeProgress,
            type: 'youtube'
          });
        }
      }
    } else if (activeMedia.length > 0) {
      const currentItem = activeMedia[displayIndex];
      if (currentItem) {
        let progressPercent = 0;
        if (currentItem.type === 'video' && videoRef.current) {
          progressPercent = videoRef.current.duration
            ? (videoRef.current.currentTime / videoRef.current.duration) * 100
            : 0;
        } else {
          const elapsed = timeTicker - slideStartTime;
          const duration = currentItem.slide_duration || settings.slide_duration;
          const durationMs = duration * 1000;
          progressPercent = Math.min((elapsed / durationMs) * 100, 100);
        }
        broadcastChannelRef.current.postMessage({
          itemId: currentItem.id,
          progress: progressPercent,
          type: 'playlist'
        });
      }
    }
  }, [timeTicker, displayIndex, slideStartTime, activeMedia, settings, currentYoutubeIndex, youtubeProgress, activeYoutubeItems]);

  // Get all active and valid QR codes for display in the footer banner
  const qrItems = parseMultipleQrTexts(settings.qr_text, settings.qr_enabled);
  let activeQrItems = settings.qr_enabled
    ? qrItems.filter(item => item.enabled && getQrItemValue(item).trim() !== '')
    : [];

  if (settings.qr_enabled && activeQrItems.length === 0) {
    const customItem = qrItems.find(item => item.id === 'custom') || qrItems[0];
    if (customItem) {
      activeQrItems = [{
        ...customItem,
        enabled: true,
        customText: customItem.customText.trim() || settings.qr_text || 'https://github.com'
      }];
    }
  }

  const getItemTransitionStyle = (index: number): React.CSSProperties => {
    const isCurrent = index === displayIndex;
    const isPrev = index === prevIndex;
    
    // Default hidden state
    const style: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      opacity: 0,
      pointerEvents: 'none',
      zIndex: 0,
    };
    
    if (isCurrent) {
      style.opacity = 1;
      style.pointerEvents = 'auto';
      style.zIndex = 10;
      
      if (transitioning) {
        switch (transitionStyle) {
          case 'slide-left':
            style.transition = 'transform 500ms ease-in-out';
            style.transform = 'translateX(0)';
            break;
          case 'slide-right':
            style.transition = 'transform 500ms ease-in-out';
            style.transform = 'translateX(0)';
            break;
          case 'slide-up':
            style.transition = 'transform 500ms ease-in-out';
            style.transform = 'translateY(0)';
            break;
          case 'zoom':
            style.transition = 'transform 500ms ease-in-out';
            style.transform = 'scale(1)';
            break;
          case 'rotate':
            style.transition = 'transform 500ms ease-in-out';
            style.transform = 'scale(1) rotate(0deg)';
            break;
          case 'fade':
          case 'fade-scale':
          default:
            // For fade, let the incoming slide stay static in the background at opacity 1
            break;
        }
      } else {
        style.transform = 'none';
      }
    } else if (isPrev) {
      style.pointerEvents = 'none';
      style.zIndex = 20;
      
      switch (transitionStyle) {
        case 'fade':
          style.transition = 'opacity 500ms ease-in-out';
          style.opacity = 0;
          break;
        case 'slide-left':
          style.transition = 'transform 500ms ease-in-out';
          style.opacity = 1; // Keep fully opaque as it slides out
          style.transform = 'translateX(-100%)';
          break;
        case 'slide-right':
          style.transition = 'transform 500ms ease-in-out';
          style.opacity = 1; // Keep fully opaque as it slides out
          style.transform = 'translateX(100%)';
          break;
        case 'slide-up':
          style.transition = 'transform 500ms ease-in-out';
          style.opacity = 1; // Keep fully opaque as it slides out
          style.transform = 'translateY(-100%)';
          break;
        case 'zoom':
          style.transition = 'opacity 500ms ease-in-out, transform 500ms ease-in-out';
          style.opacity = 0;
          style.transform = 'scale(0.9)';
          break;
        case 'rotate':
          style.transition = 'opacity 500ms ease-in-out, transform 500ms ease-in-out';
          style.opacity = 0;
          style.transform = 'scale(0.75) rotate(12deg)';
          break;
        case 'fade-scale':
        default:
          style.transition = 'opacity 500ms ease-in-out, transform 500ms ease-in-out';
          style.opacity = 0;
          style.transform = 'scale(0.95)';
          break;
      }
    } else {
      // Inactive states (off-screen setup for slide entries)
      switch (transitionStyle) {
        case 'slide-left':
          style.transform = 'translateX(100%)';
          break;
        case 'slide-right':
          style.transform = 'translateX(-100%)';
          break;
        case 'slide-up':
          style.transform = 'translateY(100%)';
          break;
        case 'zoom':
          style.transform = 'scale(0.9)';
          break;
        case 'rotate':
          style.transform = 'scale(0.75) rotate(-12deg)';
          break;
        default:
          style.transform = 'none';
          break;
      }
    }
    
    return style;
  };

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
    const hasFooter = activeQrItems.length > 0;
    switch (item.overlay_text_position) {
      case 'top':
        return 'top-8 left-1/2 -translate-x-1/2';
      case 'middle':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'bottom':
      default:
        return hasFooter 
          ? 'bottom-[130px] left-1/2 -translate-x-1/2' 
          : 'bottom-12 left-1/2 -translate-x-1/2';
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

  // Render premium glassmorphic footer with all active QR codes side by side
  const renderQrFooter = () => {
    if (activeQrItems.length === 0) return null;

    const getQrStyle = (itemId: string) => {
      switch (itemId) {
        case 'instagram':
          return {
            badgeClass: 'bg-pink-500/15 border-pink-500/30 text-pink-400',
            icon: <InstagramIcon size={11} className="text-pink-400" />,
            borderClass: 'border-pink-500/20 hover:border-pink-500/40',
            fgColor: '#E1306C'
          };
        case 'facebook':
          return {
            badgeClass: 'bg-blue-600/15 border-blue-500/30 text-blue-400',
            icon: <FacebookIcon size={11} className="text-blue-400" />,
            borderClass: 'border-blue-500/20 hover:border-blue-500/40',
            fgColor: '#1877F2'
          };
        case 'youtube':
          return {
            badgeClass: 'bg-red-500/15 border-red-500/30 text-red-400',
            icon: <YoutubeIcon size={11} className="text-red-400" />,
            borderClass: 'border-red-500/20 hover:border-red-500/40',
            fgColor: '#CD201F'
          };
        case 'payment':
          return {
            badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
            icon: <CreditCard size={11} className="text-emerald-400" />,
            borderClass: 'border-emerald-500/20 hover:border-emerald-500/40',
            fgColor: '#059669'
          };
        case 'review':
          return {
            badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
            icon: <Star size={11} className="text-amber-400" />,
            borderClass: 'border-amber-500/20 hover:border-amber-500/40',
            fgColor: '#D97706'
          };
        case 'custom':
        default:
          return {
            badgeClass: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
            icon: <Link size={11} className="text-yellow-400" />,
            borderClass: 'border-yellow-500/20 hover:border-yellow-500/40',
            fgColor: '#B45309'
          };
      }
    };

    return (
      <div className="absolute bottom-0 inset-x-0 h-[110px] bg-zinc-950/85 backdrop-blur-xl border-t border-zinc-900 z-40 flex items-center justify-center gap-8 px-6 animate-in slide-in-from-bottom duration-300 select-none">
        {activeQrItems.map((item) => {
          const value = getQrItemValue(item);
          const style = getQrStyle(item.id);
          return (
            <div key={item.id} className={`flex items-center gap-3 bg-zinc-900/60 border rounded-xl px-4 py-2 hover:bg-zinc-900/80 transition-all duration-300 ${style.borderClass}`}>
              <div className="bg-white p-1 rounded flex items-center justify-center shadow-lg shrink-0" style={{ border: `1.5px solid ${style.fgColor}` }}>
                <QRCodeSVG
                  value={value}
                  size={52}
                  bgColor="#FFFFFF"
                  fgColor={style.fgColor}
                  level="M"
                />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-extrabold uppercase tracking-wider w-fit mb-1 truncate flex items-center gap-1.5 ${style.badgeClass}`}>
                  {style.icon}
                  {item.label}
                </span>
                <span className="text-[11px] font-semibold text-white truncate max-w-[140px] pl-0.5">
                  {item.type === 'payment' && (item.paymentName || item.paymentUpi)}
                  {item.type === 'review' && 'Rate Us on Google'}
                  {item.type === 'social' && `@${item.socialUsername}`}
                  {item.type === 'custom' && (item.customText.replace(/^https?:\/\/(www\.)?/, ''))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ----------------------------------------------------
  // CAROUSEL LOOP LOGIC FOR IMAGES & VIDEOS
  // ----------------------------------------------------
  function handleNext() {
    if (activeMedia.length <= 1) return;
    
    setPrevIndex(displayIndex);
    setTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % activeMedia.length);
    
    setTimeout(() => {
      setTransitioning(false);
      setPrevIndex(null);
    }, 500); // Match transition duration (500ms)
  }

  const handleVideoEnded = () => {
    handleNext();
  };

  // Handle slideshow intervals
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // YouTube playback mode slideshow loop is now handled reactively using timeTicker
    if (settings.youtube_enabled) {
      return;
    }

    // Playlist media mode
    if (activeMedia.length === 0) return;

    const currentItem = currentMedia;
    if (!currentItem) return;

    // If current item is an image, set a timeout to transition to next
    if (currentItem.type === 'image') {
      const durationMs = currentSlideDuration * 1000;
      timerRef.current = setTimeout(() => {
        handleNext();
      }, durationMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayIndex,
    activeMedia.length,
    currentMedia?.type,
    currentSlideDuration,
    settings.youtube_enabled,
  ]);

  // ----------------------------------------------------
  // RENDER DYNAMIC SIGNAGE VIEW CONTENT
  // ----------------------------------------------------
  const renderSignageContent = () => {
    // 1. YouTube playback mode
    if (settings.youtube_enabled) {
      const youtubeItems = parseYouTubeUrls(settings.youtube_url);
      
      if (activeYoutubeItems.length > 0) {
        const currentItem = activeYoutubeItems[currentYoutubeIndex];
        if (currentItem) {
          const videoId = getYouTubeId(currentItem.url);
          if (videoId) {
            const originalIndex = youtubeItems.findIndex(item => item.id === currentItem.id);
            const channelNumber = originalIndex !== -1 ? originalIndex + 1 : currentYoutubeIndex + 1;
            const muteParam = settings.mute ? '1' : '1'; // Force mute=1 for autoplay to work
            const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muteParam}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1&playsinline=1&vq=hd1080&hd=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`;
            
            return (
              <div className="relative w-full h-full bg-black overflow-hidden group">
                <iframe
                  ref={iframeRef}
                  key={`yt-${currentItem.id}-${videoId}-${muteParam}`}
                  src={embedUrl}
                  title={`Digital Signage YouTube Player #${channelNumber}`}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto aspect-video border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ pointerEvents: 'none' }}
                />
                {/* Live indicator & channel badge */}
                <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded bg-black/75 border border-zinc-800 text-[10px] font-bold text-yellow-500 font-mono tracking-wider flex items-center gap-1 shadow select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  CH #{channelNumber}
                </div>
                
                {/* Sleek yellow progress bar for the playing YouTube video */}
                <div 
                  className="absolute inset-x-0 h-1 bg-black/40 z-30 transition-all duration-300"
                  style={{ bottom: activeQrItems.length > 0 ? '110px' : '0px' }}
                >
                  <div 
                    className="h-full bg-yellow-500 shadow-[0_0_8px_rgba(250,204,21,0.6)] transition-all duration-200 ease-linear"
                    style={{ width: `${youtubeProgress}%` }}
                  />
                </div>
              </div>
            );
          }
        }
      }
      
      // Standby default state when list is empty
      return (
        <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="absolute w-[200px] h-[200px] bg-yellow-500/5 blur-2xl rounded-full status-pulse" />
          <div className="relative z-10 space-y-3">
            <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-yellow-500 inline-block status-pulse shadow-lg shadow-yellow-500/5">
              <Tv size={32} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">No Active Streams</h3>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-[240px] mx-auto">
                All configured streams are either disabled or invalid. Please enable at least one stream in the control panel.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // 2. Playlist media mode (Dual-render with absolute stack to prevent blank screens)
    if (activeMedia.length > 0) {
      return (
        <div className="w-full h-full relative bg-black overflow-hidden">
          {activeMedia.map((item, index) => {
            const isCurrent = index === displayIndex;
            const isPrev = index === prevIndex;
            const shouldRenderMedia = isCurrent || isPrev;

            return (
              <div 
                key={item.id} 
                style={getItemTransitionStyle(index)}
              >
                {item.type === 'video' ? (
                  shouldRenderMedia && (
                    <video
                      ref={isCurrent ? videoRef : null}
                      src={item.url}
                      autoPlay={isCurrent}
                      muted={settings.mute}
                      onEnded={isCurrent ? handleVideoEnded : undefined}
                      className={`w-full h-full ${getScaleModeClass(item)}`}
                      style={getMediaStyle(item)}
                      playsInline
                    />
                  )
                ) : (
                  // Images are rendered at all times to pre-load and cache inside the DOM.
                  // This guarantees zero screen flash or loading delay when shifting slides!
                  <img
                    src={item.url}
                    alt={item.name}
                    className={`w-full h-full ${getScaleModeClass(item)}`}
                    style={getMediaStyle(item)}
                  />
                )}

                {/* Premium customized visual text overlay */}
                {shouldRenderMedia && item.overlay_text && item.overlay_text.trim() !== '' && (
                  <div className={`absolute ${getOverlayPositionClass(item)} z-30 px-5 py-2.5 rounded-2xl border text-center font-bold tracking-wide shadow-2xl backdrop-blur-md animate-pulse text-xs md:text-sm max-w-[85%] select-none ${getOverlayTextColorClass(item.overlay_text_color)}`}>
                    {item.overlay_text}
                  </div>
                )}
              </div>
            );
          })}
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



  // Render simulated view inside screen frame
  const playerScreen = (
    <div className="relative w-full h-full aspect-video bg-black rounded-lg overflow-hidden block shadow-2xl">
      {/* Dynamic Player Content */}
      {renderSignageContent()}

      {/* Realtime Glassmorphic Multi-QR Footer */}
      {renderQrFooter()}

      {/* Screen Status Mini Badge */}
      <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded border border-zinc-800 text-[9px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
        LIVE TV PREVIEW
      </div>
    </div>
  );

  // Return full TV frame or simulated absolute fullscreen overlay
  if (pureScreenMode) {
    return (
      <div className="relative w-screen h-screen bg-black overflow-hidden block">
        {/* Dynamic Player Content */}
        {renderSignageContent()}

        {/* Realtime Glassmorphic Multi-QR Footer */}
        {renderQrFooter()}
      </div>
    );
  }

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
