'use client';

import React, { useState, useRef, DragEvent } from 'react';
import { 
  Upload, 
  Trash2, 
  GripVertical, 
  Image as ImageIcon, 
  Film, 
  Loader2, 
  AlertCircle,
  Eye,
  EyeOff
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
import { MediaItem } from '@/lib/db';

interface MediaUploadProps {
  mediaList: MediaItem[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
}

// ----------------------------------------------------
// INDIVIDUAL SORTABLE PLAYLIST CARD COMPONENT
// ----------------------------------------------------
interface SortableItemProps {
  item: MediaItem;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
}

function SortableMediaCard({ item, onDelete, onToggleActive }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
        item.active 
          ? 'backdrop-blur-md bg-zinc-900/70 border border-zinc-800 hover:border-yellow-500/30' 
          : 'bg-zinc-950/40 border border-zinc-900/50 opacity-60 hover:opacity-80'
      }`}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-1 text-zinc-500 hover:text-yellow-500 transition-colors"
      >
        <GripVertical size={18} />
      </div>

      {/* Media Thumbnail Container */}
      <div className="relative w-16 h-12 bg-black rounded-lg overflow-hidden border border-zinc-850 flex items-center justify-center shrink-0">
        {item.type === 'video' ? (
          <>
            <video 
              src={item.url} 
              className="w-full h-full object-cover" 
              preload="metadata" 
              muted 
              playsInline 
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Film size={14} className="text-white drop-shadow-md" />
            </div>
          </>
        ) : (
          <img 
            src={item.url} 
            alt={item.name} 
            className="w-full h-full object-cover" 
          />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white truncate group-hover:text-yellow-400 transition-colors">
          {item.name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          {item.type === 'video' ? (
            <span className="text-[10px] uppercase font-bold text-yellow-500 tracking-wider flex items-center gap-1">
              <Film size={10} /> MP4
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
              <ImageIcon size={10} /> Image
            </span>
          )}
          <span className="text-[11px] text-zinc-500">•</span>
          <span className="text-[11px] text-zinc-500">{formatSize(item.size)}</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1">
        {/* Toggle Active Button */}
        <button
          onClick={() => onToggleActive(item.id, !item.active)}
          className={`p-2 rounded-lg transition-all duration-200 ${
            item.active 
              ? 'text-yellow-500 hover:bg-yellow-500/10' 
              : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'
          }`}
          title={item.active ? "Mute Playlist Output" : "Enable Playlist Output"}
        >
          {item.active ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(item.id)}
          className="p-2 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
          title="Delete Media"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// MAIN MEDIA UPLOAD COMPONENT
// ----------------------------------------------------
export default function MediaUpload({ 
  mediaList, 
  onUpload, 
  onDelete, 
  onToggleActive, 
  onReorder 
}: MediaUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance to distinguish from normal click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMsg('');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const processFiles = async (files: FileList) => {
    setUploading(true);
    const validFormats = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    
    // Check files format
    const invalidFiles = Array.from(files).filter(f => !validFormats.includes(f.type));
    if (invalidFiles.length > 0) {
      setErrorMsg('Please upload only JPG, PNG, WEBP, or MP4 files.');
      setUploading(false);
      return;
    }

    try {
      await onUpload(files);
    } catch (err) {
      console.error(err);
      setErrorMsg('Upload process failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = mediaList.findIndex(item => item.id === active.id);
      const newIndex = mediaList.findIndex(item => item.id === over.id);
      
      const reorderedList = arrayMove(mediaList, oldIndex, newIndex);
      const orderedIds = reorderedList.map(item => item.id);
      onReorder(orderedIds);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
          dragActive
            ? 'border-yellow-500 bg-yellow-500/5 shadow-inner'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.mp4"
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center py-4 space-y-2">
            <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
            <p className="text-sm font-semibold text-white">Uploading media...</p>
            <p className="text-xs text-zinc-500">Please wait, large files may take longer.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-2 py-2">
            <div className="p-3 rounded-full bg-zinc-900 text-yellow-500 border border-zinc-800 transition-transform group-hover:scale-110">
              <Upload size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Drag and Drop files here
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                or click to browse from your device
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold uppercase">JPG / PNG / WEBP</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-yellow-500 font-bold uppercase">MP4 Video</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert Message */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Playlist Sorting Manager */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            Playlist Sequence
          </span>
          <span className="text-[11px] text-zinc-500">
            {mediaList.length} items
          </span>
        </div>

        {mediaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-zinc-950/20 border border-zinc-900 text-center">
            <p className="text-sm text-zinc-500">No media available in playlist.</p>
            <p className="text-xs text-zinc-650 mt-1">Upload files using the box above.</p>
          </div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={mediaList.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {mediaList.map((item) => (
                  <SortableMediaCard 
                    key={item.id} 
                    item={item} 
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
