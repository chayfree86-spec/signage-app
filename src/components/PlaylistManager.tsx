'use client';

import React, { useState, useRef, DragEvent, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  Check, 
  GripVertical, 
  Image as ImageIcon, 
  Film, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  Play,
  RotateCw,
  FolderOpen,
  Lock,
  X,
  ChevronDown
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaItem, Playlist, uploadMediaItem, savePlaylists, deleteMediaItem } from '@/lib/db';

interface PlaylistManagerProps {
  playlists: Playlist[];
  onPlaylistsChange: (playlists: Playlist[]) => void;
  allUploadedMedia: MediaItem[];
  onReloadUploadedMedia: () => Promise<void>;
}

// ----------------------------------------------------
// INDIVIDUAL SORTABLE MEDIA CARD (INSIDE PLAYLIST)
// ----------------------------------------------------
interface SortablePlaylistMediaCardProps {
  item: MediaItem;
  onDeleteItem: (id: string) => void;
  onToggleActiveItem: (id: string, active: boolean) => void;
  onUpdateItemDetails: (id: string, name: string, slideDuration: number) => void;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onEditImage: (item: MediaItem) => void;
}

function SortablePlaylistMediaCard({ 
  item, 
  onDeleteItem, 
  onToggleActiveItem,
  onUpdateItemDetails,
  isSelected,
  onToggleSelect,
  onEditImage
}: SortablePlaylistMediaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);
  const [editedDuration, setEditedDuration] = useState(item.slide_duration || 8);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleSave = () => {
    onUpdateItemDetails(item.id, editedName, Number(editedDuration));
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onDoubleClick={() => {
        if (!isEditing) {
          setEditedName(item.name);
          setEditedDuration(item.slide_duration || 8);
          setIsEditing(true);
        }
      }}
      className={`group relative flex flex-col gap-3.5 p-3 rounded-2xl transition-all duration-300 select-none cursor-pointer ${
        item.active 
          ? 'glass-panel bg-zinc-900/50 border border-zinc-800/80 hover:border-yellow-500/20' 
          : 'bg-zinc-950/20 border border-zinc-900/40 opacity-55 hover:opacity-80'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Grip Handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing p-1.5 text-zinc-500 hover:text-yellow-500 transition-colors"
        >
          <GripVertical size={16} />
        </div>

        {/* Custom Checkbox selector */}
        <div 
          className="shrink-0 flex items-center justify-center p-0.5"
          onClick={(e) => e.stopPropagation()} // Prevent double clicks on checkbox triggering edit mode!
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect(item.id, e.target.checked)}
            className="accent-yellow-500 rounded border-zinc-800 bg-zinc-950 cursor-pointer h-3.5 w-3.5"
          />
        </div>

        {/* Thumbnail preview with edit click handler */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onEditImage(item);
          }}
          className="relative w-16 h-11 bg-black rounded-lg overflow-hidden border border-zinc-850 flex items-center justify-center shrink-0 cursor-pointer hover:border-yellow-500 hover:ring-2 hover:ring-yellow-500/20 transition-all group/thumb"
          title="Click to Replace or Switch Media"
        >
          {item.type === 'video' ? (
            <>
              <video src={item.url} className="w-full h-full object-cover" muted />
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center group-hover/thumb:bg-black/10 transition-colors">
                <Film size={12} className="text-yellow-500" />
              </div>
            </>
          ) : (
            <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform" />
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
            <RotateCw size={12} className="text-yellow-500 animate-spin-slow" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1 text-xs text-white outline-none focus:border-yellow-500/50 w-full"
              />
              <button 
                onClick={handleSave}
                className="p-1 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black cursor-pointer transition-colors"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/name">
              <p className="text-xs font-semibold text-zinc-200 truncate">{item.name}</p>
              <button 
                onClick={() => {
                  setEditedName(item.name);
                  setEditedDuration(item.slide_duration || 8);
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover/name:opacity-100 p-0.5 text-zinc-500 hover:text-yellow-500 transition-opacity cursor-pointer"
              >
                <Edit2 size={10} />
              </button>
            </div>
          )}
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Duration: <span className="text-yellow-500/80 font-semibold">{item.slide_duration || 8}s</span> 
            {item.type === 'video' && ' (Video plays fully)'}
          </p>
        </div>

        {/* Item Active and Delete Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleActiveItem(item.id, !item.active)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              item.active 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white' 
                : 'bg-zinc-950 border-zinc-900 text-zinc-650 hover:bg-zinc-900 hover:text-zinc-400'
            }`}
            title={item.active ? 'Disable in playlist' : 'Enable in playlist'}
          >
            {item.active ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            onClick={() => onDeleteItem(item.id)}
            className="p-2 rounded-xl bg-red-950/20 border border-red-900/30 text-red-500 hover:bg-red-500 hover:text-black hover:border-red-500 transition-all cursor-pointer"
            title="Remove from playlist"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Edit options inside media card */}
      {isEditing && (
        <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 space-y-2 mt-0.5 animate-fadeIn">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Slide Duration Override
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="3"
                max="60"
                value={editedDuration}
                onChange={(e) => setEditedDuration(Number(e.target.value))}
                className="flex-1 accent-yellow-500 cursor-pointer h-1 rounded-lg bg-zinc-900"
              />
              <span className="text-xs font-mono font-bold text-yellow-500 shrink-0 w-8 text-right">
                {editedDuration}s
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlaylistCardProps {
  playlist: Playlist;
  onSelect: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete?: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onSelect,
  onToggleActive,
  onDelete
}) => {
  const slideshowItems = playlist.items.filter(item => item.active && item.type === 'image');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (slideshowItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slideshowItems.length);
    }, 3000); // Cycle every 3 seconds for direct visual slide feedback!
    return () => clearInterval(interval);
  }, [slideshowItems.length]);

  return (
    <div
      onClick={onSelect}
      className={`group glass-panel rounded-2xl p-4.5 border transition-all duration-500 flex flex-col justify-between min-h-[260px] cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(250,204,21,0.06)] hover:border-yellow-500/20 ${
        playlist.is_online 
          ? 'border-yellow-500/35 shadow-[0_0_20px_rgba(250,204,21,0.04)] bg-zinc-900/55' 
          : 'border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10'
      }`}
    >
      <div className="space-y-3.5">
        {/* Aspect Ratio Box with Auto Image Slide */}
        <div className="relative overflow-hidden aspect-[2.3/1] rounded-xl border border-zinc-950/60 bg-zinc-950/80 group-hover:border-zinc-800/80 transition-colors">
          {slideshowItems.length > 0 ? (
            slideshowItems.map((item, idx) => (
              <img
                key={item.id}
                src={item.url}
                alt={item.name}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 group-hover:scale-105 transition-transform duration-700 ${
                  idx === currentIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 to-zinc-900/50 text-zinc-600 p-3 select-none">
              <ImageIcon size={18} className="text-zinc-850 mb-1" />
              <span className="text-[8.5px] uppercase font-bold tracking-wider text-zinc-650">No active images</span>
            </div>
          )}

          {/* Dot progress indicator */}
          {slideshowItems.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {slideshowItems.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'bg-yellow-500 w-3' : 'bg-zinc-850'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Media overlay count badge */}
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 border border-zinc-800/50 backdrop-blur-sm text-[8px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1 select-none">
            <Film size={8.5} className="text-yellow-500" />
            <span>{playlist.items.length} file{playlist.items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-white text-[12.5px] truncate uppercase tracking-wider">
                  {playlist.name}
                </h3>
                {playlist.is_online && (
                  <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded-full border border-emerald-900/40 status-pulse">
                    <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Manual Toggle Switch Button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening editor!
                onToggleActive(!playlist.active);
              }}
              className={`px-2.5 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                playlist.active 
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20' 
                  : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-550 hover:text-zinc-400'
              }`}
              title={playlist.active ? 'Turn Inactive' : 'Turn Active'}
            >
              {playlist.active ? 'Active' : 'Off'}
            </button>
          </div>

          {/* Scheduling status summary text */}
          <div className="flex items-center gap-2 text-[9px] text-zinc-450 bg-zinc-950/30 px-2.5 py-1.5 rounded-xl border border-zinc-900/40 font-medium">
            <Calendar size={11} className="text-zinc-650 shrink-0" />
            <span className="truncate">
              {playlist.schedule_enabled ? (
                <>
                  {playlist.schedule_start_date} to {playlist.schedule_end_date}
                  {playlist.schedule_start_time && ` (${playlist.schedule_start_time}-${playlist.schedule_end_time})`}
                </>
              ) : (
                'Fallback manual queue'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action Links */}
      <div className="flex items-center justify-between gap-2.5 mt-3 pt-2.5 border-t border-zinc-900/50">
        <span className="flex items-center gap-1 text-[9.5px] text-yellow-500 font-extrabold uppercase tracking-wider group-hover:text-white transition-colors">
          <FolderOpen size={12} className="shrink-0" />
          <span>Manage Queue</span>
        </span>

        {onDelete ? (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent opening editor!
              onDelete();
            }}
            className="p-1.5 text-zinc-650 hover:text-red-500 rounded hover:bg-red-500/10 transition-all cursor-pointer"
            title="Delete playlist"
          >
            <Trash2 size={12} />
          </button>
        ) : (
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/40 border border-zinc-900/50 text-zinc-600 select-none"
            title="System Default Playlist (Cannot be deleted)"
          >
            <Lock size={10} className="text-zinc-500" />
            <span className="text-[8px] font-black uppercase tracking-wider">Locked</span>
          </div>
        )}
      </div>
    </div>
  );
};


// ----------------------------------------------------
// MAIN PLAYLIST MANAGER BOARD COMPONENT
// ----------------------------------------------------
export default function PlaylistManager({
  playlists,
  onPlaylistsChange,
  allUploadedMedia,
  onReloadUploadedMedia
}: PlaylistManagerProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  // Custom media visual editor modal state
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  
  // Clear selection state when switching playlists
  useEffect(() => {
    setSelectedItemIds([]);
  }, [selectedPlaylistId]);
  
  // Creation States
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // File Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Selector Drawer states (to add existing files)
  const [showMediaSelector, setShowMediaSelector] = useState(false);

  // Find currently managed playlist
  const managedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  // Duration dropdown toggle state
  const [durationDropdownOpen, setDurationDropdownOpen] = useState(false);

  // Helper function to update fields on local editingItem state
  const updateEditingField = (key: keyof MediaItem, value: any) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      [key]: value
    });
  };

  // Save the edited visual values back to the playlist database state
  const handleSaveMediaEdits = (updatedItem: MediaItem) => {
    if (!selectedPlaylistId || !managedPlaylist) return;

    const updatedItems = managedPlaylist.items.map(it => {
      if (it.id === updatedItem.id) {
        return updatedItem;
      }
      return it;
    });

    const updatedPlaylists = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return {
          ...p,
          items: updatedItems
        };
      }
      return p;
    });

    onPlaylistsChange(updatedPlaylists);
    setEditingItem(null);
  };

  // Helper for computing image styles in modal preview
  const getEditingMediaStyle = (): React.CSSProperties => {
    if (!editingItem) return {};
    const filters = [];
    if (editingItem.brightness !== undefined) filters.push(`brightness(${editingItem.brightness}%)`);
    if (editingItem.contrast !== undefined) filters.push(`contrast(${editingItem.contrast}%)`);
    if (editingItem.grayscale !== undefined) filters.push(`grayscale(${editingItem.grayscale}%)`);
    if (editingItem.blur !== undefined) filters.push(`blur(${editingItem.blur}px)`);

    const transform = editingItem.rotation ? `rotate(${editingItem.rotation}deg)` : '';

    return {
      filter: filters.join(' ') || undefined,
      transform: transform || undefined,
      transition: 'filter 0.2s ease, transform 0.2s ease',
    };
  };

  const getEditingScaleModeClass = () => {
    if (!editingItem) return '';
    switch (editingItem.scale_mode) {
      case 'contain':
        return 'object-contain';
      case 'stretch':
        return 'object-fill';
      case 'cover':
      default:
        return 'object-cover';
    }
  };

  const getEditingOverlayPositionClass = () => {
    if (!editingItem) return '';
    switch (editingItem.overlay_text_position) {
      case 'top':
        return 'top-6 left-1/2 -translate-x-1/2';
      case 'middle':
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'bottom':
      default:
        return 'bottom-6 left-1/2 -translate-x-1/2';
    }
  };

  const getEditingOverlayTextColorClass = () => {
    if (!editingItem) return '';
    switch (editingItem.overlay_text_color) {
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

  const durationOptions = [
    { value: 3, label: '3 Seconds (Fast)' },
    { value: 5, label: '5 Seconds' },
    { value: 8, label: '8 Seconds (Default)' },
    { value: 10, label: '10 Seconds' },
    { value: 15, label: '15 Seconds' },
    { value: 20, label: '20 Seconds' },
    { value: 30, label: '30 Seconds (Slower)' },
    { value: 45, label: '45 Seconds' },
    { value: 60, label: '60 Seconds (Slow)' }
  ];

  // Setup sensors for DND list
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ----------------------------------------------------
  // PLAYLIST CRUD ACTIONS
  // ----------------------------------------------------
  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;

    const newPlay: Playlist = {
      id: `playlist-${crypto.randomUUID()}`,
      name: newPlaylistName.trim(),
      active: true,
      is_online: false,
      schedule_enabled: false,
      items: [],
      created_at: new Date().toISOString(),
    };

    const updated = [...playlists, newPlay];
    onPlaylistsChange(updated);
    setNewPlaylistName('');
    setShowCreateForm(false);
    setSelectedPlaylistId(newPlay.id);
  };

  const handleDeletePlaylist = (id: string) => {
    if (id === 'default-playlist') {
      alert('Cannot delete the Default Playlist');
      return;
    }
    const updated = playlists.filter(p => p.id !== id);
    onPlaylistsChange(updated);
    if (selectedPlaylistId === id) {
      setSelectedPlaylistId(null);
    }
  };

  const handleToggleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItemIds(prev => [...prev, id]);
    } else {
      setSelectedItemIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDeleteSelectedItems = () => {
    if (!selectedPlaylistId || selectedItemIds.length === 0) return;

    if (confirm(`Are you sure you want to delete the ${selectedItemIds.length} selected item(s) from the playlist queue?`)) {
      const updated = playlists.map(p => {
        if (p.id === selectedPlaylistId) {
          return {
            ...p,
            items: p.items.filter(item => !selectedItemIds.includes(item.id))
          };
        }
        return p;
      });
      onPlaylistsChange(updated);
      setSelectedItemIds([]);
    }
  };

  const handleDeleteAssetGlobally = async (assetId: string) => {
    if (confirm("Are you sure you want to permanently delete this media file from the entire Asset Library? This will also remove it from all playlists!")) {
      try {
        await deleteMediaItem(assetId);
        
        // Remove from all local playlists
        const updatedPlaylists = playlists.map(p => ({
          ...p,
          items: p.items.filter(item => item.id !== assetId)
        }));
        onPlaylistsChange(updatedPlaylists);
        
        // Reload global library list
        await onReloadUploadedMedia();
      } catch (e) {
        console.error("Failed to delete asset globally:", e);
      }
    }
  };

  const handleTogglePlaylistActive = (id: string, active: boolean) => {
    const updated = playlists.map(p => {
      if (p.id === id) {
        return { ...p, active };
      }
      // Exclusive manual fallback: If we activate a manual fallback playlist,
      // let's deactivate all other manual playlists so that ONLY the selected one plays live online!
      if (active && !p.schedule_enabled) {
        return { ...p, active: false };
      }
      return p;
    });
    onPlaylistsChange(updated);
  };

  // ----------------------------------------------------
  // DATED SCHEDULING FORM CHANGE
  // ----------------------------------------------------
  const handleUpdateSchedule = (fields: Partial<Playlist>) => {
    if (!selectedPlaylistId) return;

    const updated = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return { ...p, ...fields };
      }
      return p;
    });
    onPlaylistsChange(updated);
  };

  // ----------------------------------------------------
  // INDIVIDUAL MEDIA ITEMS CRUD
  // ----------------------------------------------------
  const handleDeleteItem = (itemId: string) => {
    if (!selectedPlaylistId) return;

    const updated = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return {
          ...p,
          items: p.items.filter(item => item.id !== itemId)
        };
      }
      return p;
    });
    onPlaylistsChange(updated);
  };

  const handleToggleActiveItem = (itemId: string, active: boolean) => {
    if (!selectedPlaylistId) return;

    const updated = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return {
          ...p,
          items: p.items.map(item => {
            if (item.id === itemId) {
              return { ...item, active };
            }
            return item;
          })
        };
      }
      return p;
    });
    onPlaylistsChange(updated);
  };

  const handleUpdateItemDetails = (itemId: string, name: string, slideDuration: number) => {
    if (!selectedPlaylistId) return;

    const updated = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return {
          ...p,
          items: p.items.map(item => {
            if (item.id === itemId) {
              return { ...item, name, slide_duration: slideDuration };
            }
            return item;
          })
        };
      }
      return p;
    });
    onPlaylistsChange(updated);
  };

  const handleReplacePlaylistItem = (newAsset: MediaItem) => {
    if (!selectedPlaylistId || !managedPlaylist || !editingItem) return;

    const updatedItems = managedPlaylist.items.map(it => {
      if (it.id === editingItem.id) {
        return {
          ...newAsset,
          position: it.position,
          slide_duration: it.slide_duration || newAsset.slide_duration || 8
        };
      }
      return it;
    });

    const updatedPlaylists = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return {
          ...p,
          items: updatedItems
        };
      }
      return p;
    });

    onPlaylistsChange(updatedPlaylists);
    setEditingItem(null);
  };

  const handleUploadAndReplacePlaylistItem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPlaylistId || !managedPlaylist || !editingItem || !e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      const file = e.target.files[0];
      const newMedia = await uploadMediaItem(file);
      await onReloadUploadedMedia();
      handleReplacePlaylistItem(newMedia);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error replacing with uploaded file');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag End handler for sorting inside playlist
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !selectedPlaylistId || !managedPlaylist) return;

    if (active.id !== over.id) {
      const oldIndex = managedPlaylist.items.findIndex(item => item.id === active.id);
      const newIndex = managedPlaylist.items.findIndex(item => item.id === over.id);

      const reorderedItems = arrayMove(managedPlaylist.items, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        position: idx
      }));

      const updated = playlists.map(p => {
        if (p.id === selectedPlaylistId) {
          return { ...p, items: reorderedItems };
        }
        return p;
      });

      onPlaylistsChange(updated);
    }
  };

  // ----------------------------------------------------
  // BINARY MEDIA UPLOAD ACTIONS (DIRECT TO PLAYLIST)
  // ----------------------------------------------------
  const processFiles = async (files: FileList) => {
    if (!selectedPlaylistId || !managedPlaylist) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      const newUploadedItems: MediaItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate type
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
          throw new Error(`Unsupported file type: ${file.name}`);
        }

        // Upload and get seeded local/supabase media object
        const media = await uploadMediaItem(file);
        newUploadedItems.push(media);
      }

      // Append items to the currently managed playlist
      const remappedList = [...managedPlaylist.items, ...newUploadedItems].map((item, index) => ({
        ...item,
        position: index
      }));

      const updated = playlists.map(p => {
        if (p.id === selectedPlaylistId) {
          return { ...p, items: remappedList };
        }
        return p;
      });

      onPlaylistsChange(updated);
      await onReloadUploadedMedia();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error uploading files');
    } finally {
      setIsUploading(false);
    }
  };

  // File picker selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Drag drop events
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // ----------------------------------------------------
  // ATTACH EXISTING UPLOADED ASSETS
  // ----------------------------------------------------
  const handleSelectExistingAsset = (asset: MediaItem) => {
    if (!selectedPlaylistId || !managedPlaylist) return;

    // Check if asset already linked in playlist
    if (managedPlaylist.items.some(item => item.id === asset.id)) {
      alert('This file is already in your playlist');
      return;
    }

    const linkedAsset = {
      ...asset,
      position: managedPlaylist.items.length
    };

    const updated = playlists.map(p => {
      if (p.id === selectedPlaylistId) {
        return {
          ...p,
          items: [...p.items, linkedAsset]
        };
      }
      return p;
    });

    onPlaylistsChange(updated);
  };

  return (
    <div className="w-full flex flex-col gap-5">
      
      {/* ----------------------------------------------------
          STATE 1: MAIN PLAYLISTS OVERVIEW
          ---------------------------------------------------- */}
      {!selectedPlaylistId ? (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                Multi-Playlist Storage
              </span>
              <p className="text-xs text-zinc-400">Create, manage, and schedule distinct layouts</p>
            </div>
            
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500 hover:text-black border border-yellow-500/20 text-yellow-500 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Playlist</span>
            </button>
          </div>

          {/* Inline Create Form popup */}
          {showCreateForm && (
            <div className="glass-panel border-yellow-500/20 p-4 rounded-2xl flex flex-col md:flex-row gap-3.5 items-end animate-fadeIn">
              <div className="flex-1 flex flex-col gap-1.5 w-full">
                <label className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase select-none">
                  Playlist Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Promo Weekend Loop, Festive Ambience"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-900 rounded-xl px-3.5 py-2.5 outline-none focus:border-yellow-500/50 transition-all text-xs text-white"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto shrink-0">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-zinc-900 text-zinc-450 hover:bg-zinc-900/50 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List of Playlists */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onSelect={() => setSelectedPlaylistId(playlist.id)}
                onToggleActive={(active) => handleTogglePlaylistActive(playlist.id, active)}
                onDelete={playlist.id !== 'default-playlist' ? () => handleDeletePlaylist(playlist.id) : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        
        // ----------------------------------------------------
        // STATE 2: DETAILED PLAYLIST EDITING VIEW
        // ----------------------------------------------------
        <div className="space-y-5 animate-fadeIn">
          
          {/* Header & Back Navigation */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedPlaylistId(null)}
                className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-800 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {/* Inline edit of playlist name */}
                  <input
                    type="text"
                    value={managedPlaylist?.name || ''}
                    onChange={(e) => {
                      if (!managedPlaylist) return;
                      const updatedName = e.target.value;
                      const updated = playlists.map(p => {
                        if (p.id === managedPlaylist.id) {
                          return { ...p, name: updatedName };
                        }
                        return p;
                      });
                      onPlaylistsChange(updated);
                    }}
                    className="bg-transparent border-b border-transparent hover:border-zinc-800 focus:border-yellow-500/50 outline-none text-white text-base font-extrabold uppercase tracking-wide px-1"
                  />
                  
                  {managedPlaylist?.is_online && (
                    <span className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/50 status-pulse shrink-0">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Online Live
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 ml-1">
                  Playlist Queue ID: {managedPlaylist?.id.slice(0, 15)}
                </span>
              </div>
            </div>

            {/* Manual Toggle override indicator inside edit mode */}
            <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-450">Manual Flag:</span>
                <button
                  onClick={() => {
                    if (managedPlaylist) {
                      handleTogglePlaylistActive(managedPlaylist.id, !managedPlaylist.active);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest cursor-pointer transition-all ${
                    managedPlaylist?.active 
                      ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.05)]' 
                      : 'bg-zinc-950/40 border-zinc-900/60 text-zinc-550'
                  }`}
                >
                  {managedPlaylist?.active ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {managedPlaylist?.id !== 'default-playlist' && (
                <button
                  onClick={() => {
                    if (managedPlaylist && confirm(`Are you sure you want to delete "${managedPlaylist.name}"?`)) {
                      handleDeletePlaylist(managedPlaylist.id);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl border border-red-900/30 bg-red-950/20 text-red-500 hover:bg-red-500 hover:text-black hover:border-red-500 text-[10px] font-extrabold uppercase tracking-widest cursor-pointer transition-all flex items-center gap-1.5"
                  title="Delete entire playlist"
                >
                  <Trash2 size={12} />
                  <span>Delete Playlist</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid: Left Column (Schedule Controls), Right Column (Media list & Upload) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* LEFT COLUMN: GORGEOUS THEMED SCHEDULER (takes 4 columns) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="glass-panel rounded-3xl p-5 border border-zinc-900/80">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-yellow-500" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Date & Time Scheduler</span>
                  </div>
                  
                  {/* Toggle scheduler */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={managedPlaylist?.schedule_enabled || false}
                      onChange={(e) => handleUpdateSchedule({ schedule_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-zinc-950 border border-zinc-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:bg-yellow-500 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-zinc-700 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-yellow-500/10 peer-checked:border-yellow-500/30" />
                  </label>
                </div>

                {/* Scheduling Parameters */}
                {managedPlaylist?.schedule_enabled ? (
                  <div className="space-y-4.5 animate-fadeIn">
                    
                    {/* Date limits */}
                    <div className="space-y-3 p-3 rounded-2xl bg-zinc-950/30 border border-zinc-900/60">
                      <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={11} className="text-zinc-650" />
                        Active Date Range
                      </span>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] text-zinc-450 uppercase font-semibold">Start Date</label>
                          <input
                            type="date"
                            value={managedPlaylist?.schedule_start_date || ''}
                            onChange={(e) => handleUpdateSchedule({ schedule_start_date: e.target.value })}
                            className="bg-zinc-950/80 border border-zinc-900 rounded-xl text-zinc-350 px-3 py-2 outline-none focus:border-yellow-500/40 transition-all font-medium text-xs [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-65 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 hover:[&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] text-zinc-450 uppercase font-semibold">End Date</label>
                          <input
                            type="date"
                            value={managedPlaylist?.schedule_end_date || ''}
                            onChange={(e) => handleUpdateSchedule({ schedule_end_date: e.target.value })}
                            className="bg-zinc-950/80 border border-zinc-900 rounded-xl text-zinc-350 px-3 py-2 outline-none focus:border-yellow-500/40 transition-all font-medium text-xs [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-65 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 hover:[&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Time limits */}
                    <div className="space-y-3 p-3 rounded-2xl bg-zinc-950/30 border border-zinc-900/60">
                      <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={11} className="text-zinc-650" />
                        Daily Hours Range
                      </span>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] text-zinc-450 uppercase font-semibold">From Time</label>
                          <input
                            type="time"
                            value={managedPlaylist?.schedule_start_time || ''}
                            onChange={(e) => handleUpdateSchedule({ schedule_start_time: e.target.value })}
                            className="bg-zinc-950/80 border border-zinc-900 rounded-xl text-zinc-350 px-3 py-2 outline-none focus:border-yellow-500/40 transition-all font-medium text-xs [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-65 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 hover:[&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] text-zinc-450 uppercase font-semibold">To Time</label>
                          <input
                            type="time"
                            value={managedPlaylist?.schedule_end_time || ''}
                            onChange={(e) => handleUpdateSchedule({ schedule_end_time: e.target.value })}
                            className="bg-zinc-950/80 border border-zinc-900 rounded-xl text-zinc-350 px-3 py-2 outline-none focus:border-yellow-500/40 transition-all font-medium text-xs [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-65 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 hover:[&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 p-3 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 text-[10.5px] text-zinc-550 leading-relaxed">
                      <AlertCircle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                      <p>
                        This scheduled playlist will automatically override standard layouts and run online on your TV output screen when both date and time constraints are met.
                      </p>
                    </div>

                  </div>
                ) : (
                  <div className="py-8 text-center space-y-2 select-none animate-fadeIn">
                    <p className="text-xs font-semibold text-zinc-500">Scheduler is currently off</p>
                    <p className="text-[10px] text-zinc-650 max-w-[200px] mx-auto leading-relaxed">
                      This playlist will operate as a fallback queue. Turn on scheduler to customize active dates and times.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: MEDIA PLAYLIST ITEMS & UPLOAD (takes 8 columns) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Media add box & Select All toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-950/40 p-3.5 rounded-2xl border border-zinc-900/60">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={managedPlaylist && managedPlaylist.items.length > 0 && selectedItemIds.length === managedPlaylist.items.length}
                      onChange={(e) => {
                        if (e.target.checked && managedPlaylist) {
                          setSelectedItemIds(managedPlaylist.items.map(it => it.id));
                        } else {
                          setSelectedItemIds([]);
                        }
                      }}
                      className="accent-yellow-500 rounded border-zinc-800 bg-zinc-950 cursor-pointer h-3.5 w-3.5"
                    />
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      Select All ({selectedItemIds.length}/{managedPlaylist?.items.length || 0})
                    </span>
                  </label>

                  {selectedItemIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelectedItems}
                      className="flex items-center gap-1 px-3 py-1 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:text-black text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer animate-fadeIn"
                    >
                      <Trash2 size={11} />
                      <span>Delete Selected</span>
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMediaSelector(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-900 text-zinc-350 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Select Existing</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500 border border-yellow-500/20 hover:text-black text-yellow-500 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Upload New</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept="image/*,video/*"
                  />
                </div>
              </div>

              {/* Advanced Drag Drop Upload Box (only inside detail view) */}
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group border-2 border-dashed rounded-3xl p-6.5 text-center transition-all duration-300 flex flex-col items-center justify-center cursor-pointer select-none ${
                  isDraggingOver 
                    ? 'border-yellow-500 bg-yellow-500/5 shadow-[0_0_20px_rgba(250,204,21,0.05)]' 
                    : 'border-zinc-900 hover:border-zinc-850 bg-zinc-950/20 hover:bg-zinc-950/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="space-y-2 py-2">
                    <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">Processing file uploads...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-full bg-zinc-900/50 flex items-center justify-center text-zinc-500 group-hover:text-yellow-500 transition-colors mx-auto">
                      <Plus size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-300">Drag & Drop new files here</p>
                      <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-mono">
                        Images (JPG/PNG/WEBP) or Videos (MP4)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="flex gap-2.5 p-3 rounded-2xl bg-red-950/20 border border-red-900/30 text-red-500 text-xs font-semibold animate-fadeIn">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Uploaded Media Selector Drawer Overlay Modal */}
              {showMediaSelector && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                  <div className="glass-panel w-full max-w-xl max-h-[80vh] flex flex-col p-6 rounded-3xl border border-zinc-900/80 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5 mb-4 shrink-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          Asset Library
                        </span>
                        <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">
                          Attach Existing Media
                        </h3>
                      </div>
                      
                      <button
                        onClick={() => setShowMediaSelector(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
                      {allUploadedMedia.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs select-none">
                          No files uploaded yet. Drag files above to upload them first!
                        </div>
                      ) : (
                        allUploadedMedia.map((asset) => {
                          const isAlreadyLinked = managedPlaylist?.items.some(it => it.id === asset.id);
                          return (
                            <div
                              key={asset.id}
                              className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                                isAlreadyLinked 
                                  ? 'bg-zinc-950/50 border-zinc-900 opacity-40' 
                                  : 'bg-zinc-900/30 border-zinc-850/80 hover:border-yellow-500/20 hover:bg-zinc-900/50'
                              }`}
                            >
                              <div className="relative w-14 h-10 bg-black rounded-lg overflow-hidden shrink-0 border border-zinc-950">
                                {asset.type === 'video' ? (
                                  <video src={asset.url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-zinc-200 truncate">{asset.name}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
                                  {asset.type} • {asset.size > 0 ? `${(asset.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleSelectExistingAsset(asset)}
                                  disabled={isAlreadyLinked}
                                  className={`px-3 py-1.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest cursor-pointer transition-colors ${
                                    isAlreadyLinked 
                                      ? 'bg-zinc-950 border-zinc-950 text-zinc-650' 
                                      : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black'
                                  }`}
                                >
                                  {isAlreadyLinked ? 'Added' : 'Select'}
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteAssetGlobally(asset.id)}
                                  className="p-1.5 rounded-xl bg-red-950/20 border border-red-900/30 text-red-500 hover:bg-red-500 hover:text-black hover:border-red-500 transition-all cursor-pointer"
                                  title="Delete permanently from Library"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Playlist items queue list with DND sorting */}
              {managedPlaylist && managedPlaylist.items.length === 0 ? (
                <div className="py-12 border border-zinc-900 rounded-3xl text-center text-zinc-600 text-xs select-none">
                  Playlist is empty. Add or upload files above to start queuing content!
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={managedPlaylist?.items || []}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2.5">
                      {managedPlaylist?.items.map((item) => (
                        <SortablePlaylistMediaCard
                          key={item.id}
                          item={item}
                          onDeleteItem={handleDeleteItem}
                          onToggleActiveItem={handleToggleActiveItem}
                          onUpdateItemDetails={handleUpdateItemDetails}
                          isSelected={selectedItemIds.includes(item.id)}
                          onToggleSelect={handleToggleSelectItem}
                          onEditImage={setEditingItem}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

            </div>
          </div>
        </div>
      )}      {/* ----------------------------------------------------
          REPLACE MEDIA ITEM MODAL (THUMBNAIL CLICK)
          ---------------------------------------------------- */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          {/* Modal Card */}
          <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.8)] flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh] animate-scaleUp">
            
            {/* Left Column: Current Media Details & Upload New Option */}
            <div className="w-full md:w-1/2 bg-black flex flex-col justify-between relative border-r border-zinc-850 p-6 min-h-[300px] md:min-h-[450px]">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-2 block">
                  Current Playback Item
                </span>
                <h3 className="font-extrabold text-white text-lg uppercase tracking-wider mb-4">
                  Selected Item Info
                </h3>

                {/* Preview Canvas Container */}
                <div className="w-full h-48 relative overflow-hidden flex items-center justify-center rounded-2xl bg-zinc-950 border border-zinc-900 mb-4 group/preview">
                  {editingItem.type === 'video' ? (
                    <video
                      src={editingItem.url}
                      className="w-full h-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={editingItem.url}
                      alt={editingItem.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  <div className="absolute inset-0 bg-black/40 flex items-end p-3">
                    <span className="px-2 py-0.5 rounded bg-yellow-500 text-black text-[9px] font-black uppercase tracking-wider">
                      {editingItem.type}
                    </span>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-2 bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-900">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Name:</span>
                    <span className="text-zinc-200 font-bold truncate max-w-[200px]" title={editingItem.name}>
                      {editingItem.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Slot Duration:</span>
                    <span className="text-yellow-500 font-bold font-mono">
                      {editingItem.slide_duration || 8} seconds
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Type:</span>
                    <span className="text-zinc-350 font-bold uppercase font-mono">{editingItem.type}</span>
                  </div>
                </div>
              </div>

              {/* Upload New & Replace trigger */}
              <div className="mt-6 pt-4 border-t border-zinc-900">
                <input
                  type="file"
                  ref={replaceFileInputRef}
                  onChange={handleUploadAndReplacePlaylistItem}
                  className="hidden"
                  accept="image/*,video/*"
                />
                <button
                  type="button"
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest shadow-lg shadow-yellow-500/10 hover:shadow-yellow-500/20 cursor-pointer transition-all active:scale-98"
                >
                  <Plus size={14} className="stroke-[2.5]" />
                  <span>Upload & Replace</span>
                </button>
                <p className="text-[10px] text-zinc-500 text-center mt-2 uppercase tracking-wider font-medium">
                  Directly choose a new image/video from your device
                </p>
              </div>
            </div>

            {/* Right Column: Library Selector */}
            <div className="w-full md:w-1/2 flex flex-col justify-between bg-zinc-900/40 max-h-[50vh] md:max-h-[85vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-850 flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">
                    Media Library
                  </span>
                  <h3 className="font-extrabold text-white text-[13.5px] uppercase tracking-wider">
                    Select Replacement Item
                  </h3>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-850 border border-zinc-850 text-zinc-450 hover:text-white cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body: Scrollable Library Files */}
              <div className="flex-1 p-6 overflow-y-auto space-y-3.5 pr-2.5 scrollbar-thin">
                {allUploadedMedia.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-xs select-none">
                    No files found in your Asset Library.
                  </div>
                ) : (
                  allUploadedMedia.map((asset) => {
                    const isCurrent = asset.id === editingItem.id || asset.url === editingItem.url;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => !isCurrent && handleReplacePlaylistItem(asset)}
                        className={`group/asset flex items-center gap-3.5 p-3 rounded-2xl border transition-all ${
                          isCurrent 
                            ? 'bg-yellow-500/5 border-yellow-500/30 cursor-default' 
                            : 'bg-zinc-950/40 border-zinc-900/60 hover:border-yellow-500/20 hover:bg-zinc-950/80 cursor-pointer'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-16 h-12 bg-black rounded-xl overflow-hidden shrink-0 border border-zinc-900">
                          {asset.type === 'video' ? (
                            <video src={asset.url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                          )}
                          {isCurrent && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Check size={14} className="text-yellow-500" />
                            </div>
                          )}
                        </div>

                        {/* Name and specs */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isCurrent ? 'text-yellow-500' : 'text-zinc-200 group-hover/asset:text-white'}`}>
                            {asset.name}
                          </p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                            {asset.type} • {asset.size > 0 ? `${(asset.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                          </p>
                        </div>

                        {/* Choose / Current indicator */}
                        <div className="shrink-0">
                          {isCurrent ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-yellow-500 px-2 py-1 rounded bg-yellow-500/10">
                              Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplacePlaylistItem(asset);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover/asset:bg-yellow-500 group-hover/asset:border-yellow-500 group-hover/asset:text-black transition-all cursor-pointer"
                            >
                              Choose
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-950/40 flex items-center justify-end gap-3.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-2.5 rounded-xl border border-zinc-850 text-xs font-bold text-zinc-350 hover:text-white hover:bg-zinc-850 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
