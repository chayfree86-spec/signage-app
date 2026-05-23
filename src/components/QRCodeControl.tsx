import React, { useState, useRef, useEffect } from 'react';
import { 
  QrCode, 
  LayoutGrid, 
  ChevronDown, 
  Check, 
  Sliders,
  Link,
  Star,
  CreditCard,
  HelpCircle,
  Sparkles,
  Globe,
  Share2
} from 'lucide-react';

// Custom SVG Icons for Social Platforms to avoid lucide version incompatibilities
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

const YoutubeIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const TwitterIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const LinkedinIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const WhatsappIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export interface QrItem {
  id: 'payment' | 'review' | 'social' | 'custom' | 'instagram' | 'facebook' | 'youtube';
  type: 'payment' | 'review' | 'social' | 'custom';
  label: string;
  enabled: boolean;
  customText: string;
  socialPlatform: 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'linkedin' | 'whatsapp';
  socialUsername: string;
  reviewUrl: string;
  paymentUpi: string;
  paymentName: string;
  paymentAmount: string;
  paymentNote: string;
}

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

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: <InstagramIcon size={14} className="text-pink-500" />, prefix: 'https://instagram.com/', placeholder: 'username (e.g., sandeep_dev)' },
  { value: 'facebook', label: 'Facebook', icon: <FacebookIcon size={14} className="text-blue-500" />, prefix: 'https://facebook.com/', placeholder: 'username (e.g., mybusiness)' },
  { value: 'youtube', label: 'YouTube', icon: <YoutubeIcon size={14} className="text-red-500" />, prefix: 'https://youtube.com/@', placeholder: '@channelname (e.g., @myvlog)' },
  { value: 'twitter', label: 'Twitter / X', icon: <TwitterIcon size={14} className="text-zinc-300" />, prefix: 'https://x.com/', placeholder: 'username (e.g., mytwitter)' },
  { value: 'linkedin', label: 'LinkedIn', icon: <LinkedinIcon size={14} className="text-blue-700" />, prefix: 'https://linkedin.com/in/', placeholder: 'username (e.g., sandeep)' },
  { value: 'whatsapp', label: 'WhatsApp', icon: <WhatsappIcon size={14} className="text-emerald-500" />, prefix: 'https://wa.me/', placeholder: 'Phone with country code (e.g., 919876543210)' },
] as const;

// Parser to support legacy qr_text strings
function parseLegacyQrText(text: string) {
  const result = {
    type: 'custom' as 'custom' | 'social' | 'review' | 'payment',
    socialPlatform: 'instagram' as 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'linkedin' | 'whatsapp',
    socialUsername: '',
    reviewUrl: '',
    paymentUpi: '',
    paymentName: '',
    paymentAmount: '',
    paymentNote: '',
    customText: text,
  };

  if (!text) return result;

  if (text.startsWith('upi://pay?')) {
    result.type = 'payment';
    try {
      const urlParams = new URLSearchParams(text.replace('upi://pay?', ''));
      result.paymentUpi = urlParams.get('pa') || '';
      result.paymentName = urlParams.get('pn') || '';
      result.paymentAmount = urlParams.get('am') || '';
      result.paymentNote = urlParams.get('tn') || '';
    } catch (e) {
      const matchPa = text.match(/[?&]pa=([^&]+)/);
      const matchPn = text.match(/[?&]pn=([^&]+)/);
      const matchAm = text.match(/[?&]am=([^&]+)/);
      const matchTn = text.match(/[?&]tn=([^&]+)/);
      if (matchPa) result.paymentUpi = decodeURIComponent(matchPa[1]);
      if (matchPn) result.paymentName = decodeURIComponent(matchPn[1]);
      if (matchAm) result.paymentAmount = decodeURIComponent(matchAm[1]);
      if (matchTn) result.paymentNote = decodeURIComponent(matchTn[1]);
    }
    return result;
  }

  if (
    text.includes('search.google.com') ||
    text.includes('g.page') ||
    text.includes('google.com/search') ||
    (text.includes('google.') && text.includes('review'))
  ) {
    result.type = 'review';
    result.reviewUrl = text;
    return result;
  }

  if (text.includes('instagram.com/')) {
    result.type = 'social';
    result.socialPlatform = 'instagram';
    result.socialUsername = text.split('instagram.com/')[1]?.split('?')[0] || '';
    return result;
  }
  if (text.includes('facebook.com/')) {
    result.type = 'social';
    result.socialPlatform = 'facebook';
    result.socialUsername = text.split('facebook.com/')[1]?.split('?')[0] || '';
    return result;
  }
  if (text.includes('youtube.com/@') || text.includes('youtube.com/c/')) {
    result.type = 'social';
    result.socialPlatform = 'youtube';
    if (text.includes('youtube.com/@')) {
      result.socialUsername = '@' + (text.split('youtube.com/@')[1]?.split('?')[0] || '');
    } else {
      result.socialUsername = text.split('youtube.com/c/')[1]?.split('?')[0] || '';
    }
    return result;
  }
  if (text.includes('x.com/') || text.includes('twitter.com/')) {
    result.type = 'social';
    result.socialPlatform = 'twitter';
    const splitKey = text.includes('x.com/') ? 'x.com/' : 'twitter.com/';
    result.socialUsername = text.split(splitKey)[1]?.split('?')[0] || '';
    return result;
  }
  if (text.includes('linkedin.com/')) {
    result.type = 'social';
    result.socialPlatform = 'linkedin';
    if (text.includes('linkedin.com/in/')) {
      result.socialUsername = 'in/' + (text.split('linkedin.com/in/')[1]?.split('?')[0] || '');
    } else if (text.includes('linkedin.com/company/')) {
      result.socialUsername = 'company/' + (text.split('linkedin.com/company/')[1]?.split('?')[0] || '');
    } else {
      result.socialUsername = text.split('linkedin.com/')[1]?.split('?')[0] || '';
    }
    return result;
  }
  if (text.includes('wa.me/') || text.includes('api.whatsapp.com/send')) {
    result.type = 'social';
    result.socialPlatform = 'whatsapp';
    if (text.includes('wa.me/')) {
      result.socialUsername = text.split('wa.me/')[1]?.split('?')[0] || '';
    } else {
      const match = text.match(/[?&]phone=([^&]+)/);
      result.socialUsername = match ? match[1] : '';
    }
    return result;
  }

  result.type = 'custom';
  result.customText = text;
  return result;
}

// Global Parser for Multiple QRs
export function parseMultipleQrTexts(text: string, qrEnabled: boolean = true): QrItem[] {
  const defaults: QrItem[] = [
    {
      id: 'payment',
      type: 'payment',
      label: 'UPI Payment',
      enabled: false,
      customText: '',
      socialPlatform: 'instagram',
      socialUsername: '',
      reviewUrl: '',
      paymentUpi: '',
      paymentName: '',
      paymentAmount: '',
      paymentNote: ''
    },
    {
      id: 'review',
      type: 'review',
      label: 'Google Review',
      enabled: false,
      customText: '',
      socialPlatform: 'instagram',
      socialUsername: '',
      reviewUrl: '',
      paymentUpi: '',
      paymentName: '',
      paymentAmount: '',
      paymentNote: ''
    },
    {
      id: 'instagram',
      type: 'social',
      label: 'Instagram',
      enabled: false,
      customText: '',
      socialPlatform: 'instagram',
      socialUsername: '',
      reviewUrl: '',
      paymentUpi: '',
      paymentName: '',
      paymentAmount: '',
      paymentNote: ''
    },
    {
      id: 'facebook',
      type: 'social',
      label: 'Facebook',
      enabled: false,
      customText: '',
      socialPlatform: 'facebook',
      socialUsername: '',
      reviewUrl: '',
      paymentUpi: '',
      paymentName: '',
      paymentAmount: '',
      paymentNote: ''
    },
    {
      id: 'youtube',
      type: 'social',
      label: 'YouTube',
      enabled: false,
      customText: '',
      socialPlatform: 'youtube',
      socialUsername: '',
      reviewUrl: '',
      paymentUpi: '',
      paymentName: '',
      paymentAmount: '',
      paymentNote: ''
    },
    {
      id: 'custom',
      type: 'custom',
      label: 'Custom Link',
      enabled: false,
      customText: '',
      socialPlatform: 'instagram',
      socialUsername: '',
      reviewUrl: '',
      paymentUpi: '',
      paymentName: '',
      paymentAmount: '',
      paymentNote: ''
    }
  ];

  let parsedItems: any[] = [];
  let isParsedOk = false;

  if (text && text.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        parsedItems = parsed;
        isParsedOk = true;
      }
    } catch (e) {
      console.error("JSON parse failed, falling back to legacy:", e);
    }
  }

  if (isParsedOk) {
    // Smart Migration: look for old single 'social' platform state if exists
    const oldSocial = parsedItems.find(item => item.id === 'social');

    return defaults.map(def => {
      // If we have an old social settings and it matches this platform
      if (oldSocial && oldSocial.socialPlatform === def.id) {
        return {
          ...def,
          enabled: oldSocial.enabled,
          socialUsername: oldSocial.socialUsername || '',
          socialPlatform: def.socialPlatform
        };
      }
      
      // Direct match from state
      const found = parsedItems.find(item => item.id === def.id);
      if (found) {
        return { 
          ...def, 
          ...found,
          id: def.id,
          type: def.type,
          socialPlatform: def.socialPlatform
        };
      }
      return def;
    });
  }

  // Fallback parsing for legacy single QR strings
  const legacy = parseLegacyQrText(text);
  return defaults.map(def => {
    const isLegacySocialMatch = legacy.type === 'social' && def.type === 'social' && def.id === legacy.socialPlatform;
    if (def.id === legacy.type || isLegacySocialMatch) {
      return {
        ...def,
        enabled: qrEnabled && !!text.trim(),
        customText: legacy.customText,
        socialPlatform: legacy.socialPlatform,
        socialUsername: legacy.socialUsername,
        reviewUrl: legacy.reviewUrl,
        paymentUpi: legacy.paymentUpi,
        paymentName: legacy.paymentName,
        paymentAmount: legacy.paymentAmount,
        paymentNote: legacy.paymentNote
      };
    }
    return def;
  });
}

export function getQrItemValue(item: QrItem): string {
  switch (item.type) {
    case 'custom':
      return item.customText.trim();
      
    case 'social': {
      const username = item.socialUsername.trim().replace(/^@/, '');
      if (!username) return '';
      switch (item.socialPlatform) {
        case 'instagram':
          return `https://instagram.com/${username}`;
        case 'facebook':
          return `https://facebook.com/${username}`;
        case 'youtube':
          return username.startsWith('UC') || username.startsWith('channel/')
            ? `https://youtube.com/${username}`
            : `https://youtube.com/@${username}`;
        case 'twitter':
          return `https://x.com/${username}`;
        case 'linkedin':
          return username.startsWith('in/') || username.startsWith('company/')
            ? `https://linkedin.com/${username}`
            : `https://linkedin.com/in/${username}`;
        case 'whatsapp': {
          const cleanPhone = username.replace(/[+\s-()]/g, '');
          return `https://wa.me/${cleanPhone}`;
        }
        default:
          return '';
      }
    }
    
    case 'review':
      return item.reviewUrl.trim();
      
    case 'payment': {
      const upi = item.paymentUpi.trim();
      if (!upi) return '';
      const name = encodeURIComponent(item.paymentName.trim());
      const amount = item.paymentAmount.trim();
      const note = encodeURIComponent(item.paymentNote.trim());
      
      let upiUrl = `upi://pay?pa=${upi}`;
      if (name) upiUrl += `&pn=${name}`;
      if (amount && !isNaN(Number(amount))) upiUrl += `&am=${amount}`;
      if (note) upiUrl += `&tn=${note}`;
      upiUrl += `&cu=INR`;
      
      return upiUrl;
    }
    default:
      return '';
  }
}

export default function QRCodeControl({ text, enabled, position, size, onUpdate }: QRCodeControlProps) {
  const [qrItems, setQrItems] = useState<QrItem[]>(() => parseMultipleQrTexts(text, enabled));
  const [expandedId, setExpandedId] = useState<QrItem['id'] | 'social_media_group' | null>('payment');
  const [socialDropdownOpen, setSocialDropdownOpen] = useState(false);
  const socialDropdownRef = useRef<HTMLDivElement>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEditingRef = useRef<boolean>(false);

  // Sync with database updates during render phase
  const [prevText, setPrevText] = useState(text);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (text !== prevText || enabled !== prevEnabled) {
    setPrevText(text);
    setPrevEnabled(enabled);
    // Only overwrite local state if the user is not actively typing
    if (!isEditingRef.current) {
      setQrItems(parseMultipleQrTexts(text, enabled));
    }
  }

  // Click outside listener for custom dropdown list
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (socialDropdownRef.current && !socialDropdownRef.current.contains(e.target as Node)) {
        setSocialDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const updateQrItem = (id: QrItem['id'], updates: Partial<QrItem>) => {
    const updatedItems = qrItems.map(item => {
      if (item.id === id) {
        return { ...item, ...updates } as QrItem;
      }
      return item;
    });
    setQrItems(updatedItems);
    
    // Set editing flag to block prop sync overwrites
    isEditingRef.current = true;

    // Debounce the network update
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null;
      isEditingRef.current = false;
      await onUpdate({ qr_text: JSON.stringify(updatedItems) });
    }, 600);
  };

  const toggleExpand = (id: QrItem['id'] | 'social_media_group') => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleEnabled = () => {
    const nextEnabled = !enabled;
    const updatePayload: { qr_enabled: boolean; qr_text?: string } = { qr_enabled: nextEnabled };
    
    if (nextEnabled) {
      const anyActive = qrItems.some(item => item.enabled && getQrItemValue(item).trim() !== '');
      if (!anyActive) {
        // Automatically enable custom link with default value if all are empty/disabled
        const updatedItems = qrItems.map(item => {
          if (item.id === 'custom') {
            return {
              ...item,
              enabled: true,
              customText: item.customText.trim() || 'https://github.com'
            };
          }
          return item;
        });
        setQrItems(updatedItems);
        updatePayload.qr_text = JSON.stringify(updatedItems);
      }
    }
    
    onUpdate(updatePayload);
  };

  // Render forms inside the selected accordion item
  const renderAccordionContent = (item: QrItem) => {
    switch (item.type) {
      case 'custom':
        return (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                Enter Custom URL or Text
              </label>
              <input
                type="text"
                value={item.customText}
                onChange={(e) => updateQrItem('custom', { customText: e.target.value })}
                placeholder="e.g., https://mywebsite.com"
                className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              Enter any standard website link or custom text to generate the QR code in the footer banner.
            </p>
          </div>
        );

      case 'social': {
        const platformKey = item.id === 'instagram' ? 'instagram' : item.id === 'facebook' ? 'facebook' : 'youtube';
        const selectedSocial = SOCIAL_PLATFORMS.find(p => p.value === platformKey) || SOCIAL_PLATFORMS[0];
        const qrVal = getQrItemValue(item);
        
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Username input with prefix */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                Enter {selectedSocial.label} Username
              </label>
              <div className="flex items-center mt-1">
                <span className="px-3 py-2 bg-zinc-900 border border-r-0 border-zinc-800 rounded-l-xl text-xs text-zinc-550 font-mono shrink-0 select-none">
                  {selectedSocial.prefix}
                </span>
                <input
                  type="text"
                  value={item.socialUsername}
                  onChange={(e) => updateQrItem(item.id, { 
                    socialUsername: e.target.value,
                    socialPlatform: platformKey
                  })}
                  placeholder={selectedSocial.placeholder.split(' (e.g.')[0]}
                  className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-r-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
                />
              </div>
            </div>
            
            {item.socialUsername.trim() !== '' && (
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900 text-[10px] text-zinc-400 break-all flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 font-bold shrink-0">Live URL</span>
                <span className="font-mono text-zinc-300">{qrVal}</span>
              </div>
            )}
          </div>
        );
      }

      case 'review':
        return (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                Enter Google Review URL
              </label>
              <input
                type="text"
                value={item.reviewUrl}
                onChange={(e) => updateQrItem('review', { reviewUrl: e.target.value })}
                placeholder="e.g., https://g.page/r/YOUR_BUSINESS_ID/review"
                className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-900 text-xs text-zinc-400 space-y-2">
              <span className="font-semibold text-yellow-500 flex items-center gap-1.5">
                <HelpCircle size={13} /> How to get your Google Review link?
              </span>
              <ul className="list-decimal list-inside text-[10px] space-y-1 pl-1 text-zinc-400 leading-relaxed">
                <li>Go to your Google Business Profile Manager.</li>
                <li>Click on the <strong>&quot;Get more reviews&quot;</strong> button.</li>
                <li>Copy the short review URL (e.g. <code>g.page/r/.../review</code>) and paste it here.</li>
              </ul>
            </div>
          </div>
        );

      case 'payment': {
        const qrVal = getQrItemValue(item);
        return (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* UPI VPA */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  UPI ID (VPA) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={item.paymentUpi}
                  onChange={(e) => updateQrItem('payment', { paymentUpi: e.target.value })}
                  placeholder="e.g., yourname@okaxis"
                  className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
                />
              </div>

              {/* Payee Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Payee Name
                </label>
                <input
                  type="text"
                  value={item.paymentName}
                  onChange={(e) => updateQrItem('payment', { paymentName: e.target.value })}
                  placeholder="e.g., Sandeep Kumar"
                  className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Amount (Optional)
                </label>
                <input
                  type="number"
                  value={item.paymentAmount}
                  onChange={(e) => updateQrItem('payment', { paymentAmount: e.target.value })}
                  placeholder="e.g., 500"
                  className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Payment Note */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  value={item.paymentNote}
                  onChange={(e) => updateQrItem('payment', { paymentNote: e.target.value })}
                  placeholder="e.g., Signage Payment"
                  className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-650 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all duration-300"
                />
              </div>
            </div>

            {item.paymentUpi.trim() !== '' && (
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900 text-[10px] text-zinc-400 break-all space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 font-bold shrink-0">UPI Intent URI</span>
                  <span className="font-bold text-zinc-300">UPI QR Code is Active</span>
                </div>
                <div className="font-mono text-zinc-500 break-all select-all">{qrVal}</div>
              </div>
            )}
          </div>
        );
      }
    }
  };

  const renderSocialGroupContent = () => {
    const socialIds: ('instagram' | 'facebook' | 'youtube')[] = ['instagram', 'facebook', 'youtube'];
    
    return (
      <div className="space-y-4.5 animate-in fade-in duration-300">
        {socialIds.map(id => {
          const item = qrItems.find(i => i.id === id);
          if (!item) return null;

          const platform = SOCIAL_PLATFORMS.find(p => p.value === id) || SOCIAL_PLATFORMS[0];
          const qrVal = getQrItemValue(item);
          
          let brandColor = 'text-pink-500';
          let borderFocusColor = 'focus:border-pink-500/50 focus:ring-pink-500/50';
          let toggleBgActive = 'bg-pink-500';
          let rowBgClass = 'bg-zinc-950/30 border-zinc-900';
          
          if (id === 'facebook') {
            brandColor = 'text-blue-500';
            borderFocusColor = 'focus:border-blue-500/50 focus:ring-blue-500/50';
            toggleBgActive = 'bg-blue-600';
          } else if (id === 'youtube') {
            brandColor = 'text-red-500';
            borderFocusColor = 'focus:border-red-500/50 focus:ring-red-500/50';
            toggleBgActive = 'bg-red-500';
          }
          
          if (item.enabled) {
            rowBgClass = id === 'instagram' 
              ? 'bg-pink-500/5 border-pink-500/20 shadow-md shadow-pink-500/2' 
              : id === 'facebook' 
                ? 'bg-blue-500/5 border-blue-500/20 shadow-md shadow-blue-500/2' 
                : 'bg-red-500/5 border-red-500/20 shadow-md shadow-red-500/2';
          }

          return (
            <div key={id} className={`p-4 rounded-2xl border transition-all duration-300 ${rowBgClass}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-zinc-900 border border-zinc-850 ${brandColor}`}>
                    {id === 'instagram' && <InstagramIcon size={15} />}
                    {id === 'facebook' && <FacebookIcon size={15} />}
                    {id === 'youtube' && <YoutubeIcon size={15} />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white tracking-wide">{platform.label} Link</h5>
                    <p className="text-[10px] text-zinc-500">Configure your public profile username</p>
                  </div>
                </div>

                {/* Separate switch toggle for this platform */}
                <button
                  type="button"
                  onClick={() => {
                    updateQrItem(id, { enabled: !item.enabled });
                  }}
                  className={`w-9 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-300 ${
                    item.enabled ? toggleBgActive : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className={`bg-zinc-950 w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300 ${
                      item.enabled ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Username Input Field */}
              <div className="space-y-1.5">
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-zinc-900 border border-r-0 border-zinc-850 rounded-l-xl text-xs text-zinc-550 font-mono shrink-0 select-none">
                    {platform.prefix}
                  </span>
                  <input
                    type="text"
                    value={item.socialUsername}
                    onChange={(e) => updateQrItem(id, { 
                      socialUsername: e.target.value,
                      socialPlatform: id
                    })}
                    placeholder={platform.placeholder.split(' (e.g.')[0]}
                    className={`w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-850 rounded-r-xl text-white placeholder-zinc-650 focus:outline-none transition-all duration-300 ${borderFocusColor} focus:ring-1`}
                  />
                </div>
              </div>

              {/* Live URL Badge */}
              {item.socialUsername.trim() !== '' && (
                <div className="mt-3 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-900 text-[10px] text-zinc-400 break-all flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded font-extrabold shrink-0 bg-yellow-500/10 text-yellow-500`}>
                    Live URL
                  </span>
                  <span className="font-mono text-zinc-300">{qrVal}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const sections = [
    {
      id: 'payment' as const,
      label: 'UPI Payment',
      sub: 'Configured UPI payment options',
      badge: () => {
        const item = qrItems.find(i => i.id === 'payment');
        if (!item) return 'Hidden';
        const hasVal = getQrItemValue(item) !== '';
        return item.enabled && hasVal ? 'Visible on Screen' : item.enabled ? 'Enabled (No Value)' : 'Hidden';
      },
      badgeClass: () => {
        const item = qrItems.find(i => i.id === 'payment');
        if (!item || !item.enabled) return 'bg-zinc-900/60 border-zinc-850 text-zinc-550';
        return getQrItemValue(item) !== '' 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
      },
      isEnabled: () => !!qrItems.find(i => i.id === 'payment')?.enabled,
      toggle: () => {
        const item = qrItems.find(i => i.id === 'payment');
        if (item) updateQrItem('payment', { enabled: !item.enabled });
      },
      icon: <CreditCard size={16} />,
      renderContent: () => {
        const item = qrItems.find(i => i.id === 'payment');
        return item ? renderAccordionContent(item) : null;
      }
    },
    {
      id: 'review' as const,
      label: 'Google Review',
      sub: 'Customer Google Reviews link',
      badge: () => {
        const item = qrItems.find(i => i.id === 'review');
        if (!item) return 'Hidden';
        const hasVal = getQrItemValue(item) !== '';
        return item.enabled && hasVal ? 'Visible on Screen' : item.enabled ? 'Enabled (No Value)' : 'Hidden';
      },
      badgeClass: () => {
        const item = qrItems.find(i => i.id === 'review');
        if (!item || !item.enabled) return 'bg-zinc-900/60 border-zinc-850 text-zinc-550';
        return getQrItemValue(item) !== '' 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
      },
      isEnabled: () => !!qrItems.find(i => i.id === 'review')?.enabled,
      toggle: () => {
        const item = qrItems.find(i => i.id === 'review');
        if (item) updateQrItem('review', { enabled: !item.enabled });
      },
      icon: <Star size={16} />,
      renderContent: () => {
        const item = qrItems.find(i => i.id === 'review');
        return item ? renderAccordionContent(item) : null;
      }
    },
    {
      id: 'social_media_group' as const,
      label: 'Social Media Links',
      sub: 'Instagram, Facebook, and YouTube links',
      badge: () => {
        const socials = qrItems.filter(i => i.type === 'social' && i.enabled && getQrItemValue(i) !== '');
        if (socials.length === 0) return 'Hidden';
        return `${socials.length} Platform${socials.length > 1 ? 's' : ''} Live`;
      },
      badgeClass: () => {
        const socials = qrItems.filter(i => i.type === 'social' && i.enabled && getQrItemValue(i) !== '');
        if (socials.length === 0) return 'bg-zinc-900/60 border-zinc-850 text-zinc-550';
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      },
      isEnabled: () => qrItems.some(i => i.type === 'social' && i.enabled),
      toggle: () => {
        const anyEnabled = qrItems.some(i => i.type === 'social' && i.enabled);
        const updatedItems = qrItems.map(item => {
          if (item.type === 'social') {
            return { ...item, enabled: !anyEnabled };
          }
          return item;
        });
        setQrItems(updatedItems);
        onUpdate({ qr_text: JSON.stringify(updatedItems) });
      },
      icon: <Share2 size={16} className="text-yellow-500" />,
      renderContent: () => {
        return renderSocialGroupContent();
      }
    },
    {
      id: 'custom' as const,
      label: 'Custom Link',
      sub: 'General URLs or text links',
      badge: () => {
        const item = qrItems.find(i => i.id === 'custom');
        if (!item) return 'Hidden';
        const hasVal = getQrItemValue(item) !== '';
        return item.enabled && hasVal ? 'Visible on Screen' : item.enabled ? 'Enabled (No Value)' : 'Hidden';
      },
      badgeClass: () => {
        const item = qrItems.find(i => i.id === 'custom');
        if (!item || !item.enabled) return 'bg-zinc-900/60 border-zinc-850 text-zinc-550';
        return getQrItemValue(item) !== '' 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
      },
      isEnabled: () => !!qrItems.find(i => i.id === 'custom')?.enabled,
      toggle: () => {
        const item = qrItems.find(i => i.id === 'custom');
        if (item) updateQrItem('custom', { enabled: !item.enabled });
      },
      icon: <Link size={16} />,
      renderContent: () => {
        const item = qrItems.find(i => i.id === 'custom');
        return item ? renderAccordionContent(item) : null;
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-yellow-500">
            <QrCode size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Signage Footer QR Codes</h3>
            <p className="text-[11px] text-zinc-500">Display premium interactive QR codes at the bottom bar of your screen</p>
          </div>
        </div>

        {/* Master Switch */}
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

      {/* Accordions Stack */}
      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedId === section.id;
          const isSectionEnabled = section.isEnabled();
          
          return (
            <div 
              key={section.id} 
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                isSectionEnabled 
                  ? 'bg-zinc-950/40 border-yellow-500/20 shadow-md shadow-yellow-500/2' 
                  : 'bg-zinc-950/10 border-zinc-900/80 hover:border-zinc-800'
              }`}
            >
              {/* Accordion Header */}
              <div 
                onClick={() => toggleExpand(section.id)}
                className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-zinc-900/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                    isSectionEnabled 
                      ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' 
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400'
                  }`}>
                    {section.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">{section.label}</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {section.sub}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Indicator Badge */}
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${section.badgeClass()}`}>
                    {section.badge()}
                  </span>

                  {/* Separate Switch Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // Stop click propagating to expand accordion!
                      section.toggle();
                    }}
                    className={`w-9 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-300 ${
                      isSectionEnabled ? 'bg-yellow-500' : 'bg-zinc-800'
                    }`}
                  >
                    <div
                      className={`bg-zinc-950 w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300 ${
                        isSectionEnabled ? 'translate-x-3.5 bg-black' : 'translate-x-0 bg-zinc-400'
                      }`}
                    />
                  </button>

                  {/* Expand Chevron */}
                  <ChevronDown 
                    size={16} 
                    className={`text-zinc-500 transition-transform duration-300 ${
                      isExpanded ? 'rotate-180 text-yellow-500' : ''
                    }`} 
                  />
                </div>
              </div>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="p-4 border-t border-zinc-900/50 bg-zinc-950/15 space-y-4">
                  {section.renderContent()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
