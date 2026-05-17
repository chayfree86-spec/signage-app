'use client';

import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Play, Link2, VolumeX, RotateCcw } from 'lucide-react';

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

interface YouTubeControlProps {
  url: string;
  enabled: boolean;
  mute: boolean;
  onUpdate: (settings: { youtube_url?: string; youtube_enabled?: boolean; mute?: boolean }) => Promise<void>;
}

// Parse YouTube ID from standard watch link, share link, or embed link
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function YouTubeControl({ url, enabled, mute, onUpdate }: YouTubeControlProps) {
  const [inputValue, setInputValue] = useState(url);
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(url);
    setVideoId(getYouTubeId(url));
  }, [url]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setInputValue(newUrl);
    
    // Auto-parse on typing
    const id = getYouTubeId(newUrl);
    setVideoId(id);

    // Save configuration change
    onUpdate({ youtube_url: newUrl });
  };

  const toggleEnabled = () => {
    onUpdate({ youtube_enabled: !enabled });
  };

  const toggleMute = () => {
    onUpdate({ mute: !mute });
  };

  return (
    <div className="space-y-4">
      {/* Title & Enable Toggle Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-red-500">
            <Youtube size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">YouTube Live Stream / Video</h3>
            <p className="text-[11px] text-zinc-500">YouTube video signage control</p>
          </div>
        </div>

        {/* Enabled/Disabled Custom Toggle */}
        <button
          onClick={toggleEnabled}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 border ${
            enabled
              ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-md shadow-yellow-500/5'
              : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
          }`}
        >
          {enabled ? (
            <>
              <Play size={12} className="fill-current animate-pulse" />
              Active
            </>
          ) : (
            'Disabled'
          )}
        </button>
      </div>

      {/* URL Input Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
          <Link2 size={16} />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={handleUrlChange}
          placeholder="Paste YouTube URL (e.g., https://youtu.be/...)"
          className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
        />
      </div>

      {/* Toggles Panel */}
      <div className="grid grid-cols-2 gap-2">
        {/* Autoplay & Loop (Implicit in Signage Preview) info */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/20 border border-zinc-900">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <RotateCcw size={12} className="text-zinc-500" /> Auto Loop
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-yellow-500 font-bold uppercase">
            Active
          </span>
        </div>

        {/* Volume Mute Switch Toggle */}
        <button
          onClick={toggleMute}
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 text-left ${
            mute
              ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
              : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:border-zinc-850'
          }`}
        >
          <span className="text-xs flex items-center gap-1.5">
            <VolumeX size={12} className={mute ? 'text-yellow-500' : 'text-zinc-500'} /> Mute Audio
          </span>
          <div className="shrink-0">
            {mute ? (
              <ToggleRight className="w-6 h-6 text-yellow-500" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-zinc-700" />
            )}
          </div>
        </button>
      </div>

      {/* Video Preview Thumbnail (Ultimate UX Detail) */}
      {videoId ? (
        <div className="relative rounded-xl overflow-hidden border border-zinc-850 aspect-video bg-zinc-950">
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt="YouTube Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
              <Youtube size={10} className="fill-current text-red-500" />
              YouTube URL Valid
            </div>
            <p className="text-[11px] text-zinc-400 truncate mt-1">Video ID: {videoId}</p>
          </div>
        </div>
      ) : inputValue.trim() !== '' ? (
        <div className="p-3 text-center rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 text-xs flex items-center justify-center gap-2">
          ❌ Invalid YouTube URL
        </div>
      ) : (
        <div className="p-4 text-center rounded-xl bg-zinc-950/30 border border-zinc-900 text-zinc-500 text-[11px]">
          Enter a YouTube video or live stream URL to display on the live TV screen.
        </div>
      )}
    </div>
  );
}
