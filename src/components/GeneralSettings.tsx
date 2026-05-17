'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Clock, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Database, 
  Key, 
  Save, 
  Trash,
  Settings,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from '@/lib/supabase';

interface GeneralSettingsProps {
  slideDuration: number;
  mute: boolean;
  onUpdate: (settings: { slide_duration?: number; mute?: boolean }) => Promise<void>;
  onTriggerFullscreen: () => void;
  onReloadData: () => Promise<void>;
}

export default function GeneralSettings({
  slideDuration,
  mute,
  onUpdate,
  onTriggerFullscreen,
  onReloadData,
}: GeneralSettingsProps) {
  const [durationInput, setDurationInput] = useState(slideDuration);
  
  // Supabase Credentials local states
  const [dbUrl, setDbUrl] = useState('');
  const [dbAnonKey, setDbAnonKey] = useState('');
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const [configAlertType, setConfigAlertType] = useState<'success' | 'delete'>('success');

  useEffect(() => {
    setDurationInput(slideDuration);
  }, [slideDuration]);

  // Load current cloud config on mount
  useEffect(() => {
    const config = getSupabaseConfig();
    if (config) {
      setDbUrl(config.url);
      setDbAnonKey(config.anonKey);
      setIsCloudConfigured(true);
    } else {
      setDbUrl('');
      setDbAnonKey('');
      setIsCloudConfigured(false);
    }
  }, []);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDurationInput(val);
    onUpdate({ slide_duration: val });
  };

  const handleMuteChange = () => {
    onUpdate({ mute: !mute });
  };

  const handleSaveCredentials = async () => {
    if (dbUrl.trim() && dbAnonKey.trim()) {
      saveSupabaseConfig(dbUrl, dbAnonKey);
      setIsCloudConfigured(true);
      setConfigAlertType('success');
      setShowConfigAlert(true);
      setTimeout(() => setShowConfigAlert(false), 4000);
      
      // Reload page state to trigger Supabase connection
      await onReloadData();
    }
  };

  const handleClearCredentials = async () => {
    clearSupabaseConfig();
    setDbUrl('');
    setDbAnonKey('');
    setIsCloudConfigured(false);
    setConfigAlertType('delete');
    setShowConfigAlert(true);
    setTimeout(() => setShowConfigAlert(false), 4000);
    
    // Reload page state to fallback to Local offline storage
    await onReloadData();
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-yellow-500">
          <Settings size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">General Settings</h3>
          <p className="text-[11px] text-zinc-500">Signage simulation and playback parameters</p>
        </div>
      </div>

      {/* Slide Duration Control */}
      <div className="space-y-1.5 p-3 rounded-xl bg-zinc-950/20 border border-zinc-900">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock size={12} className="text-zinc-500" /> Slide Duration
          </span>
          <span className="text-yellow-500 font-bold font-mono">{durationInput}s</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-zinc-650 font-mono">3s</span>
          <input
            type="range"
            min="3"
            max="60"
            value={durationInput}
            onChange={handleDurationChange}
            className="flex-1 accent-yellow-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-zinc-600 font-mono">60s</span>
        </div>
        <p className="text-[10px] text-zinc-500 italic mt-1">Time duration to show each image slide</p>
      </div>

      {/* Mute and Fullscreen Controls */}
      <div className="grid grid-cols-2 gap-2">
        {/* Signage Preview Fullscreen Simulation Trigger */}
        <button
          onClick={onTriggerFullscreen}
          className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-950/20 border border-zinc-900 hover:border-yellow-500/30 hover:bg-yellow-500/5 text-zinc-300 hover:text-yellow-500 transition-all duration-300 font-semibold text-xs"
        >
          <Maximize2 size={13} className="shrink-0" />
          Simulator Fullscreen
        </button>

        {/* Video Audio Control Switch */}
        <button
          onClick={handleMuteChange}
          className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300 font-semibold text-xs ${
            mute
              ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500'
              : 'bg-zinc-950/20 border-zinc-900 text-zinc-300 hover:border-zinc-800'
          }`}
        >
          {mute ? (
            <>
              <VolumeX size={13} className="shrink-0" />
              Audio Muted
            </>
          ) : (
            <>
              <Volume2 size={13} className="shrink-0 text-yellow-500" />
              Audio Playing
            </>
          )}
        </button>
      </div>

      {/* Premium Supabase credentials control center */}
      <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-900 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
          <div className="flex items-center gap-1.5">
            <Database size={13} className={isCloudConfigured ? 'text-yellow-500' : 'text-zinc-500'} />
            <span className="text-xs font-semibold text-white">Cloud Sync (Supabase Integration)</span>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
            isCloudConfigured 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
          }`}>
            {isCloudConfigured ? 'CONNECTED' : 'LOCAL ONLY'}
          </span>
        </div>

        {/* Info label */}
        <p className="text-[10px] text-zinc-550 leading-relaxed">
          Enter your Supabase credentials to sync data to the cloud. If left empty, all data will remain securely inside your browser's IndexedDB local offline storage.
        </p>

        {/* Credential Alerts */}
        {showConfigAlert && (
          <div className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 border ${
            configAlertType === 'success'
              ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}>
            {configAlertType === 'success' ? (
              <>
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                <span>Supabase client successfully updated!</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} className="shrink-0 text-zinc-500" />
                <span>Credentials removed! Local offline mode activated.</span>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          {/* Supabase URL field */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase">SUPABASE PROJECT URL</span>
            <input
              type="text"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-500/30 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-300"
            />
          </div>

          {/* Supabase Anon Key field */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase flex items-center gap-1">
              <Key size={10} /> SUPABASE ANON API KEY
            </span>
            <input
              type="password"
              value={dbAnonKey}
              onChange={(e) => setDbAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-500/30 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-300"
            />
          </div>
        </div>

        {/* Buttons Panel */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleSaveCredentials}
            disabled={!dbUrl.trim() || !dbAnonKey.trim()}
            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-yellow-500 hover:bg-yellow-450 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border disabled:border-zinc-850 text-black font-bold text-[11px] transition-all duration-200 cursor-pointer"
          >
            <Save size={12} /> Save Config (Connect)
          </button>

          <button
            onClick={handleClearCredentials}
            disabled={!isCloudConfigured}
            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 text-zinc-400 hover:text-white font-bold text-[11px] transition-all duration-200 border border-zinc-800"
          >
            <Trash size={12} /> Reset (Disconnect)
          </button>
        </div>
      </div>
    </div>
  );
}
