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
  AlertCircle,
  HardDrive
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

  // Google Drive states
  const [driveConfig, setDriveConfig] = useState<{ configured: boolean; email: string | null; folderId: string | null; folderName: string | null } | null>(null);
  const [loadingDrive, setLoadingDrive] = useState(true);

  useEffect(() => {
    setDurationInput(slideDuration);
  }, [slideDuration]);

  // Load current cloud config and drive status on mount
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

    fetchDriveStatus();
  }, []);

  const fetchDriveStatus = async () => {
    try {
      setLoadingDrive(true);
      const res = await fetch('/api/drive/status');
      const data = await res.json();
      setDriveConfig(data);
    } catch (err) {
      console.error('Failed to load Google Drive status:', err);
    } finally {
      setLoadingDrive(false);
    }
  };

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

      {/* Premium Google Drive Connection Status Card */}
      <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-900 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
          <div className="flex items-center gap-1.5">
            <HardDrive size={13} className={driveConfig?.configured ? 'text-yellow-500' : 'text-zinc-500'} />
            <span className="text-xs font-semibold text-white">Google Drive integration</span>
          </div>
          {loadingDrive ? (
            <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
              driveConfig?.configured 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
            }`}>
              {driveConfig?.configured ? 'CONNECTED' : 'NOT CONFIGURED'}
            </span>
          )}
        </div>

        {loadingDrive ? (
          <p className="text-[10px] text-zinc-500 italic">Loading...</p>
        ) : driveConfig?.configured ? (
          <div className="space-y-2">
            <p className="text-[10.5px] text-zinc-300 leading-relaxed font-medium">
              Google Drive storage is active! All your uploaded files (Images and Videos) will be securely saved in Google Drive.
            </p>
            <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-900 text-[10px] space-y-2 font-mono text-zinc-400">
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[9px] uppercase tracking-wider block">Email ID:</span>
                <span className="text-yellow-500 font-semibold break-all block">chaychaupaltv@gmail.com</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[9px] uppercase tracking-wider block">Drive Folder:</span>
                <span className="text-zinc-300 font-semibold break-all block">{driveConfig.folderName || driveConfig.folderId}</span>
              </div>
            </div>
            <div className="p-2.5 bg-yellow-500/5 border border-yellow-500/10 rounded-lg flex gap-2">
              <AlertCircle size={12} className="text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-[9.5px] text-zinc-400 leading-relaxed">
                <strong className="text-yellow-500">Important:</strong> Ensure that you have shared your <code className="text-white bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">chaychaupaltv@gmail.com</code> Google Drive folder with the above Service Account email as <strong className="text-white">Editor</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[10.5px] text-zinc-400 leading-relaxed">
              Google Drive is currently not configured on the server. Files will be saved in the local browser's IndexedDB offline storage.
            </p>
            <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-900 space-y-2">
              <span className="text-[9.5px] font-bold text-yellow-500 uppercase tracking-wider block">How to Connect Drive:</span>
              <ol className="list-decimal pl-4 text-[9.5px] text-zinc-400 space-y-1.5 leading-relaxed">
                <li>Copy <code className="text-zinc-300 bg-zinc-900 px-1 rounded">.env.example</code> in the project root to create <code className="text-zinc-300 bg-zinc-900 px-1 rounded">.env.local</code>.</li>
                <li>Create a Service Account on Google Cloud Console and download the JSON credentials file.</li>
                <li>Paste the <code className="text-zinc-300">client_email</code> and <code className="text-zinc-300">private_key</code> from the JSON file into <code className="text-zinc-300">.env.local</code> as <code className="text-yellow-500/90 font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and <code className="text-yellow-500/90 font-mono">GOOGLE_PRIVATE_KEY</code> respectively.</li>
                <li>Create a new folder in your Google Drive (<strong className="text-white">chaychaupaltv@gmail.com</strong>) and share it with the Service Account email as <strong className="text-white">Editor</strong>.</li>
                <li>Paste the folder ID from the folder URL into <code className="text-yellow-500/90 font-mono">GOOGLE_DRIVE_FOLDER_ID</code> and restart the server!</li>
              </ol>
            </div>
          </div>
        )}
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
