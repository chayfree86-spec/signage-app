import React, { useState, useEffect, useRef } from 'react';
import { 
  ToggleLeft, 
  ToggleRight, 
  Play, 
  Link2, 
  VolumeX, 
  RotateCw,
  RotateCcw, 
  Plus, 
  Trash2, 
  Check, 
  Power,
  FolderOpen,
  ChevronLeft,
  Edit2,
  FolderPlus
} from 'lucide-react';
import { YouTubeItem, YouTubePlaylist } from '@/lib/db';

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
  url: string; // Stored as a JSON-stringified array of YouTubeItem
  playlistsData?: string; // Stored as a JSON-stringified array of YouTubePlaylist
  enabled: boolean;
  mute: boolean;
  loop?: boolean;
  onUpdate: (settings: { youtube_url?: string; youtube_enabled?: boolean; mute?: boolean; youtube_active_id?: string; youtube_playlists?: string; youtube_loop?: boolean }) => Promise<void>;
  slideDuration?: number;
  activeId?: string;
}

// Parse YouTube ID from standard watch link, share link, or embed link
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function getFallbackYouTubeTitle(url: string): string {
  const videoId = getYouTubeId(url);
  return videoId ? `YouTube ${videoId}` : 'YouTube stream';
}

// Safely parse JSON array of streams or fallback to single url
export function parseYouTubeUrls(youtube_url: string): YouTubeItem[] {
  if (!youtube_url || youtube_url.trim() === '') return [];
  try {
    const parsed = JSON.parse(youtube_url);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => {
        if (typeof item === 'string') {
          return { id: `yt-${index}`, url: item, enabled: true };
        }
        return {
          id: item.id || `yt-${index}`,
          url: item.url || '',
          enabled: item.enabled !== undefined ? item.enabled : true,
          title: item.title
        };
      });
    }
  } catch {
    // Fallback if not valid JSON array
  }
  return [{ id: 'yt-default', url: youtube_url, enabled: true }];
}

interface YouTubePlaylistCardProps {
  playlist: YouTubePlaylist;
  isActive: boolean;
  isRenaming: boolean;
  playlistRenameInput: string;
  setPlaylistRenameInput: (val: string) => void;
  setEditingPlaylistId: (id: string | null) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string, e: React.MouseEvent) => void;
  onTogglePlaylistActive: (id: string, e: React.MouseEvent) => void;
  onSelect: () => void;
  isGlobalEnabled: boolean;
  playingState: { itemId: string | null; progress: number };
  showDeleteButton: boolean;
  activeId?: string;
}

const YouTubePlaylistCard: React.FC<YouTubePlaylistCardProps> = ({
  playlist,
  isActive,
  isRenaming,
  playlistRenameInput,
  setPlaylistRenameInput,
  setEditingPlaylistId,
  onRenamePlaylist,
  onDeletePlaylist,
  onTogglePlaylistActive,
  onSelect,
  isGlobalEnabled,
  playingState,
  showDeleteButton,
  activeId
}) => {
  const previewItems = playlist.items.filter(item => item.enabled && getYouTubeId(item.url));
  const [currentIndex, setCurrentIndex] = useState(0);

  // If there's an item playing in this active playlist, find its index to show it immediately
  const activePlayingId = playingState.itemId || (isActive ? activeId : null);
  const playingItemIndex = previewItems.findIndex(item => item.id === activePlayingId);
  const isCurrentlyPlayingAny = isGlobalEnabled && isActive && playingItemIndex !== -1;

  useEffect(() => {
    if (isCurrentlyPlayingAny) {
      const timer = setTimeout(() => setCurrentIndex(playingItemIndex), 0);
      return () => clearTimeout(timer);
    }
    if (previewItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % previewItems.length);
    }, 3000); // cycle every 3 seconds
    return () => clearInterval(interval);
  }, [previewItems.length, isCurrentlyPlayingAny, playingItemIndex]);

  const currentPreviewItem = previewItems[currentIndex];
  const videoId = currentPreviewItem ? getYouTubeId(currentPreviewItem.url) : null;
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-2xl p-4 sm:p-5 border transition-all duration-500 flex flex-col justify-between aspect-square cursor-pointer overflow-hidden bg-zinc-950 ${
        isActive 
          ? 'border-red-500/35 shadow-[0_0_20px_rgba(239,68,68,0.04)] bg-zinc-900/40' 
          : 'border-zinc-900 hover:border-red-500/25 hover:bg-zinc-900/10'
      }`}
    >
      {/* Background preview */}
      {videoId ? (
        <div className="absolute inset-0 z-0">
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt="Playlist preview"
            className="w-full h-full object-cover opacity-25 group-hover:opacity-35 transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03)_0%,transparent_70%)] opacity-80" />
      )}

      {/* Top Section */}
      <div className="relative z-10 space-y-2 pointer-events-none w-full">
        <div className="flex items-start justify-between gap-1.5 w-full">
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-1 pointer-events-auto" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={playlistRenameInput}
                  onChange={e => setPlaylistRenameInput(e.target.value)}
                  className="bg-zinc-950 border border-zinc-850 rounded-xl px-2 py-1 text-[11px] text-white outline-none focus:border-red-500/40 w-full"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      onRenamePlaylist(playlist.id, playlistRenameInput);
                      setEditingPlaylistId(null);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    onRenamePlaylist(playlist.id, playlistRenameInput);
                    setEditingPlaylistId(null);
                  }}
                  className="p-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-450 hover:bg-emerald-500 hover:text-black cursor-pointer transition-colors"
                >
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-1 group/name pointer-events-auto w-full">
                <h3 
                  className="font-bold text-white text-[12px] uppercase tracking-wider group-hover:text-red-400 transition-colors whitespace-normal break-words flex-1 text-left"
                  title={playlist.name}
                >
                  {playlist.name}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPlaylistId(playlist.id);
                    setPlaylistRenameInput(playlist.name);
                  }}
                  className="opacity-0 group-hover/name:opacity-100 p-0.5 text-zinc-550 hover:text-red-500 transition-opacity cursor-pointer shrink-0"
                >
                  <Edit2 size={10} />
                </button>
              </div>
            )}
            <p className="text-[10px] text-zinc-400 mt-1 font-semibold uppercase tracking-wider">
              {playlist.items.length} Stream Slot{playlist.items.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Active Status Toggler Pill */}
          <button
            onClick={(e) => onTogglePlaylistActive(playlist.id, e)}
            className={`px-2.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest cursor-pointer transition-all shrink-0 pointer-events-auto shadow-md backdrop-blur-sm z-10 ${
              isActive 
                ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30' 
                : 'bg-black/60 border-zinc-850 text-zinc-450 hover:text-white'
            }`}
          >
            {isActive ? 'Active' : 'Off'}
          </button>
        </div>
      </div>

      {/* Middle/Center overlay when active & playing */}
      {isCurrentlyPlayingAny && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-[10px] font-black text-red-400 tracking-wider shadow-lg animate-pulse backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            PLAYING SLOT #{playingItemIndex + 1}
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-zinc-900/40 mt-auto">
        <span className="flex items-center gap-1 text-[9.5px] text-red-500 font-extrabold uppercase tracking-wider group-hover:text-white transition-colors">
          <FolderOpen size={11} className="shrink-0" />
          <span>Manage Links</span>
        </span>

        {showDeleteButton && (
          <button
            onClick={(e) => onDeletePlaylist(playlist.id, e)}
            className="p-1.5 text-zinc-500 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer pointer-events-auto"
            title="Delete Playlist"
          >
            <Trash2 size={11.5} />
          </button>
        )}
      </div>
    </div>
  );
};

export default function YouTubeControl({ url, playlistsData, enabled, mute, loop = true, onUpdate, slideDuration = 8, activeId }: YouTubeControlProps) {
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const prevUrlRef = useRef<string>(url);
  const prevPlaylistsDataRef = useRef<string | undefined>(playlistsData);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const fetchedUrlsRef = useRef<Set<string>>(new Set());
  
  // Custom Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
  // Renaming playlist states
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [playlistRenameInput, setPlaylistRenameInput] = useState('');
  
  // New playlist state
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [playingState, setPlayingState] = useState<{ itemId: string | null; progress: number }>({ itemId: null, progress: 0 });
  const [syncingNow, setSyncingNow] = useState(false);

  // Initialize and load playlists from props (DB) or Local Storage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let initialPlaylists: YouTubePlaylist[] = [];
    if (playlistsData) {
      try {
        initialPlaylists = JSON.parse(playlistsData) as YouTubePlaylist[];
      } catch (e) {
        console.error('Failed to parse playlists from props:', e);
      }
    }
    
    if (initialPlaylists.length === 0) {
      const saved = localStorage.getItem('signage_youtube_playlists');
      if (saved) {
        try {
          initialPlaylists = JSON.parse(saved) as YouTubePlaylist[];
        } catch (e) {
          console.error('Failed to parse saved youtube playlists:', e);
        }
      }
    }

    if (initialPlaylists.length > 0) {
      const initTimer = setTimeout(() => setPlaylists(initialPlaylists), 0);
      
      // Ensure parent url and playlistsData are in sync with active playlist items
      const active = initialPlaylists.find(p => p.active);
      if (active) {
        const activeItemsStr = JSON.stringify(active.items);
        if (activeItemsStr !== url || playlistsData !== JSON.stringify(initialPlaylists)) {
          onUpdate({ 
            youtube_url: activeItemsStr,
            youtube_playlists: JSON.stringify(initialPlaylists)
          }).catch((error) => {
            console.error('Failed to sync initial YouTube playlist:', error);
          });
        }
      } else {
        if (playlistsData !== JSON.stringify(initialPlaylists)) {
          onUpdate({ 
            youtube_playlists: JSON.stringify(initialPlaylists)
          }).catch((error) => {
            console.error('Failed to sync initial YouTube playlist:', error);
          });
        }
      }
      return () => clearTimeout(initTimer);
    } else {
      // Seed with initial "Default YouTube Playlist" containing current youtube_url items
      const currentStreams = parseYouTubeUrls(url);
      const defaultPlaylist: YouTubePlaylist = {
        id: 'yt-playlist-default',
        name: 'Default YouTube Playlist',
        active: true,
        items: currentStreams,
        created_at: new Date().toISOString()
      };
      const initial = [defaultPlaylist];
      const initTimer = setTimeout(() => setPlaylists(initial), 0);
      onUpdate({
        youtube_playlists: JSON.stringify(initial)
      }).then(() => {
        localStorage.setItem('signage_youtube_playlists', JSON.stringify(initial));
      }).catch((error) => {
        console.error('Failed to sync default YouTube playlist:', error);
      });
      return () => clearTimeout(initTimer);
    }
  }, []);

  // Fetch missing titles for any YouTubeItem in any playlist
  useEffect(() => {
    if (playlists.length === 0) return;
    
    // Find all items in all playlists that don't have a title
    const itemsToFetch: { playlistId: string; item: YouTubeItem }[] = [];
    for (const p of playlists) {
      for (const item of p.items) {
        if (item.url && getYouTubeId(item.url) && !item.title && !fetchedUrlsRef.current.has(item.url)) {
          itemsToFetch.push({ playlistId: p.id, item });
        }
      }
    }

    if (itemsToFetch.length === 0) return;

    // Mark them as fetched
    itemsToFetch.forEach(({ item }) => fetchedUrlsRef.current.add(item.url));

    const fetchTitles = async () => {
      let modified = false;
      const updatedPlaylists = JSON.parse(JSON.stringify(playlists)) as YouTubePlaylist[];

      for (const { playlistId, item } of itemsToFetch) {
        const p = updatedPlaylists.find(pl => pl.id === playlistId);
        if (p) {
          const it = p.items.find(i => i.id === item.id);
          if (it) {
            it.title = getFallbackYouTubeTitle(item.url);
            modified = true;
          }
        }
      }

      if (modified) {
        setPlaylists(updatedPlaylists);
        
        // Sync active playlist items to parent url
        const activePlaylist = updatedPlaylists.find(p => p.active);
        if (activePlaylist) {
          onUpdate({ 
            youtube_url: JSON.stringify(activePlaylist.items),
            youtube_playlists: JSON.stringify(updatedPlaylists)
          }).then(() => {
            localStorage.setItem('signage_youtube_playlists', JSON.stringify(updatedPlaylists));
          }).catch((error) => {
            console.error('Failed to sync YouTube titles:', error);
          });
        } else {
          onUpdate({
            youtube_playlists: JSON.stringify(updatedPlaylists)
          }).then(() => {
            localStorage.setItem('signage_youtube_playlists', JSON.stringify(updatedPlaylists));
          }).catch((error) => {
            console.error('Failed to sync YouTube titles:', error);
          });
        }
      }
    };

    const timer = setTimeout(fetchTitles, 1000);
    return () => clearTimeout(timer);
  }, [playlists, onUpdate]);

  // Sync external changes (url or playlistsData)
  useEffect(() => {
    const urlChanged = url !== prevUrlRef.current;
    const playlistsDataChanged = playlistsData !== prevPlaylistsDataRef.current;

    prevUrlRef.current = url;
    prevPlaylistsDataRef.current = playlistsData;

    if (!urlChanged && !playlistsDataChanged) {
      return;
    }

    let currentPlaylists = playlists;
    let playlistsChanged = false;

    // 1. If playlistsData changed externally, parse and update
    if (playlistsDataChanged && playlistsData) {
      try {
        const parsed = JSON.parse(playlistsData) as YouTubePlaylist[];
        if (JSON.stringify(parsed) !== JSON.stringify(currentPlaylists)) {
          currentPlaylists = parsed;
          playlistsChanged = true;
        }
      } catch (e) {
        console.error('Failed to parse updated playlistsData prop:', e);
      }
    }

    // 2. If url changed externally, sync it to the active playlist of currentPlaylists
    if (urlChanged && currentPlaylists.length > 0) {
      const active = currentPlaylists.find(p => p.active);
      if (active) {
        const activeItemsStr = JSON.stringify(active.items);
        if (url !== activeItemsStr) {
          const parsedItems = parseYouTubeUrls(url);
          currentPlaylists = currentPlaylists.map(p => {
            if (p.active) {
              return { ...p, items: parsedItems };
            }
            return p;
          });
          playlistsChanged = true;
        }
      }
    }

    // 3. Save and set playlists if changed
    if (playlistsChanged) {
      setPlaylists(currentPlaylists);
      
      // If the change came from a direct URL update (and not playlistsData update),
      // sync the updated playlists back to the parent.
      if (!playlistsDataChanged) {
        onUpdate({ youtube_playlists: JSON.stringify(currentPlaylists) }).then(() => {
          localStorage.setItem('signage_youtube_playlists', JSON.stringify(currentPlaylists));
        }).catch((error) => {
          console.error('Failed to sync external YouTube changes:', error);
        });
      } else {
        localStorage.setItem('signage_youtube_playlists', JSON.stringify(currentPlaylists));
      }
    }
  }, [url, playlistsData, playlists]);

  // Broadcast channel for signage play progress synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new window.BroadcastChannel('signage_play_status');
    let timeoutId: NodeJS.Timeout | null = null;

    const handleMessage = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object' && e.data.type === 'youtube') {
        setPlayingState({
          itemId: e.data.itemId || null,
          progress: e.data.progress || 0
        });

        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setPlayingState({ itemId: null, progress: 0 });
        }, 1500);
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      if (timeoutId) clearTimeout(timeoutId);
      channel.close();
    };
  }, []);

  // Find currently selected or fallback to active playlist
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const items = selectedPlaylist ? selectedPlaylist.items : [];
  const selectedPlaylistInputsSignature = selectedPlaylist
    ? selectedPlaylist.items.map(item => `${item.id}:${item.url}`).join('|')
    : '';

  // Update input values when switching selected playlist
  useEffect(() => {
    if (selectedPlaylist) {
      const initialInputs: Record<string, string> = {};
      selectedPlaylist.items.forEach(item => {
        initialInputs[item.id] = item.url;
      });
      const timer = setTimeout(() => setInputValues(initialInputs), 0);
      return () => clearTimeout(timer);
    }
  }, [selectedPlaylistId, selectedPlaylist?.id, selectedPlaylistInputsSignature]);

  const savePlaylistsState = async (updatedPlaylists: YouTubePlaylist[]) => {
    setPlaylists(updatedPlaylists);

    const activePlaylist = updatedPlaylists.find(p => p.active);

    try {
      if (activePlaylist) {
        await onUpdate({ 
          youtube_url: JSON.stringify(activePlaylist.items),
          youtube_playlists: JSON.stringify(updatedPlaylists)
        });
      } else {
        await onUpdate({
          youtube_playlists: JSON.stringify(updatedPlaylists)
        });
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('signage_youtube_playlists', JSON.stringify(updatedPlaylists));
      }
    } catch (error) {
      console.error('Failed to sync YouTube playlists:', error);
    }
  };

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      const activePlaylist = playlists.find(p => p.active);
      await onUpdate({
        youtube_url: JSON.stringify(activePlaylist?.items || []),
        youtube_playlists: JSON.stringify(playlists),
      });
    } finally {
      setSyncingNow(false);
    }
  };

  const saveItems = (updatedItems: YouTubeItem[]) => {
    if (!selectedPlaylistId) return;
    const updatedPlaylists = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return { ...p, items: updatedItems };
      }
      return p;
    });
    savePlaylistsState(updatedPlaylists);
  };

  const handlePlayNow = (id: string) => {
    onUpdate({ youtube_active_id: id });
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new window.BroadcastChannel('signage_play_status');
      channel.postMessage({
        type: 'play_youtube_item',
        itemId: id
      });
      channel.close();
    }
  };

  const handleInputChange = (id: string, value: string) => {
    setInputValues(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveItem = async (id: string) => {
    const newUrl = inputValues[id] || '';
    
    // Save locally first to ensure immediate feedback
    const updated = items.map(item => {
      if (item.id === id) {
        const titleVal = item.url === newUrl ? item.title : undefined;
        return { ...item, url: newUrl, title: titleVal };
      }
      return item;
    });
    saveItems(updated);

    const videoId = getYouTubeId(newUrl);
    if (videoId) {
      const updatedWithTitle = updated.map(item => {
        if (item.id === id) {
          return { ...item, url: newUrl, title: getFallbackYouTubeTitle(newUrl) };
        }
        return item;
      });
      saveItems(updatedWithTitle);
    }
  };

  const handleToggleEnabled = (id: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, enabled: !item.enabled };
      }
      return item;
    });
    
    // If the active stream is being disabled, assign active ID to another enabled stream
    const targetItem = items.find(item => item.id === id);
    if (targetItem && targetItem.enabled) { // Was enabled, now disabled
      if (activeId === id) {
        const nextEnabledItem = updated.find(item => item.enabled && getYouTubeId(item.url));
        onUpdate({ youtube_active_id: nextEnabledItem ? nextEnabledItem.id : '' });
      }
    }

    saveItems(updated);
  };

  const handleDeleteItem = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Stream Slot",
      message: "Are you sure you want to delete this stream slot? This action cannot be undone.",
      onConfirm: () => {
        const updated = items.filter(item => item.id !== id);
        
        // If the active stream is being deleted, assign active ID to another enabled stream
        if (activeId === id) {
          const nextEnabledItem = updated.find(item => item.enabled && getYouTubeId(item.url));
          onUpdate({ youtube_active_id: nextEnabledItem ? nextEnabledItem.id : '' });
        }
        
        saveItems(updated);
        
        const newInputs = { ...inputValues };
        delete newInputs[id];
        setInputValues(newInputs);
      }
    });
  };

  const handleAddItem = () => {
    const newId = `yt-${crypto.randomUUID()}`;
    const updated = [
      ...items,
      { id: newId, url: '', enabled: true }
    ];
    setInputValues(prev => ({ ...prev, [newId]: '' }));
    saveItems(updated);
  };

  const toggleEnabled = () => {
    onUpdate({ youtube_enabled: !enabled });
  };

  const toggleMute = () => {
    onUpdate({ mute: !mute });
  };

  const toggleLoop = () => {
    onUpdate({ youtube_loop: !loop });
  };

  // YouTube Playlist operations
  const handleCreatePlaylist = (name: string) => {
    if (!name.trim()) return;
    const newPlaylist: YouTubePlaylist = {
      id: `yt-playlist-${Date.now()}`,
      name: name.trim(),
      active: playlists.length === 0, // Make active if it's the first playlist
      items: [],
      created_at: new Date().toISOString()
    };
    const updated = [...playlists, newPlaylist];
    savePlaylistsState(updated);
  };

  const handleDeletePlaylist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: "Delete Playlist",
      message: "Are you sure you want to delete this playlist? This will remove all items inside it.",
      onConfirm: () => {
        const toDelete = playlists.find(p => p.id === id);
        const updated = playlists.filter(p => p.id !== id);
        if (toDelete?.active && updated.length > 0) {
          updated[0].active = true;
        }
        savePlaylistsState(updated);
        if (selectedPlaylistId === id) {
          setSelectedPlaylistId(null);
        }
      }
    });
  };

  const handleTogglePlaylistActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = playlists.map(p => {
      if (p.id === id) {
        return { ...p, active: true };
      }
      return { ...p, active: false };
    });
    savePlaylistsState(updated);
  };

  const handleRenamePlaylist = (id: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = playlists.map(p => {
      if (p.id === id) {
        return { ...p, name: newName.trim() };
      }
      return p;
    });
    savePlaylistsState(updated);
  };

  return (
    <div className="space-y-6">
      {/* Title & Enable Toggle Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-red-500 shadow-md">
            <Youtube size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">YouTube Live Stream / Video</h3>
            <p className="text-[11px] text-zinc-500">Manage multiple split-screen streams</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncNow}
            disabled={syncingNow}
            title="Sync YouTube playlists to Supabase and Google Drive"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-300 border border-zinc-700 bg-zinc-950/80 text-zinc-200 hover:border-red-500/50 hover:text-red-200 cursor-pointer select-none active:scale-95 disabled:opacity-60 disabled:cursor-wait"
          >
            <RotateCw size={12} className={syncingNow ? 'animate-spin' : ''} />
            {syncingNow ? 'Syncing' : 'Sync YouTube'}
          </button>

          {/* Enabled/Disabled Toggle */}
          <button
            onClick={toggleEnabled}
            title={enabled ? 'Disable YouTube playback' : 'Enable YouTube playback'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-300 border cursor-pointer select-none active:scale-95 ${
              enabled
                ? 'bg-red-500/15 border-red-500/50 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.12)]'
                : 'bg-red-500 text-white border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.18)] hover:bg-red-400'
            }`}
            style={
              enabled
                ? {
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    color: 'rgb(252, 165, 165)',
                  }
                : {}
            }
          >
            {enabled ? (
              <>
                <Play size={12} className="fill-current animate-pulse text-red-500" />
                Disable YouTube
              </>
            ) : (
              <>
                <Play size={12} className="fill-current" />
                Enable YouTube
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Mute Toggle Card */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleLoop}
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 text-left cursor-pointer ${
            loop
              ? 'bg-red-500/5 border-red-500/20 text-red-500'
              : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:border-zinc-850'
          }`}
        >
          <span className="text-xs flex items-center gap-1.5">
            <RotateCcw size={12} className={loop ? 'text-red-500' : 'text-zinc-500'} /> Auto Loop
          </span>
          <div className="shrink-0">
            {loop ? (
              <ToggleRight className="w-6 h-6 text-red-500" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-zinc-700" />
            )}
          </div>
        </button>

        <button
          onClick={toggleMute}
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 text-left cursor-pointer ${
            mute
              ? 'bg-red-500/5 border-red-500/20 text-red-500'
              : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:border-zinc-850'
          }`}
        >
          <span className="text-xs flex items-center gap-1.5">
            <VolumeX size={12} className={mute ? 'text-red-500' : 'text-zinc-500'} /> Mute Audio
          </span>
          <div className="shrink-0">
            {mute ? (
              <ToggleRight className="w-6 h-6 text-red-500" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-zinc-700" />
            )}
          </div>
        </button>
      </div>

      {/* Playlists view or Links management view */}
      {selectedPlaylistId === null ? (
        <div className="border-t border-zinc-900 pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/30 border border-zinc-900 p-3 rounded-2xl">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">YouTube Playlists</h4>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span>Total Playlists: <strong className="text-zinc-300 font-mono">{playlists.length}</strong></span>
              </div>
            </div>
          </div>

          {/* List Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {playlists.map((playlist) => (
              <YouTubePlaylistCard
                key={playlist.id}
                playlist={playlist}
                isActive={playlist.active}
                isRenaming={editingPlaylistId === playlist.id}
                playlistRenameInput={playlistRenameInput}
                setPlaylistRenameInput={setPlaylistRenameInput}
                setEditingPlaylistId={setEditingPlaylistId}
                onRenamePlaylist={handleRenamePlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onTogglePlaylistActive={handleTogglePlaylistActive}
                onSelect={() => setSelectedPlaylistId(playlist.id)}
                isGlobalEnabled={enabled}
                playingState={playingState}
                showDeleteButton={playlists.length > 1}
                activeId={activeId}
              />
            ))}
          </div>

          {/* Create Playlist Form */}
          <div className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-4 space-y-3">
            <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Create New Playlist</h5>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreatePlaylist(newPlaylistName);
                    setNewPlaylistName('');
                  }
                }}
                className="flex-1 bg-zinc-950/60 border border-zinc-850 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-700 outline-none focus:border-red-500/40 transition-colors"
              />
              <button
                onClick={() => {
                  handleCreatePlaylist(newPlaylistName);
                  setNewPlaylistName('');
                }}
                className="flex items-center justify-center p-2 rounded-xl bg-red-500 text-white hover:bg-red-400 transition-colors cursor-pointer"
              >
                <FolderPlus size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Link Editor view for selected playlist */
        <div className="border-t border-zinc-900 pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/30 border border-zinc-900 p-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPlaylistId(null)}
                className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white hover:border-zinc-750 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  {selectedPlaylist?.name}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-zinc-550">
                  <span>Total Slots: <strong className="text-zinc-300 font-mono">{items.length}</strong></span>
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span>Active: <strong className="text-emerald-400 font-mono">{items.filter(i => i.enabled && getYouTubeId(i.url)).length}</strong></span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-400 transition-all duration-200 cursor-pointer shadow-lg active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <Plus size={14} className="stroke-[3]" /> Add Stream Slot
            </button>
          </div>

          {/* Grid of Slots */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {items.map((item, index) => {
              const currentInput = inputValues[item.id] ?? item.url ?? '';
              const isModified = currentInput !== item.url;
              const videoId = getYouTubeId(currentInput);
              const savedVideoId = getYouTubeId(item.url);

              // Calculate if this stream is currently playing using broadcast playingState or activeId fallback
              const isPlaying = enabled && (
                playingState.itemId === item.id || 
                (!playingState.itemId && activeId === item.id)
              );
              const progressPercent = isPlaying ? playingState.progress : 0;

              return (
                <div 
                  key={item.id} 
                  className={`relative aspect-square rounded-xl overflow-hidden bg-zinc-950 border shadow-lg flex flex-col justify-between transition-all duration-300 group ${
                    isPlaying 
                      ? 'border-red-500/40 shadow-red-500/5 ring-1 ring-red-500/30' 
                      : 'border-zinc-900 hover:border-zinc-800'
                  }`}
                >
                  {/* Thumbnail background image */}
                  {videoId ? (
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                      alt={`Channel #${index + 1} preview`}
                      className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:opacity-45 transition-opacity duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03)_0%,transparent_70%)] opacity-80" />
                  )}

                  {/* Top Bar Header Overlay */}
                  <div className="absolute top-2 inset-x-2 flex items-center justify-between z-20 pointer-events-none">
                    {/* Channel & Playing badge overlay */}
                    <div className="flex items-center gap-1">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/85 border border-zinc-850 text-[9px] font-bold text-red-550 font-mono tracking-wide shadow-md backdrop-blur-md">
                        <span className={`w-1.5 h-1.5 rounded-full ${item.enabled && savedVideoId ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        CH#{index + 1}
                      </span>
                      {isPlaying && (
                        <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[8px] font-extrabold text-emerald-450 tracking-wider shadow-md backdrop-blur-md animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                          LIVE
                        </span>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1 pointer-events-auto">
                      {/* Play Now Button */}
                      {item.enabled && savedVideoId && (
                        <button
                          onClick={() => handlePlayNow(item.id)}
                          className={`p-1 rounded border transition-all duration-200 cursor-pointer shadow-md backdrop-blur-md active:scale-90 ${
                            isPlaying
                              ? 'bg-red-500 text-white border-red-500 hover:bg-red-400 font-bold'
                              : 'bg-zinc-950/60 border-zinc-850 text-zinc-300 hover:text-red-500 hover:border-red-500/30'
                          }`}
                          title="Play Now"
                        >
                          <Play size={12} className={isPlaying ? 'fill-current' : ''} />
                        </button>
                      )}

                      {/* Play/Stop Power Button */}
                      <button
                        onClick={() => handleToggleEnabled(item.id)}
                        className={`p-1 rounded border transition-all duration-200 cursor-pointer shadow-md backdrop-blur-md active:scale-90 ${
                          item.enabled 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        }`}
                        title={item.enabled ? "Stop Stream" : "Start Stream"}
                      >
                        <Power size={12} className="stroke-[2.5]" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 rounded border border-zinc-850 bg-black/60 text-zinc-450 hover:text-red-450 hover:border-red-500/30 transition-all duration-200 cursor-pointer shadow-md backdrop-blur-md active:scale-90"
                        title="Delete Stream Slot"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Central status notification overlays */}
                  {!item.enabled ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center p-2">
                      <span className="text-[9px] uppercase font-black tracking-widest text-red-400 px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30 shadow-lg">
                        STANDBY
                      </span>
                    </div>
                  ) : !videoId && currentInput.trim() !== '' ? (
                    <div className="absolute inset-0 bg-black/40 z-10 flex flex-col items-center justify-center text-center p-2">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-red-450 px-1 py-0.5 rounded bg-red-950/10 border border-red-900/20">
                        Invalid URL
                      </span>
                    </div>
                  ) : !videoId ? (
                    <div className="absolute inset-0 bg-black/10 z-10 flex flex-col items-center justify-center text-center p-2">
                      <span className="text-[8.5px] uppercase font-bold tracking-wider text-zinc-550 px-1 py-0.5 rounded bg-zinc-900/40 border border-zinc-850">
                        EMPTY SLOT #{index + 1}
                      </span>
                    </div>
                  ) : null}

                  {/* Bottom input form overlay */}
                  <div className="absolute bottom-2 inset-x-2 z-20 flex gap-1">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none text-zinc-550">
                        <Link2 size={11} />
                      </div>
                      <input
                        type="text"
                        value={focusedItemId === item.id ? currentInput : (item.url ? (item.title || currentInput) : currentInput)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        onBlur={() => {
                          handleSaveItem(item.id);
                          setFocusedItemId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveItem(item.id);
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="Paste URL..."
                        className="w-full pl-6 pr-1.5 py-1 text-[10px] bg-black/90 border border-zinc-850/80 rounded-md text-white placeholder-zinc-700 focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/40 transition-all duration-300 shadow-inner backdrop-blur-md"
                        title={item.title || currentInput}
                      />
                    </div>
                    <button
                      onClick={() => handleSaveItem(item.id)}
                      disabled={!isModified}
                      className={`flex items-center justify-center p-1 rounded-md transition-all duration-200 cursor-pointer active:scale-90 ${
                        isModified
                          ? item.url === ''
                            ? 'bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/10'
                            : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/10'
                          : 'bg-zinc-900/80 text-zinc-650 border border-zinc-850/50 cursor-not-allowed opacity-50'
                      }`}
                      title={item.url === '' ? "Add URL" : "Save URL"}
                    >
                      {item.url === '' ? (
                        <Plus size={11} className="stroke-[3]" />
                      ) : (
                        <Check size={11} className="stroke-[3]" />
                      )}
                    </button>
                  </div>

                  {/* Progress Bar */}
                  {isPlaying && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5 bg-zinc-900/60 z-20">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 to-amber-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all duration-200 ease-linear"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* "Add Stream Slot" grid card placeholder */}
            <button
              onClick={handleAddItem}
              className="relative aspect-square rounded-xl bg-zinc-950/20 border border-zinc-900 border-dashed hover:border-red-500/40 hover:bg-red-500/[0.02] transition-all duration-300 flex flex-col items-center justify-center gap-1 p-2 group cursor-pointer"
            >
              <div className="p-1 rounded-full bg-zinc-900/60 border border-zinc-850 text-zinc-550 group-hover:text-red-500 group-hover:border-red-500/30 group-hover:scale-105 transition-all duration-300 shadow-md">
                <Plus size={12} className="stroke-[2.5]" />
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-400 group-hover:text-red-500 transition-colors duration-300">
                  Add Slot
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel rounded-3xl p-6 border border-zinc-800/80 max-w-sm w-full mx-4 shadow-2xl space-y-6 relative overflow-hidden">
            {/* Ambient subtle background spot */}
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-red-500/10 blur-xl pointer-events-none" />
            
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">
                  <Youtube size={16} />
                </span>
                {confirmModal.title}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-900/60">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all font-medium text-[11px] uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black hover:border-red-500 transition-all font-bold text-[11px] uppercase tracking-wider cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
