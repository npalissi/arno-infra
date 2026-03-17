"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getSettings,
  updateExpenseCategories,
  updateDocumentTypes,
} from "@/lib/actions/settings";

export default function SettingsPage() {
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newDocType, setNewDocType] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCategories, setSavingCategories] = useState(false);
  const [savingDocTypes, setSavingDocTypes] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const settings = await getSettings();
      setExpenseCategories(settings.expense_categories);
      setDocumentTypes(settings.document_types);
      setLoading(false);
    }
    load();
  }, []);

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  // ── Expense categories ────────────────────────────

  async function addCategory() {
    const value = newCategory.trim();
    if (!value || expenseCategories.includes(value)) return;
    const updated = [...expenseCategories, value];
    setExpenseCategories(updated);
    setNewCategory("");
    setSavingCategories(true);
    const result = await updateExpenseCategories(updated);
    setSavingCategories(false);
    if (result) {
      showMessage("error", result.error);
    } else {
      showMessage("success", "Catégorie ajoutée");
    }
  }

  async function removeCategory(cat: string) {
    if (cat.toLowerCase() === "autre") return;
    const updated = expenseCategories.filter((c) => c !== cat);
    setExpenseCategories(updated);
    setSavingCategories(true);
    const result = await updateExpenseCategories(updated);
    setSavingCategories(false);
    if (result) {
      showMessage("error", result.error);
    } else {
      showMessage("success", "Catégorie supprimée");
    }
  }

  // ── Document types ────────────────────────────────

  async function addDocType() {
    const value = newDocType.trim().toLowerCase().replace(/\s+/g, "_");
    if (!value || documentTypes.includes(value)) return;
    const updated = [...documentTypes, value];
    setDocumentTypes(updated);
    setNewDocType("");
    setSavingDocTypes(true);
    const result = await updateDocumentTypes(updated);
    setSavingDocTypes(false);
    if (result) {
      showMessage("error", result.error);
    } else {
      showMessage("success", "Type ajouté");
    }
  }

  async function removeDocType(dt: string) {
    if (dt === "autre") return;
    const updated = documentTypes.filter((t) => t !== dt);
    setDocumentTypes(updated);
    setSavingDocTypes(true);
    const result = await updateDocumentTypes(updated);
    setSavingDocTypes(false);
    if (result) {
      showMessage("error", result.error);
    } else {
      showMessage("success", "Type supprimé");
    }
  }

  function formatDocTypeLabel(value: string): string {
    return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[14px] font-medium text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-[24px] font-bold tracking-tight">Paramètres</h2>

      {/* Feedback message */}
      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-[14px] font-medium ${
            message.type === "success"
              ? "border-positive/30 bg-positive/5 text-positive"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Expense categories */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-[16px] font-semibold tracking-tight">
            Catégories de frais
          </CardTitle>
          <p className="text-[14px] font-medium text-muted-foreground">
            Définissez les catégories disponibles lors de l&apos;ajout de frais.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tags list */}
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((cat) => (
              <div
                key={cat}
                className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5"
              >
                <span className="text-[14px] font-medium text-foreground">{cat}</span>
                {cat.toLowerCase() !== "autre" ? (
                  <button
                    onClick={() => removeCategory(cat)}
                    disabled={savingCategories}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <span className="text-[12px] font-medium text-muted-foreground">(requis)</span>
                )}
              </div>
            ))}
          </div>

          {/* Add input */}
          <div className="flex gap-3">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Nouvelle catégorie..."
              className="h-10 max-w-xs rounded-[10px] text-[14px]"
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <Button
              onClick={addCategory}
              disabled={!newCategory.trim() || savingCategories}
              className="h-10 gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>

          <p className="text-[13px] font-medium text-muted-foreground">
            La catégorie &quot;Autre&quot; ne peut pas être supprimée.
          </p>
        </CardContent>
      </Card>

      {/* Document types */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-[16px] font-semibold tracking-tight">
            Types de documents
          </CardTitle>
          <p className="text-[14px] font-medium text-muted-foreground">
            Définissez les types disponibles lors de l&apos;upload de documents.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tags list */}
          <div className="flex flex-wrap gap-2">
            {documentTypes.map((dt) => (
              <div
                key={dt}
                className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5"
              >
                <span className="text-[14px] font-medium text-foreground">
                  {formatDocTypeLabel(dt)}
                </span>
                {dt !== "autre" ? (
                  <button
                    onClick={() => removeDocType(dt)}
                    disabled={savingDocTypes}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <span className="text-[12px] font-medium text-muted-foreground">(requis)</span>
                )}
              </div>
            ))}
          </div>

          {/* Add input */}
          <div className="flex gap-3">
            <Input
              value={newDocType}
              onChange={(e) => setNewDocType(e.target.value)}
              placeholder="Nouveau type..."
              className="h-10 max-w-xs rounded-[10px] text-[14px]"
              onKeyDown={(e) => e.key === "Enter" && addDocType()}
            />
            <Button
              onClick={addDocType}
              disabled={!newDocType.trim() || savingDocTypes}
              className="h-10 gap-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Ajouter
            </Button>
          </div>

          <p className="text-[13px] font-medium text-muted-foreground">
            Le type &quot;Autre&quot; ne peut pas être supprimé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
