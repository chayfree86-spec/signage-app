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

  // Dynamic Google Drive inputs and states
  const [driveEmail, setDriveEmail] = useState('');
  const [drivePrivateKey, setDrivePrivateKey] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [savingDrive, setSavingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);
  const [isEditingDrive, setIsEditingDrive] = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);

  useEffect(() => {
    if (driveConfig) {
      setDriveEmail(driveConfig.email || '');
      setDriveFolderId(driveConfig.folderId || '');
    }
  }, [driveConfig]);

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

  const handleSaveDrive = async () => {
    if (!driveEmail.trim() || !drivePrivateKey.trim() || !driveFolderId.trim()) {
      setDriveError('सभी फ़ील्ड्स (Email, Private Key, Folder ID) आवश्यक हैं।');
      return;
    }

    setSavingDrive(true);
    setDriveError(null);
    setDriveSuccess(null);

    try {
      const res = await fetch('/api/drive/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: driveEmail.trim(),
          privateKey: drivePrivateKey.trim(),
          folderId: driveFolderId.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setDriveError(data.error || 'कनेक्शन विफल रहा। क्रेडेंशियल्स की जांच करें।');
      } else {
        setDriveSuccess(data.message || 'Google Drive सफलतापूर्वक कनेक्ट हो गया!');
        setDrivePrivateKey(''); // सुरक्षा कारणों से क्लियर करें
        setIsEditingDrive(false);
        await fetchDriveStatus();
        if (onReloadData) {
          await onReloadData();
        }
      }
    } catch (err: any) {
      setDriveError(err.message || 'कन्फ़िगरेशन के दौरान एक त्रुटि आई।');
    } finally {
      setSavingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!confirm('क्या आप सचमुच Google Drive को डिस्कनेक्ट करना चाहते हैं? फ़ाइलें लोकल ब्राउज़र स्टोरेज (IndexedDB) में सेव होने लगेंगी।')) {
      return;
    }

    setSavingDrive(true);
    setDriveError(null);
    setDriveSuccess(null);

    try {
      const res = await fetch('/api/drive/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setDriveError(data.error || 'डिस्कनेक्ट करने में विफल।');
      } else {
        setDriveSuccess('Google Drive सफलतापूर्वक डिस्कनेक्ट हो गया!');
        setDriveEmail('');
        setDrivePrivateKey('');
        setDriveFolderId('');
        setIsEditingDrive(false);
        await fetchDriveStatus();
        if (onReloadData) {
          await onReloadData();
        }
      }
    } catch (err: any) {
      setDriveError(err.message || 'एक त्रुटि आई।');
    } finally {
      setSavingDrive(false);
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
            <div className="w-3.5 h-3.5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="flex items-center gap-1.5">
              {driveConfig?.configured && !isEditingDrive && (
                <button
                  onClick={() => setIsEditingDrive(true)}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all font-semibold"
                >
                  EDIT CONFIG
                </button>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                driveConfig?.configured 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
              }`}>
                {driveConfig?.configured ? 'CONNECTED' : 'NOT CONFIGURED'}
              </span>
            </div>
          )}
        </div>

        {/* Success / Error Alerts */}
        {driveError && (
          <div className="p-2.5 rounded-lg text-[10.5px] border bg-red-950/30 border-red-900/40 text-red-400 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-500 mt-0.5" />
            <span>{driveError}</span>
          </div>
        )}
        {driveSuccess && (
          <div className="p-2.5 rounded-lg text-[10.5px] border bg-emerald-950/30 border-emerald-900/40 text-emerald-400 flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-500 mt-0.5" />
            <span>{driveSuccess}</span>
          </div>
        )}

        {loadingDrive ? (
          <p className="text-[10px] text-zinc-500 italic">Loading...</p>
        ) : driveConfig?.configured && !isEditingDrive ? (
          <div className="space-y-2">
            <p className="text-[10.5px] text-zinc-300 leading-relaxed font-medium">
              Google Drive storage is active! All your uploaded files (Images and Videos) will be securely saved in Google Drive.
            </p>
            <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-900 text-[10px] space-y-2 font-mono text-zinc-400">
              <div className="space-y-0.5">
                <span className="text-zinc-500 text-[9px] uppercase tracking-wider block">Service Account Email:</span>
                <span className="text-yellow-500 font-semibold break-all block">{driveConfig.email}</span>
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
            <button
              onClick={handleDisconnectDrive}
              disabled={savingDrive}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-red-950/30 hover:border-red-900/40 text-zinc-400 hover:text-red-400 font-bold text-[11px] transition-all duration-300 border border-zinc-850 cursor-pointer disabled:opacity-40"
            >
              <Trash size={12} /> Google Drive Disconnect (लोकल मोड)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10.5px] text-zinc-400 leading-relaxed">
              {driveConfig?.configured 
                ? 'Google Drive credentials को अपडेट करने के लिए नीचे दी गई जानकारी भरें:' 
                : 'Google Drive क्रेडेंशियल्स दर्ज करें। फाइलें सीधे Google Drive क्लाउड स्टोरेज पर सेव होंगी।'}
            </p>
            
            <div className="space-y-2.5">
              {/* Service Account Email field */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase block">Google Service Account Email</span>
                <input
                  type="text"
                  value={driveEmail}
                  onChange={(e) => setDriveEmail(e.target.value)}
                  placeholder="signageapp@project-id.iam.gserviceaccount.com"
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-500/30 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-300"
                />
              </div>

              {/* Private Key field */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase block flex items-center gap-1">
                  <Key size={10} /> Google Private Key
                </span>
                <textarea
                  value={drivePrivateKey}
                  onChange={(e) => setDrivePrivateKey(e.target.value)}
                  placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
                  rows={4}
                  className="w-full px-3 py-1.5 text-[11px] bg-zinc-950 border border-zinc-850 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-500/30 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-300 font-mono resize-none"
                />
              </div>

              {/* Folder ID field */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase block">Google Drive Shared Folder ID</span>
                <input
                  type="text"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  placeholder="1qRbqN0gFQSSuRb1Ons1_tF4tWlEt8C6y"
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-850 rounded-lg text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-500/30 focus:ring-1 focus:ring-yellow-500/30 transition-all duration-300"
                />
              </div>
            </div>

            {/* Buttons Panel */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveDrive}
                disabled={savingDrive || !driveEmail.trim() || !drivePrivateKey.trim() || !driveFolderId.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-yellow-500 hover:bg-yellow-450 disabled:bg-zinc-900 disabled:text-zinc-650 disabled:border disabled:border-zinc-850 text-black font-bold text-[11px] transition-all duration-200 cursor-pointer"
              >
                {savingDrive ? (
                  <>
                    <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Save size={12} /> Drive Connect
                  </>
                )}
              </button>

              {driveConfig?.configured ? (
                <button
                  onClick={() => setIsEditingDrive(false)}
                  disabled={savingDrive}
                  className="py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-[11px] transition-all duration-200 border border-zinc-800"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => setShowDriveGuide(!showDriveGuide)}
                  className="py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-[11px] transition-all duration-200 border border-zinc-800 flex items-center gap-1"
                >
                  <HelpCircle size={12} /> {showDriveGuide ? 'Hide Guide' : 'Setup Guide'}
                </button>
              )}
            </div>

            {showDriveGuide && !driveConfig?.configured && (
              <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-900 space-y-2 mt-2 transition-all duration-300">
                <span className="text-[9.5px] font-bold text-yellow-500 uppercase tracking-wider block">How to Connect Drive:</span>
                <ol className="list-decimal pl-4 text-[9.5px] text-zinc-455 space-y-1.5 leading-relaxed">
                  <li>Create a Service Account on Google Cloud Console and download the JSON credentials file.</li>
                  <li>Enter the <code className="text-zinc-300">client_email</code> and the full <code className="text-zinc-300">private_key</code> in the fields above.</li>
                  <li>Create a new folder in your Google Drive (<strong className="text-white">chaychaupaltv@gmail.com</strong>) and share it with the Service Account email as <strong className="text-white">Editor</strong>.</li>
                  <li>Paste the folder ID from the folder URL (the string after <code className="text-zinc-500">/folders/</code>) into the Folder ID field and click <strong className="text-yellow-500">Drive Connect</strong>!</li>
                </ol>
              </div>
            )}
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
