"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Star,
  Trash2,
  ArrowRightLeft,
  ImageIcon,
  Camera,
  ZoomIn,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deletePhoto, setPrimaryPhoto } from "@/lib/actions/photos";
import { reclassifyAsDocument } from "@/lib/actions/photos";
import type { VehiclePhoto } from "@/types/database";

// ── Types ─────────────────────────────────────────────────

interface PhotoGalleryProps {
  photos: VehiclePhoto[];
  brand: string;
  model: string;
  vehicleId: string;
  compact?: boolean;
}

const DOC_TYPES = [
  { value: "carte_grise", label: "Carte grise", icon: "🪪" },
  { value: "controle_technique", label: "Contrôle technique", icon: "🔧" },
  { value: "facture", label: "Facture", icon: "🧾" },
  { value: "autre", label: "Autre document", icon: "📎" },
] as const;

// ── Gallery ───────────────────────────────────────────────

export function PhotoGallery({ photos: initialPhotos, brand, model, vehicleId, compact }: PhotoGalleryProps) {
  const [allPhotos, setAllPhotos] = useState(initialPhotos);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [photoFilter, setPhotoFilter] = useState<"all" | "auto1" | "local">("all");

  const photos = allPhotos.filter((p) => {
    if (photoFilter === "auto1") return p.imported_from_auto1;
    if (photoFilter === "local") return !p.imported_from_auto1;
    return true;
  });

  const auto1Count = allPhotos.filter((p) => p.imported_from_auto1).length;
  const localCount = allPhotos.length - auto1Count;

  const selected = photos[selectedIndex];
  const total = photos.length;

  const navigate = useCallback(
    (direction: -1 | 1) => {
      setSelectedIndex((prev) => {
        const next = prev + direction;
        if (next < 0) return total - 1;
        if (next >= total) return 0;
        return next;
      });
    },
    [total],
  );

  // ── Actions ──────────────────────────

  function handleSetPrimary(photoId: string) {
    startTransition(async () => {
      await setPrimaryPhoto({ vehicleId, photoId });
      setAllPhotos((prev) =>
        prev.map((p) => ({ ...p, is_primary: p.id === photoId })),
      );
    });
  }

  function handleDelete(photoId: string) {
    startTransition(async () => {
      await deletePhoto(photoId);
      setAllPhotos((prev) => {
        const next = prev.filter((p) => p.id !== photoId);
        if (selectedIndex >= next.length) setSelectedIndex(Math.max(0, next.length - 1));
        return next;
      });
    });
  }

  function handleReclassify(photoId: string, docType: string) {
    startTransition(async () => {
      await reclassifyAsDocument(photoId, docType);
      setAllPhotos((prev) => {
        const next = prev.filter((p) => p.id !== photoId);
        if (selectedIndex >= next.length) setSelectedIndex(Math.max(0, next.length - 1));
        return next;
      });
    });
  }

  // ── Empty state ─────────────────────

  if (total === 0) {
    return (
      <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-black/[0.04] bg-muted/30 ${compact ? "aspect-square" : "aspect-[16/10]"}`}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground/30">
          <Car className={compact ? "size-10" : "size-16"} strokeWidth={1} />
          <span className="text-[13px] font-medium">Aucune photo</span>
        </div>
      </div>
    );
  }

  // ── Gallery ─────────────────────────

  return (
    <div className="space-y-3">
      {/* ── Photo counter + filter tabs ── */}
      {!compact && allPhotos.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-muted-foreground">
            {allPhotos.length} photo{allPhotos.length > 1 ? "s" : ""}
            {auto1Count > 0 && ` · ${auto1Count} Auto1`}
            {localCount > 0 && ` · ${localCount} locale${localCount > 1 ? "s" : ""}`}
          </span>
          {auto1Count > 0 && localCount > 0 && (
            <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
              {(["all", "auto1", "local"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setPhotoFilter(f); setSelectedIndex(0); }}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all ${
                    photoFilter === f
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Toutes" : f === "auto1" ? "Auto1" : "Locales"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main image ── */}
      <div className="group relative overflow-hidden rounded-xl border border-black/[0.04]">
        {/* Photo counter */}
        <div className="absolute top-3 left-3 z-10">
          <div className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
            <Camera className="size-3.5" />
            {selectedIndex + 1}/{total}
          </div>
        </div>

        {/* Primary badge */}
        {selected?.is_primary && (
          <div className="absolute top-3 right-3 z-10">
            <div className="flex items-center gap-1 rounded-lg bg-brand/90 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              <Star className="size-3" fill="currentColor" />
              Principale
            </div>
          </div>
        )}

        {/* Auto1 badge */}
        {selected?.imported_from_auto1 && (
          <div className="absolute bottom-3 left-3 z-10">
            <div className="rounded-md bg-[#1A73E8]/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
              Auto1
            </div>
          </div>
        )}

        {/* Navigation arrows */}
        {total > 1 && (
          <>
            <button
              onClick={() => navigate(-1)}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 opacity-0 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => navigate(1)}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/70 opacity-0 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* Zoom button */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute right-3 bottom-3 z-10 rounded-full bg-black/40 p-2 text-white/70 opacity-0 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white group-hover:opacity-100"
        >
          <ZoomIn className="size-4" />
        </button>

        {/* Main image */}
        <img
          src={selected?.url}
          alt={`${brand} ${model} — Photo ${selectedIndex + 1}`}
          className={`w-full cursor-pointer object-cover ${compact ? "aspect-square" : "aspect-[16/10]"}`}
          onClick={() => setLightboxOpen(true)}
        />
      </div>

      {/* ── Thumbnails ── */}
      {total > 1 && (
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                className="group/thumb relative shrink-0"
              >
                {/* Thumbnail image */}
                <button
                  onClick={() => setSelectedIndex(i)}
                  className={`relative block overflow-hidden rounded-lg transition-all duration-200 ${
                    i === selectedIndex
                      ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
                      : "ring-1 ring-black/[0.06] opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={photo.url}
                    alt={`Photo ${i + 1}`}
                    className={`object-cover ${compact ? "size-[52px]" : "size-[68px]"}`}
                  />
                  {/* Primary star */}
                  {photo.is_primary && (
                    <div className="absolute bottom-0.5 left-0.5">
                      <Star className="size-3 text-brand drop-shadow-md" fill="currentColor" />
                    </div>
                  )}
                </button>

                {/* Action dropdown (on hover) */}
                <div className="absolute -top-1 -right-1 z-10 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="flex size-6 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/90"
                    >
                      <span className="text-xs font-bold">···</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
                      {!photo.is_primary && (
                        <DropdownMenuItem onClick={() => handleSetPrimary(photo.id)}>
                          <Star className="size-4 text-brand" />
                          Définir comme principale
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Reclasser en document</DropdownMenuLabel>
                        {DOC_TYPES.map((dt) => (
                          <DropdownMenuItem
                            key={dt.value}
                            onClick={() => handleReclassify(photo.id, dt.value)}
                          >
                            <span className="text-sm">{dt.icon}</span>
                            {dt.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDelete(photo.id)}
                      >
                        <Trash2 className="size-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Action bar (selected photo) ── */}
      {selected && !compact && (
        <div className="flex items-center justify-between rounded-lg border border-black/[0.04] bg-white px-4 py-2">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <ImageIcon className="size-3.5" />
            <span className="font-medium">Photo {selectedIndex + 1} sur {total}</span>
            {selected.imported_from_auto1 && (
              <Badge variant="secondary" className="text-[10px] font-semibold">Auto1</Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {!selected.is_primary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSetPrimary(selected.id)}
                disabled={isPending}
                className="h-7 gap-1.5 text-[12px] text-muted-foreground hover:text-brand"
              >
                <Star className="size-3" />
                Principale
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    className="h-7 gap-1.5 text-[12px] text-muted-foreground hover:text-[#B06000]"
                  />
                }
              >
                <ArrowRightLeft className="size-3" />
                Document
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Reclasser en document</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {DOC_TYPES.map((dt) => (
                    <DropdownMenuItem
                      key={dt.value}
                      onClick={() => handleReclassify(selected.id, dt.value)}
                    >
                      <span className="text-sm">{dt.icon}</span>
                      {dt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(selected.id)}
              disabled={isPending}
              className="h-7 gap-1.5 text-[12px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 ring-0 sm:max-w-[90vw]">
          <div className="relative flex items-center justify-center">
            {total > 1 && (
              <>
                <button
                  onClick={() => navigate(-1)}
                  className="absolute left-4 z-10 rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="absolute right-4 z-10 rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
            <img
              src={selected?.url}
              alt={`${brand} ${model}`}
              className="max-h-[85vh] max-w-full object-contain"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-3 py-1.5 text-[13px] font-medium text-white/80 backdrop-blur-md">
              {selectedIndex + 1} / {total}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
