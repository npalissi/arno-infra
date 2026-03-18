"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Pencil,
  Calendar,
  Gauge,
  Fuel,
  Cog,
  Palette,
  Hash,
  FileText,
  StickyNote,
  Clock,
  ShoppingCart,
  CircleDollarSign,
  ExternalLink,
  Globe,
  Plus,
  Trash2,
  Paperclip,
  Upload,
  X,
  Receipt,
  History,
  TrendingUp,
  ShoppingCart as CartIcon,
  Tag,
  Wrench,
  Search,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  CarFront,
  MapPin,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropZone } from "@/components/shared/drop-zone";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { useToast } from "@/components/shared/toast";
import { PhotoGallery } from "@/components/vehicles/photo-gallery";
import {
  formatPrice,
  formatDate,
  formatMileage,
  daysInStock,
} from "@/lib/format";
import { addListing, deleteListing } from "@/lib/actions/listings";
import { createExpense, updateExpense, deleteExpense } from "@/lib/actions/expenses";
import { updateExpenseCategories } from "@/lib/actions/settings";
import { uploadDocument, updateDocument, deleteDocument } from "@/lib/actions/documents";
import { getVehicleValuation, saveValuation, getLastValuation } from "@/lib/actions/valuation";
import type { MarketValuation } from "@/lib/leboncoin/types";
import type {
  Vehicle,
  VehiclePhoto,
  VehicleExpense,
  VehicleDocument,
  VehicleHistory,
  VehicleListing,
  VehicleStatus,
} from "@/types/database";

// ── Types ───────────────────────────────────────────────────

type VehicleDetailData = Vehicle & {
  photos: VehiclePhoto[];
  total_expenses: number;
};

interface VehicleDetailClientProps {
  vehicle: VehicleDetailData;
  expenses: VehicleExpense[];
  documents: VehicleDocument[];
  history: VehicleHistory[];
  listings: VehicleListing[];
  expenseCategories: string[];
  documentTypes: string[];
}

// ── Timeline config ─────────────────────────────────────────

const timelineActionConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  achat: { icon: CartIcon, color: "bg-[#1A73E8]", label: "Achat" },
  vente: { icon: Tag, color: "bg-[#1E8E3E]", label: "Vente" },
  changement_status: { icon: Clock, color: "bg-[#B06000]", label: "Changement de statut" },
  ajout_frais: { icon: Wrench, color: "bg-[#DE5E36]", label: "Frais ajouté" },
  modification_frais: { icon: Wrench, color: "bg-[#DE5E36]", label: "Frais modifié" },
  suppression_frais: { icon: Wrench, color: "bg-[#DC2626]", label: "Frais supprimé" },
  ajout_document: { icon: FileText, color: "bg-[#5F6368]", label: "Document ajouté" },
};

// ── Platform config ─────────────────────────────────────────

const PLATFORMS = [
  { value: "leboncoin", label: "Leboncoin" },
  { value: "lacentrale", label: "La Centrale" },
  { value: "autoscout24", label: "AutoScout24" },
  { value: "paruvendu", label: "ParuVendu" },
  { value: "facebook", label: "Facebook Marketplace" },
  { value: "autre", label: "Autre" },
] as const;

function getPlatformLabel(value: string): string {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

// ── Components ──────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="text-[14px] font-medium text-muted-foreground">{label}</span>
      <span className="ml-auto text-[14px] font-semibold font-mono text-foreground tabular-nums">
        {value || "—"}
      </span>
    </div>
  );
}

function FinancialLine({
  label,
  value,
  variant,
  bold,
}: {
  label: string;
  value: string;
  variant?: "positive" | "destructive" | "default";
  bold?: boolean;
}) {
  const colorClass =
    variant === "positive"
      ? "text-positive"
      : variant === "destructive"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[14px] font-medium text-muted-foreground">{label}</span>
      <span
        className={`text-[14px] font-mono tabular-nums ${bold ? "font-bold" : "font-semibold"} ${colorClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function ExpenseDialog({
  vehicleId,
  expense,
  open,
  onOpenChange,
  onSave,
  categories,
}: {
  vehicleId: string;
  expense?: VehicleExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (e: VehicleExpense) => void;
  categories: string[];
}) {
  const isEdit = !!expense;
  const [category, setCategory] = useState(expense?.category ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount / 100) : "");
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().split("T")[0]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [localCategories, setLocalCategories] = useState(categories);

  function handleCategoryChange(value: string | null) {
    if (!value) return;
    if (value === "__new__") {
      setAddingNewCategory(true);
      setNewCategoryName("");
    } else {
      setCategory(value);
      setAddingNewCategory(false);
    }
  }

  async function confirmNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    if (localCategories.includes(name)) {
      setCategory(name);
      setAddingNewCategory(false);
      return;
    }
    const updated = [...localCategories, name];
    setLocalCategories(updated);
    setCategory(name);
    setAddingNewCategory(false);
    // Persist in background
    await updateExpenseCategories(updated);
  }

  async function uploadInvoice(): Promise<string | null> {
    if (!invoiceFile) return null;
    const formData = new FormData();
    formData.append("file", invoiceFile);
    formData.append("vehicleId", vehicleId);
    const res = await fetch("/api/upload-invoice", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erreur upload facture");
    return data.url;
  }

  async function handleSubmit() {
    if (!category || !amount || !date) return;
    setLoading(true);
    setError(null);

    try {
      let invoiceUrl: string | null | undefined;
      if (invoiceFile) {
        invoiceUrl = await uploadInvoice();
      }

      const amountCents = Math.round(parseFloat(amount) * 100);

      if (isEdit) {
        const updateData: Record<string, unknown> = {
          category,
          description: description || null,
          amount: amountCents,
          date,
        };
        if (invoiceUrl !== undefined) updateData.invoice_url = invoiceUrl;
        const result = await updateExpense(expense.id, updateData);
        if (result.error) { setError(result.error); return; }
        if (result.data) { onSave(result.data); onOpenChange(false); }
      } else {
        const result = await createExpense({
          vehicle_id: vehicleId,
          category,
          description: description || null,
          amount: amountCents,
          date,
          invoice_url: invoiceUrl ?? null,
        });
        if (result.error) { setError(result.error); return; }
        if (result.data) { onSave(result.data); onOpenChange(false); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  const invoicePreviewUrl = invoiceFile ? URL.createObjectURL(invoiceFile) : null;
  const isInvoiceImage = invoiceFile ? invoiceFile.type.startsWith("image/") : false;
  const isInvoicePdf = invoiceFile ? invoiceFile.type === "application/pdf" : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={invoiceFile ? "sm:max-w-3xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold">
            {isEdit ? "Modifier le frais" : "Ajouter un frais"}
          </DialogTitle>
        </DialogHeader>

        <div className={invoiceFile ? "flex flex-col gap-6 sm:flex-row" : ""}>
          {/* Invoice preview — left column when file selected */}
          {invoiceFile && (
            <div className="flex shrink-0 flex-col gap-3 sm:w-[260px]">
              <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                {isInvoiceImage ? (
                  <img
                    src={invoicePreviewUrl!}
                    alt={invoiceFile.name}
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : isInvoicePdf ? (
                  <iframe
                    src={invoicePreviewUrl!}
                    title={invoiceFile.name}
                    className="aspect-[3/4] w-full border-0"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                      <FileText className="size-7" strokeWidth={1.75} />
                    </div>
                    <p className="text-[14px] font-semibold text-foreground">Fichier</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {invoiceFile.name}
                  </p>
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {invoiceFile.size > 1024 * 1024
                      ? `${(invoiceFile.size / (1024 * 1024)).toFixed(1)} Mo`
                      : `${(invoiceFile.size / 1024).toFixed(0)} Ko`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceFile(null)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Form — right column (or full width when no file) */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-muted-foreground">Catégorie</label>
              {addingNewCategory ? (
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nom de la nouvelle catégorie..."
                    className="h-10 flex-1 rounded-[10px] text-[14px]"
                    onKeyDown={(e) => e.key === "Enter" && confirmNewCategory()}
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={confirmNewCategory}
                    disabled={!newCategoryName.trim()}
                    className="h-10 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                  >
                    OK
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingNewCategory(false)}
                    className="h-10"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Select value={category} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="h-10 rounded-[10px] text-[14px]">
                    <SelectValue placeholder="Choisir une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {localCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-brand font-semibold">
                      + Nouvelle catégorie
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-muted-foreground">Description (optionnel)</label>
              <Input
                type="text"
                placeholder="Détails du frais..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-10 rounded-[10px] text-[14px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-muted-foreground">Montant (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="150.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10 rounded-[10px] text-[14px] font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 rounded-[10px] text-[14px]"
                />
              </div>
            </div>
            {!invoiceFile && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-muted-foreground">Facture (optionnel)</label>
                <DropZone
                  onFileDrop={(f) => setInvoiceFile(f)}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  label={isEdit && expense.invoice_url ? "Remplacer la facture" : "Glissez une facture ici"}
                  compact
                />
              </div>
            )}
            {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!category || !amount || !date || loading}
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            {loading ? "..." : isEdit ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesSection({
  expenses: initialExpenses,
  vehicleId,
  totalExpenses,
  categories,
}: {
  expenses: VehicleExpense[];
  vehicleId: string;
  totalExpenses: number;
  categories: string[];
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<VehicleExpense | undefined>(undefined);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string> | null>(null);

  const allCategories = useMemo(
    () => [...new Set(expenses.map((e) => e.category))],
    [expenses],
  );

  // Initialize filters when categories change (e.g. after add/delete)
  const currentFilters = activeFilters ?? new Set(allCategories);
  const allActive = allCategories.every((c) => currentFilters.has(c));

  const filteredExpenses = expenses.filter((e) => currentFilters.has(e.category));
  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const isFiltered = !allActive;

  function toggleFilter(cat: string) {
    const next = new Set(currentFilters);
    if (next.has(cat)) {
      next.delete(cat);
      if (next.size === 0) {
        // Don't allow empty — reset to all
        setActiveFilters(null);
        return;
      }
    } else {
      next.add(cat);
    }
    setActiveFilters(next);
  }

  function selectAll() {
    setActiveFilters(null);
  }

  function countForCategory(cat: string) {
    return expenses.filter((e) => e.category === cat).length;
  }

  function openAddDialog() {
    setEditingExpense(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(expense: VehicleExpense) {
    setEditingExpense(expense);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    const result = await deleteExpense(id);
    if (!result.error) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  }

  async function handleRemoveInvoice(expense: VehicleExpense) {
    const result = await updateExpense(expense.id, { invoice_url: null });
    if (!result.error && result.data) {
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? result.data! : e)));
    }
  }

  async function handleUploadInvoice(expenseId: string, file: File) {
    setUploadingInvoiceId(expenseId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("vehicleId", vehicleId);
      const res = await fetch("/api/upload-invoice", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) return;
      const result = await updateExpense(expenseId, { invoice_url: data.url });
      if (!result.error && result.data) {
        setExpenses((prev) => prev.map((e) => (e.id === expenseId ? result.data! : e)));
      }
    } finally {
      setUploadingInvoiceId(null);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[16px] font-semibold tracking-tight">Frais</CardTitle>
          <button
            onClick={openAddDialog}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#1A1A1A] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-black"
          >
            <Plus className="size-3.5" />
            Ajouter un frais
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Expense Dialog */}
        <ExpenseDialog
          key={editingExpense?.id ?? "new"}
          vehicleId={vehicleId}
          expense={editingExpense}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          categories={categories}
          onSave={(saved) => {
            if (editingExpense) {
              setExpenses((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
            } else {
              setExpenses((prev) => [saved, ...prev]);
            }
          }}
        />

        {/* Filter bar */}
        {expenses.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={allActive}
                onChange={selectAll}
                className="size-4 rounded border-border accent-foreground"
              />
              <span className="text-[13px] font-semibold">
                Tous <span className="text-muted-foreground">({expenses.length})</span>
              </span>
            </label>
            {allCategories.map((cat) => (
              <label key={cat} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentFilters.has(cat)}
                  onChange={() => toggleFilter(cat)}
                  className="size-4 rounded border-border accent-foreground"
                />
                <span className="text-[13px] font-semibold capitalize">
                  {cat} <span className="text-muted-foreground">({countForCategory(cat)})</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Expenses list */}
        {expenses.length > 0 ? (
          <div className="space-y-2">
            {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="group/expense flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="space-y-0.5">
                      <p className="text-[14px] font-semibold">{expense.category}</p>
                      {expense.description && (
                        <p className="text-[13px] text-muted-foreground">{expense.description}</p>
                      )}
                    </div>
                    {/* Invoice: show link + remove, or upload button */}
                    {expense.invoice_url ? (
                      <div className="flex items-center gap-0.5">
                        <a
                          href={expense.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md p-1.5 text-[#1A73E8] transition-colors hover:bg-[#E8F0FE]"
                          title="Voir la facture"
                        >
                          <Paperclip className="size-4" />
                        </a>
                        <button
                          onClick={() => handleRemoveInvoice(expense)}
                          className="rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover/expense:opacity-100"
                          title="Supprimer la facture"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:text-[#1A73E8] group-hover/expense:opacity-100"
                        title="Ajouter une facture"
                      >
                        <Upload className="size-4" />
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadInvoice(expense.id, f);
                          }}
                          disabled={uploadingInvoiceId === expense.id}
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[14px] font-mono font-bold tabular-nums">{formatPrice(expense.amount)}</p>
                      <p className="text-[12px] font-mono font-medium text-muted-foreground tabular-nums">{formatDate(expense.date)}</p>
                    </div>
                    <button
                      onClick={() => openEditDialog(expense)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-[#E8F0FE] hover:text-[#1A73E8] group-hover/expense:opacity-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/expense:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
            ))}
            <Separator className="bg-border" />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[14px] font-semibold">
                Total frais{isFiltered && <span className="ml-1 text-[12px] font-medium text-muted-foreground">(filtré)</span>}
              </span>
              <span className="text-[14px] font-mono font-bold tabular-nums text-brand">
                {formatPrice(filteredTotal)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Receipt className="size-10 text-muted-foreground/15 mb-3" strokeWidth={1} />
            <p className="text-[14px] font-semibold text-muted-foreground">Aucun frais enregistré</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Cliquez sur « Ajouter un frais » pour commencer.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ListingsTab({
  listings: initialListings,
  vehicleId,
}: {
  listings: VehicleListing[];
  vehicleId: string;
}) {
  const [listings, setListings] = useState(initialListings);
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!platform || !url) return;
    setLoading(true);
    setError(null);
    const result = await addListing({ vehicle_id: vehicleId, platform, url });
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setListings((prev) => [result.data!, ...prev]);
      setPlatform("");
      setUrl("");
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const result = await deleteListing(id);
    if (result.error) {
      setError(result.error);
    } else {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }
  }

  return (
    <Card className="border-border">
      <CardContent className="pt-4">
        {/* Add form */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[13px] font-semibold text-muted-foreground">Plateforme</label>
            <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[2] space-y-1.5">
            <label className="text-[13px] font-semibold text-muted-foreground">URL de l&apos;annonce</label>
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!platform || !url || loading}
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>

        {error && (
          <p className="mt-2 text-[12px] text-destructive">{error}</p>
        )}

        {/* Listings list */}
        {listings.length > 0 ? (
          <div className="mt-4 space-y-2">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[14px] font-semibold">
                      {getPlatformLabel(listing.platform)}
                    </p>
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[13px] font-medium text-[#1A73E8] hover:text-[#1A73E8]/80 transition-colors truncate"
                    >
                      {listing.url}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[12px] font-medium text-muted-foreground/60">
                    {formatDate(listing.created_at)}
                  </span>
                  <button
                    onClick={() => handleDelete(listing.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Globe className="size-10 text-muted-foreground/15 mb-3" strokeWidth={1} />
            <p className="text-[14px] font-semibold text-muted-foreground">Aucune annonce</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Ajoutez un lien vers vos annonces en ligne.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Documents Tab ──────────────────────────────────────────

function formatDocTypeLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function DocumentsTab({
  documents: initialDocuments,
  vehicleId,
  documentTypes,
}: {
  documents: VehicleDocument[];
  vehicleId: string;
  documentTypes: string[];
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("autre");
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("autre");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<VehicleDocument | null>(null);

  function handleFileDrop(file: File) {
    setDocFile(file);
    // Pre-fill name with filename without extension
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    setDocName(nameWithoutExt);
    setDocType("autre");
    setDialogOpen(true);
  }

  async function handleUpload() {
    if (!docFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", docFile);
    fd.append("name", docName || docFile.name);
    fd.append("type", docType);
    const res = await uploadDocument(vehicleId, fd);
    if (res.data) {
      setDocs((prev) => [res.data!, ...prev]);
      setDialogOpen(false);
      setDocName("");
      setDocType("autre");
      setDocFile(null);
    }
    setUploading(false);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setDocFile(null);
    setDocName("");
    setDocType("autre");
  }

  async function handleDelete(id: string) {
    const res = await deleteDocument(id);
    if (!res.error) {
      setDocs((prev) => prev.filter((d) => d.id !== id));
    }
  }

  function startEdit(doc: VehicleDocument) {
    setEditingId(doc.id);
    setEditName(doc.name);
    setEditType(doc.type);
  }

  async function handleUpdate(id: string) {
    const res = await updateDocument(id, { name: editName, type: editType });
    if (res.data) {
      setDocs((prev) => prev.map((d) => (d.id === id ? res.data! : d)));
      setEditingId(null);
    }
  }

  return (
    <>
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-[16px] font-semibold tracking-tight">Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Drop zone */}
        <DropZone
          onFileDrop={handleFileDrop}
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          label="Glissez un document ici ou cliquez pour parcourir"
          className="mb-4"
        />

        {/* Upload dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold">Ajouter un document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {docFile && (
                <div className="flex items-center gap-3 rounded-[10px] border border-border bg-muted/30 px-4 py-3">
                  <FileText className="size-5 shrink-0 text-brand" strokeWidth={2} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{docFile.name}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-muted-foreground">Nom du document</label>
                <Input
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Ex: Carte grise"
                  className="h-10 text-[14px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-muted-foreground">Type de document</label>
                <Select value={docType} onValueChange={(v) => v && setDocType(v)}>
                  <SelectTrigger className="h-10 text-[14px]">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((dt) => (
                      <SelectItem key={dt} value={dt}>{formatDocTypeLabel(dt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose} disabled={uploading}>
                Annuler
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!docFile || uploading}
                className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
              >
                {uploading ? "Upload..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Documents grid */}
        {docs.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {docs.map((doc) => {
              const isImage = /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(doc.file_url) || doc.file_url.includes('/vehicle-photos/');
              const isPdf = /\.pdf$/i.test(doc.file_url) || doc.file_url.includes('.pdf');
              const isEditing = editingId === doc.id;

              if (isEditing) {
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col overflow-hidden rounded-xl border-2 border-brand/30 bg-muted/20 p-2.5 space-y-2"
                  >
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-[13px]"
                      placeholder="Nom"
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-[13px] font-medium outline-none"
                    >
                      {documentTypes.map((dt) => (
                        <option key={dt} value={dt}>{formatDocTypeLabel(dt)}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 flex-1 text-[12px]" onClick={() => handleUpdate(doc.id)}>
                        OK
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 flex-1 text-[12px]" onClick={() => setEditingId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={doc.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-muted/20 transition-all hover:shadow-md hover:border-border"
                >
                  {/* Action buttons */}
                  <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(doc)}
                      className="flex size-7 items-center justify-center rounded-lg bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="flex size-7 items-center justify-center rounded-lg bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </button>
                  </div>
                  {/* Preview */}
                  <button
                    type="button"
                    onClick={() => setViewingDoc(doc)}
                    className="relative aspect-[4/3] w-full overflow-hidden bg-muted/40 cursor-pointer"
                  >
                    {isImage ? (
                      <img
                        src={doc.file_url}
                        alt={doc.name}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : isPdf ? (
                      <iframe
                        src={`${doc.file_url}#toolbar=0&navpanes=0&scrollbar=0`}
                        title={doc.name}
                        className="size-full border-0 pointer-events-none"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <FileText className="size-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                      <ExternalLink className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                  {/* Info */}
                  <div className="flex flex-col gap-0.5 p-2.5">
                    <p className="truncate text-[13px] font-semibold">{doc.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">{doc.type}</span>
                      <span className="text-[12px] font-medium text-muted-foreground">{formatDate(doc.uploaded_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <FileText className="size-10 text-muted-foreground/15 mb-3" strokeWidth={1} />
            <p className="text-[14px] font-semibold text-muted-foreground">Aucun document</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Glissez un fichier ici ou cliquez pour en ajouter.</p>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Document viewer dialog */}
    <Dialog open={!!viewingDoc} onOpenChange={(open) => { if (!open) setViewingDoc(null); }}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-[18px] font-semibold flex items-center gap-3">
            <FileText className="size-5 text-brand" />
            {viewingDoc?.name}
          </DialogTitle>
          <p className="text-[13px] font-medium text-muted-foreground">
            {viewingDoc?.type} — {viewingDoc ? formatDate(viewingDoc.uploaded_at) : ""}
          </p>
        </DialogHeader>
        <div className="flex-1 min-h-0 px-6 pb-6">
          {viewingDoc && (/\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(viewingDoc.file_url) ? (
            <img
              src={viewingDoc.file_url}
              alt={viewingDoc.name}
              className="size-full object-contain rounded-xl"
            />
          ) : (
            <iframe
              src={viewingDoc.file_url}
              title={viewingDoc.name}
              className="size-full rounded-xl border border-border"
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ── Main ────────────────────────────────────────────────────

export function VehicleDetailClient({
  vehicle,
  expenses,
  documents,
  history,
  listings,
  expenseCategories,
  documentTypes,
}: VehicleDetailClientProps) {
  const totalCost = vehicle.purchase_price + vehicle.total_expenses;
  const grossMargin = vehicle.sale_price
    ? vehicle.sale_price - vehicle.purchase_price - vehicle.total_expenses
    : vehicle.target_sale_price
      ? vehicle.target_sale_price -
        vehicle.purchase_price -
        vehicle.total_expenses
      : null;
  const tva = grossMargin !== null ? Math.round((grossMargin * 20) / 120) : null;
  const netMargin = grossMargin !== null && tva !== null ? grossMargin - tva : null;
  const saleRef = vehicle.sale_price || vehicle.target_sale_price || 0;
  const marginPercent =
    netMargin !== null && saleRef > 0
      ? ((netMargin / saleRef) * 100).toFixed(1)
      : null;
  const marginVariant =
    grossMargin !== null
      ? grossMargin >= 0
        ? "positive"
        : "destructive"
      : "default";
  const days = daysInStock(vehicle.purchase_date);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-[24px] font-bold tracking-tight">
              {vehicle.brand} {vehicle.model}
            </h2>
            {vehicle.sub_type && (
              <p className="text-[14px] font-medium text-muted-foreground mt-0.5">
                {vehicle.sub_type}
              </p>
            )}
          </div>
          <StatusBadge status={vehicle.status} />
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/vehicles/${vehicle.id}/edit`} />}
          className="border-border"
        >
          <Pencil className="size-4" />
          Modifier
        </Button>
      </div>

      {/* Top section — Photo compact + Info + Financial — all above fold */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
        {/* Photo compact */}
        <div className="space-y-2">
          <PhotoGallery
            photos={vehicle.photos}
            brand={vehicle.brand}
            model={vehicle.model}
            vehicleId={vehicle.id}
            compact
          />
        </div>

        {/* Vehicle information */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[16px] font-semibold tracking-tight">Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div>
                <InfoRow icon={Calendar} label="Année" value={String(vehicle.year)} />
                <InfoRow icon={Gauge} label="Kilométrage" value={formatMileage(vehicle.mileage)} />
                <InfoRow icon={Fuel} label="Carburant" value={vehicle.fuel_type} />
                <InfoRow icon={Cog} label="Boîte" value={vehicle.gearbox} />
                <InfoRow icon={Palette} label="Couleur" value={vehicle.color} />
              </div>
              <div>
                <InfoRow icon={Hash} label="VIN" value={vehicle.vin} />
                <InfoRow icon={FileText} label="Immatriculation" value={vehicle.registration} />
                <InfoRow icon={Calendar} label="Date d'achat" value={formatDate(vehicle.purchase_date)} />
                <InfoRow icon={ShoppingCart} label="Source" value={vehicle.purchase_source} />
                <InfoRow icon={Clock} label="En stock" value={`${days} jour${days > 1 ? "s" : ""}`} />
              </div>
            </div>
            {vehicle.purchase_notes && (
              <>
                <Separator className="my-3 bg-border" />
                <div className="flex gap-3">
                  <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                    {vehicle.purchase_notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Financial summary */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
              <CircleDollarSign className="size-4 text-brand" />
              Résumé financier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <FinancialLine
              label="Prix d'achat"
              value={formatPrice(vehicle.purchase_price)}
            />
            <FinancialLine
              label="Total frais"
              value={formatPrice(vehicle.total_expenses)}
            />
            <Separator className="my-2 bg-border" />
            <FinancialLine
              label="Coût total"
              value={formatPrice(totalCost)}
              bold
            />
            {vehicle.target_sale_price && (
              <FinancialLine
                label="Prix vente souhaité"
                value={formatPrice(vehicle.target_sale_price)}
              />
            )}
            {vehicle.sale_price && (
              <FinancialLine
                label="Prix vente réel"
                value={formatPrice(vehicle.sale_price)}
              />
            )}

            {grossMargin !== null && (
              <>
                <Separator className="my-2 bg-border" />
                <FinancialLine
                  label="Marge brute"
                  value={formatPrice(grossMargin)}
                  variant={marginVariant as "positive" | "destructive"}
                  bold
                />
                {tva !== null && (
                  <FinancialLine
                    label="TVA sur marge (20/120)"
                    value={`- ${formatPrice(tva)}`}
                  />
                )}
                {netMargin !== null && (
                  <FinancialLine
                    label="Marge nette"
                    value={formatPrice(netMargin)}
                    variant={marginVariant as "positive" | "destructive"}
                    bold
                  />
                )}
                {marginPercent !== null && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="text-[13px] font-semibold text-muted-foreground">% Marge</span>
                    <span className={`text-xl font-mono font-bold tabular-nums ${marginVariant === "positive" ? "text-positive" : "text-destructive"}`}>
                      {marginPercent}%
                    </span>
                  </div>
                )}
              </>
            )}

            {!vehicle.sale_price && vehicle.target_sale_price && (
              <p className="pt-2 text-[12px] font-medium text-muted-foreground italic">
                * Calcul basé sur le prix de vente souhaité
              </p>
            )}
          </CardContent>
        </Card>

        {/* Prix recommandé — only for unsold vehicles */}
        {!vehicle.sale_price && (
          <RecommendedPriceCard
            totalCost={totalCost}
            targetSalePrice={vehicle.target_sale_price}
          />
        )}

        {/* Sale simulator — only for unsold vehicles */}
        {!vehicle.sale_price && (
          <SaleSimulatorCard
            totalCost={totalCost}
            purchaseDate={vehicle.purchase_date}
          />
        )}

        {/* Cote Marché Leboncoin — only for unsold vehicles */}
        {!vehicle.sale_price && (
          <MarketValuationCard
            vehicleId={vehicle.id}
            targetSalePrice={vehicle.target_sale_price}
            brand={vehicle.brand}
            model={vehicle.model}
          />
        )}
      </div>

      {/* Frais section — always visible */}
      <ExpensesSection
        expenses={expenses}
        vehicleId={vehicle.id}
        totalExpenses={vehicle.total_expenses}
        categories={expenseCategories}
      />

      {/* Tabs: Documents / Historique / Annonces */}
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="listings">Annonces</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentsTab vehicleId={vehicle.id} documents={documents} documentTypes={documentTypes} />
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-border">
            <CardContent className="pt-4">
              {history.length > 0 ? (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-border" />
                  {history.map((entry) => {
                    const config = timelineActionConfig[entry.action] ?? { icon: Clock, color: "bg-muted-foreground", label: entry.action };
                    const Icon = config.icon;
                    return (
                      <div key={entry.id} className="relative flex gap-4 pb-5 last:pb-0">
                        <div className={`relative z-10 mt-0.5 flex size-[30px] shrink-0 items-center justify-center rounded-full ${config.color}`}>
                          <Icon className="size-3.5 text-white" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 space-y-0.5 pt-0.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[14px] font-semibold">{config.label}</p>
                            <span className="shrink-0 text-[11px] font-mono font-medium text-muted-foreground tabular-nums">
                              {formatDate(entry.date)}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-[13px] text-muted-foreground">{entry.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <History className="size-10 text-muted-foreground/15 mb-3" strokeWidth={1} />
                  <p className="text-[14px] font-semibold text-muted-foreground">Aucun historique</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">Les actions sur ce véhicule apparaîtront ici.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings">
          <ListingsTab listings={listings} vehicleId={vehicle.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Recommended Price Card ─────────────────────────────────

function RecommendedPriceCard({
  totalCost,
  targetSalePrice,
}: {
  totalCost: number;
  targetSalePrice: number | null;
}) {
  const [marginTarget, setMarginTarget] = useState(15);

  // Prix recommandé = coût total / (1 - marge% / 100)
  // But with TVA on margin: we need the sale price such that net margin = target%
  // net margin = gross - tva, gross = sale - cost, tva = gross * 20/120
  // net = gross - gross*20/120 = gross * 100/120
  // we want net/sale = target/100
  // gross * 100/120 / sale = target/100
  // (sale - cost) * 100/120 / sale = target/100
  // Solving: sale = cost / (1 - target * 120 / (100 * 100))
  // = cost / (1 - target * 1.2 / 100)
  const divisor = 1 - (marginTarget * 1.2) / 100;
  const recommendedPrice = divisor > 0 ? Math.round(totalCost / divisor) : 0;

  // Projected margins
  const projectedGross = recommendedPrice - totalCost;
  const projectedTva = projectedGross > 0 ? Math.round((projectedGross * 20) / 120) : 0;
  const projectedNet = projectedGross - projectedTva;
  const projectedPercent = recommendedPrice > 0 ? ((projectedNet / recommendedPrice) * 100).toFixed(1) : "0";

  // Compare with target sale price
  const comparison = targetSalePrice
    ? targetSalePrice >= recommendedPrice ? "above" : "below"
    : null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          <TrendingUp className="size-4 text-brand" />
          Prix recommandé
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Recommended price */}
        <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Prix de vente suggéré
          </p>
          <p className="text-[28px] font-mono font-bold tracking-tight tabular-nums text-foreground">
            {formatPrice(recommendedPrice)}
          </p>
        </div>

        {/* Projected margins */}
        <div className="space-y-1">
          <FinancialLine label="Marge nette projetée" value={formatPrice(projectedNet)} variant="positive" bold />
          <FinancialLine label="% Marge nette" value={`${projectedPercent}%`} variant="positive" />
        </div>

        {/* Comparison with target */}
        {comparison && targetSalePrice && (
          <div className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${
            comparison === "above"
              ? "bg-positive/10 text-positive"
              : "bg-destructive/10 text-destructive"
          }`}>
            {comparison === "above"
              ? `Prix affiché ${formatPrice(targetSalePrice)} > recommandé`
              : `Prix affiché ${formatPrice(targetSalePrice)} < recommandé — marge insuffisante`}
          </div>
        )}

        {/* Margin slider */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-muted-foreground">
              Objectif marge nette
            </label>
            <span className="text-[14px] font-mono font-bold tabular-nums">{marginTarget}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={marginTarget}
            onChange={(e) => setMarginTarget(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-brand bg-muted"
          />
          <div className="flex justify-between text-[11px] font-medium text-muted-foreground tabular-nums">
            <span>5%</span>
            <span>30%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sale Simulator Card ────────────────────────────────────

function SaleSimulatorCard({
  totalCost,
  purchaseDate,
}: {
  totalCost: number;
  purchaseDate: string;
}) {
  const [salePriceEuros, setSalePriceEuros] = useState("");

  const salePriceCentimes = salePriceEuros ? Math.round(parseFloat(salePriceEuros) * 100) : null;
  const daysHeld = Math.ceil((Date.now() - new Date(purchaseDate).getTime()) / 86400000);

  const grossMargin = salePriceCentimes !== null ? salePriceCentimes - totalCost : null;
  const tva = grossMargin !== null && grossMargin > 0 ? Math.round((grossMargin * 20) / 120) : 0;
  const netMargin = grossMargin !== null ? grossMargin - tva : null;
  const marginPercent = salePriceCentimes && netMargin !== null && salePriceCentimes > 0
    ? ((netMargin / salePriceCentimes) * 100).toFixed(1)
    : null;
  const profitPerDay = netMargin !== null && daysHeld > 0
    ? Math.round(netMargin / daysHeld)
    : null;

  const variant = netMargin !== null && netMargin >= 0 ? "positive" : "destructive";

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          <CircleDollarSign className="size-4 text-brand" />
          Simulateur de vente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Price input */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-semibold text-muted-foreground">
            Prix de vente simulé (€)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="22 000"
            value={salePriceEuros}
            onChange={(e) => setSalePriceEuros(e.target.value)}
            className="h-10 font-mono tabular-nums text-[15px]"
          />
        </div>

        {/* Results */}
        {salePriceCentimes !== null && grossMargin !== null && netMargin !== null && (
          <div className="space-y-1 rounded-xl bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">Marge brute</span>
              <span className={`text-[14px] font-mono font-semibold tabular-nums ${variant === "positive" ? "text-positive" : "text-destructive"}`}>
                {formatPrice(grossMargin)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">TVA sur marge</span>
              <span className="text-[14px] font-mono font-medium tabular-nums text-muted-foreground">
                - {formatPrice(tva)}
              </span>
            </div>
            <Separator className="my-1.5 bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Marge nette</span>
              <span className={`text-[16px] font-mono font-bold tabular-nums ${variant === "positive" ? "text-positive" : "text-destructive"}`}>
                {formatPrice(netMargin)}
              </span>
            </div>
            {marginPercent && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted-foreground">% Marge</span>
                <span className={`text-[14px] font-mono font-bold tabular-nums ${variant === "positive" ? "text-positive" : "text-destructive"}`}>
                  {marginPercent}%
                </span>
              </div>
            )}
            {profitPerDay !== null && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[13px] font-medium text-muted-foreground">Profit/jour ({daysHeld}j)</span>
                <span className={`text-[13px] font-mono font-semibold tabular-nums ${variant === "positive" ? "text-positive" : "text-destructive"}`}>
                  {formatPrice(profitPerDay)}/j
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Market Valuation Card ──────────────────────────────────

function MarketValuationCard({
  vehicleId,
  targetSalePrice,
  brand,
  model,
}: {
  vehicleId: string;
  targetSalePrice: number | null;
  brand: string;
  model: string;
}) {
  const [valuation, setValuation] = useState<MarketValuation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchValuation() {
    setLoading(true);
    setError(null);
    const result = await getVehicleValuation(vehicleId);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setValuation(result.data);
    }
    setLoading(false);
  }

  // Auto-fetch on mount
  useEffect(() => {
    fetchValuation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  // Build Leboncoin search URL
  const lbcSearchUrl = valuation
    ? `https://www.leboncoin.fr/recherche?category=2&text=${encodeURIComponent(`${brand} ${model}`)}`
    : null;

  // Comparison with target price
  const delta = targetSalePrice && valuation
    ? targetSalePrice - valuation.medianPrice * 100 // medianPrice is in euros, target is centimes
    : null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          <Search className="size-4 text-brand" />
          Cote Marché Leboncoin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="space-y-3">
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertTriangle className="size-8 text-muted-foreground/30" strokeWidth={1.5} />
            <p className="text-[13px] font-semibold text-muted-foreground">Cote indisponible</p>
            <p className="text-[12px] text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchValuation}
              className="mt-1 gap-1.5 text-[12px]"
            >
              <RefreshCw className="size-3" />
              Réessayer
            </Button>
          </div>
        )}

        {valuation && !loading && (
          <MarketValuationContent
            valuation={valuation}
            delta={delta}
            lbcSearchUrl={lbcSearchUrl}
            loading={loading}
            onRefresh={fetchValuation}
            vehicleId={vehicleId}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Haversine distance (km) ─────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeStats(prices: number[]) {
  if (prices.length === 0) return { median: 0, p25: 0, p75: 0, min: 0, max: 0 };
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  return { median, p25, p75, min: sorted[0], max: sorted[sorted.length - 1] };
}

// ── Market Valuation Content ────────────────────────────────

function MarketValuationContent({
  valuation,
  delta,
  lbcSearchUrl,
  loading,
  onRefresh,
  vehicleId,
}: {
  valuation: MarketValuation;
  delta: number | null;
  lbcSearchUrl: string | null;
  loading: boolean;
  onRefresh: () => void;
  vehicleId: string;
}) {
  const [adsOpen, setAdsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();

  // Fetch last saved valuation on mount
  useEffect(() => {
    getLastValuation(vehicleId).then((result) => {
      if (result.data?.created_at) {
        setLastSavedAt(result.data.created_at);
      }
    });
  }, [vehicleId]);

  // Geo filter state
  const [geoCity, setGeoCity] = useState("");
  const [geoRadius, setGeoRadius] = useState(100);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const fmtEur = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  // Compute distances if geo is active
  const adsWithDistance = useMemo(() => {
    return valuation.ads.map((ad) => {
      const dist = geoCoords && ad.lat && ad.lng
        ? Math.round(haversineKm(geoCoords.lat, geoCoords.lng, ad.lat, ad.lng))
        : null;
      return { ...ad, distance: dist };
    });
  }, [valuation.ads, geoCoords]);

  // Filtered ads by geo
  const geoFilteredAds = useMemo(() => {
    if (!geoCoords) return adsWithDistance;
    return adsWithDistance.filter((ad) => ad.distance !== null && ad.distance <= geoRadius);
  }, [adsWithDistance, geoCoords, geoRadius]);

  // Local stats
  const localStats = useMemo(() => {
    if (!geoCoords || geoFilteredAds.length === 0) return null;
    return computeStats(geoFilteredAds.map((a) => a.price));
  }, [geoCoords, geoFilteredAds]);

  const sortedAds = [...(geoCoords ? geoFilteredAds : adsWithDistance)].sort((a, b) => a.price - b.price);
  const visibleAds = showAll ? sortedAds : sortedAds.slice(0, 20);
  const hasMore = sortedAds.length > 20 && !showAll;

  async function handleGeoFilter() {
    if (!geoCity.trim()) return;
    setGeoLoading(true);
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(geoCity)}&limit=1`);
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        const label = data.features[0].properties.city || data.features[0].properties.label || geoCity;
        setGeoCoords({ lat, lng, label });
        setShowAll(false);
      }
    } catch {
      // silently fail
    }
    setGeoLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const geo = geoCoords ? { lat: geoCoords.lat, lng: geoCoords.lng, radiusKm: geoRadius, label: geoCoords.label } : undefined;
    const result = await saveValuation(vehicleId, valuation, geo);
    if (result.error) {
      toastError(result.error);
    } else {
      toastSuccess("Cote enregistrée");
      setLastSavedAt(new Date().toISOString());
    }
    setSaving(false);
  }

  return (
    <>
      {/* Median price */}
      <div className="rounded-xl bg-muted/50 px-4 py-3 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Prix médian
        </p>
        <p className="text-[28px] font-mono font-bold tracking-tight tabular-nums text-foreground">
          {fmtEur(valuation.medianPrice)}
        </p>
      </div>

      {/* Comparison: national vs local */}
      {localStats && geoCoords && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted/30 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">France</p>
            <p className="text-[15px] font-mono font-bold tabular-nums">{fmtEur(valuation.medianPrice)}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{valuation.totalAds} ann.</p>
          </div>
          <div className="rounded-lg bg-brand/5 border border-brand/20 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">{geoCoords.label} {geoRadius}km</p>
            <p className="text-[15px] font-mono font-bold tabular-nums">{fmtEur(localStats.median)}</p>
            <p className="text-[10px] font-medium text-muted-foreground">{geoFilteredAds.length} ann.</p>
          </div>
        </div>
      )}

      {/* P25 — P75 fourchette */}
      <div className="flex items-center justify-between text-[13px] font-semibold">
        <span className="text-muted-foreground">Fourchette</span>
        <span className="font-mono tabular-nums">{fmtEur(valuation.p25)} — {fmtEur(valuation.p75)}</span>
      </div>

      {/* Min — Max (smaller) */}
      <div className="flex items-center justify-between text-[12px] font-medium text-muted-foreground">
        <span>Min {fmtEur(valuation.minPrice)}</span>
        <span className="text-border">—</span>
        <span>Max {fmtEur(valuation.maxPrice)}</span>
      </div>

      {/* Ad count */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">
          {valuation.totalAds} annonce{valuation.totalAds > 1 ? "s" : ""} analysée{valuation.totalAds > 1 ? "s" : ""}
          {valuation.totalExcluded > 0 && (
            <span className="text-[12px]"> ({valuation.totalExcluded} exclue{valuation.totalExcluded > 1 ? "s" : ""})</span>
          )}
        </span>
        {lbcSearchUrl && (
          <a href={lbcSearchUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:text-brand/80 transition-colors">
            Voir sur LBC <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {/* Comparison badge */}
      {delta !== null && (
        <div className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${
          delta >= 0 ? "bg-positive/10 text-positive" : "bg-destructive/10 text-destructive"
        }`}>
          {delta >= 0
            ? `Au-dessus du marché (+${formatPrice(delta)})`
            : `En-dessous du marché (${formatPrice(delta)})`}
        </div>
      )}

      {/* Geo filter section */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <MapPin className="size-3.5 text-brand" />
          Cote locale
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Ville ou code postal"
            value={geoCity}
            onChange={(e) => setGeoCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGeoFilter()}
            className="h-8 text-[12px] flex-1"
          />
          <select
            value={geoRadius}
            onChange={(e) => { setGeoRadius(Number(e.target.value)); if (geoCoords) setShowAll(false); }}
            className="h-8 rounded-[8px] border border-border bg-white px-2 text-[12px] font-medium"
          >
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
            <option value={200}>200 km</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGeoFilter} disabled={geoLoading || !geoCity.trim()}
            className="h-7 gap-1 text-[11px] bg-primary text-primary-foreground">
            {geoLoading ? <RefreshCw className="size-3 animate-spin" /> : <MapPin className="size-3" />}
            Filtrer
          </Button>
          {geoCoords && (
            <Button size="sm" variant="ghost" onClick={() => { setGeoCoords(null); setShowAll(false); }}
              className="h-7 text-[11px] text-muted-foreground">
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="flex-1 gap-1.5 text-[12px]">
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="flex-1 gap-1.5 text-[12px]">
          <Save className={`size-3 ${saving ? "animate-pulse" : ""}`} />
          {saving ? "..." : "Enregistrer"}
        </Button>
      </div>

      {/* Last saved date */}
      {lastSavedAt && (
        <p className="text-[11px] font-medium text-muted-foreground text-center">
          Dernière cote : {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedAt))}
        </p>
      )}

      {/* Ads accordion */}
      {sortedAds.length > 0 && (
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setAdsOpen(!adsOpen)}
            className="flex w-full items-center justify-between py-1 text-[13px] font-semibold text-foreground transition-colors hover:text-brand"
          >
            <span>Voir les {sortedAds.length} annonces{geoCoords ? ` (${geoCoords.label} ${geoRadius}km)` : ""}</span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${adsOpen ? "rotate-180" : ""}`} />
          </button>

          {adsOpen && (
            <div className="mt-3 space-y-2">
              {visibleAds.map((ad, idx) => {
                const priceColor = ad.price > valuation.medianPrice * 1.05
                  ? "text-destructive"
                  : ad.price < valuation.medianPrice * 0.95
                    ? "text-positive"
                    : "text-foreground";

                return (
                  <div key={`${ad.id}-${idx}`} className="flex items-center gap-3 rounded-xl border border-border bg-white p-2.5 transition-colors hover:bg-muted/30">
                    <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {ad.image ? (
                        <img src={ad.image} alt={ad.title} className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <CarFront className="size-6 text-muted-foreground/20" strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{ad.title}</p>
                      <p className={`text-[14px] font-mono font-bold tabular-nums ${priceColor}`}>
                        {fmtEur(ad.price)}
                      </p>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {[
                          ad.mileage ? `${new Intl.NumberFormat("fr-FR").format(ad.mileage)} km` : null,
                          ad.year ? String(ad.year) : null,
                          ad.distance !== null && ad.distance !== undefined
                            ? `${ad.location ?? ""} (${ad.distance} km)`
                            : ad.location ?? null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <a href={ad.url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand/10">
                      Voir
                    </a>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full rounded-xl border border-dashed border-border py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                >
                  Voir les {sortedAds.length - 20} annonces restantes
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
