'use client';

import React, { useState, useRef, useEffect } from 'react';
import { QrCode, ToggleLeft, ToggleRight, LayoutGrid, ChevronDown, Check, Sliders } from 'lucide-react';

interface QRCodeControlProps {
  text: string;
  enabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  onUpdate: (settings: { 
    qr_text?: string; 
    qr_enabled?: boolean; 
    qr_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; 
    qr_size?: number 
  }) => Promise<void>;
}

const POSITIONS = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
] as const;

export default function QRCodeControl({ text, enabled, position, size, onUpdate }: QRCodeControlProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [qrTextInput, setQrTextInput] = useState(text);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQrTextInput(text);
  }, [text]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQrTextInput(val);
    onUpdate({ qr_text: val });
  };

  const handlePositionSelect = (val: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    onUpdate({ qr_position: val });
    setDropdownOpen(false);
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onUpdate({ qr_size: val });
  };

  const toggleEnabled = () => {
    onUpdate({ qr_enabled: !enabled });
  };

  const selectedPosition = POSITIONS.find(p => p.value === position) || POSITIONS[3];

  return (
    <div className="space-y-4">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-yellow-500">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">QR Code Overlay</h3>
            <p className="text-[11px] text-zinc-500">Floating QR overlay on TV screen</p>
          </div>
        </div>

        {/* Enabled Toggle Switch */}
        <button
          onClick={toggleEnabled}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 border ${
            enabled
              ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-md shadow-yellow-500/5'
              : 'bg-zinc-950/40 border-zinc-900 text-zinc-500'
          }`}
        >
          {enabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* QR Input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
          QR Content / URL
        </label>
        <div className="relative">
          <input
            type="text"
            value={qrTextInput}
            onChange={handleTextChange}
            placeholder="e.g., https://wa.me/your-number"
            className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
          />
        </div>
      </div>

      {/* Custom dropdown list matching the theme perfectly */}
      <div className="space-y-1.5" ref={dropdownRef}>
        <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
          <LayoutGrid size={12} className="text-zinc-500" /> QR Code Position
        </label>
        
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white hover:border-zinc-700 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300 text-left"
          >
            <span>{selectedPosition.label}</span>
            <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180 text-yellow-500' : ''}`} />
          </button>

          {/* Animated Themed Dropdown Options list */}
          {dropdownOpen && (
            <div className="absolute z-30 w-full mt-1.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1 max-h-[220px] overflow-y-auto space-y-0.5">
                {POSITIONS.map((pos) => {
                  const isSelected = pos.value === position;
                  return (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => handlePositionSelect(pos.value)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all duration-200 text-left ${
                        isSelected
                          ? 'bg-yellow-500 text-black font-semibold'
                          : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                      }`}
                    >
                      <span>{pos.label}</span>
                      {isSelected && <Check size={14} className="text-black" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Size Slider */}
      <div className="space-y-1.5 p-3 rounded-xl bg-zinc-950/20 border border-zinc-900">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Sliders size={12} className="text-zinc-500" /> QR Code Size
          </span>
          <span className="text-yellow-500 font-bold font-mono">{size}px</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-zinc-600 font-mono">60px</span>
          <input
            type="range"
            min="60"
            max="250"
            value={size}
            onChange={handleSizeChange}
            className="flex-1 accent-yellow-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-zinc-650 font-mono">250px</span>
        </div>
      </div>
    </div>
  );
}
