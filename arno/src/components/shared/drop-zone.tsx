"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  file?: File | null;
  onClear?: () => void;
  compact?: boolean;
}

export function DropZone({
  onFileDrop,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  label = "Glissez un fichier ici ou cliquez pour parcourir",
  disabled = false,
  className,
  file,
  onClear,
  compact = false,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current++;
      if (e.dataTransfer.items?.length) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragOver(false);
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;
      if (disabled) return;
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        onFileDrop(droppedFile);
      }
    },
    [disabled, onFileDrop],
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) {
        onFileDrop(selected);
      }
      e.target.value = "";
    },
    [onFileDrop],
  );

  // File selected state
  if (file) {
    const isImage = /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name);
    const sizeKb = (file.size / 1024).toFixed(0);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeLabel = file.size > 1024 * 1024 ? `${sizeMb} Mo` : `${sizeKb} Ko`;

    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border border-border bg-white p-4",
          className,
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          {isImage ? (
            <ImageIcon className="size-5 text-brand" strokeWidth={2} />
          ) : (
            <FileText className="size-5 text-brand" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {file.name}
          </p>
          <p className="text-[13px] font-medium text-muted-foreground">
            {sizeLabel}
          </p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  // Drop zone state
  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200",
        isDragOver
          ? "border-brand bg-brand/5"
          : "border-[#D1D1D6] bg-background hover:border-brand/50 hover:bg-brand/[0.02]",
        disabled && "pointer-events-none opacity-50",
        compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-10",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full transition-colors",
          isDragOver ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground group-hover:text-brand",
          compact ? "size-10" : "size-12",
        )}
      >
        <Upload className={compact ? "size-5" : "size-6"} strokeWidth={2} />
      </div>
      <div className="text-center">
        <p
          className={cn(
            "font-semibold leading-snug",
            isDragOver ? "text-brand" : "text-foreground",
            compact ? "text-[14px]" : "text-[15px]",
          )}
        >
          {isDragOver ? "Déposez le fichier ici" : label}
        </p>
        <p className="mt-1 text-[13px] font-medium text-muted-foreground">
          PDF, JPG, PNG ou WebP
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
