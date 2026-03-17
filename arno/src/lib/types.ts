// =============================================================
// Shared action result types
// =============================================================

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export type FormActionResult = { error: string } | null;
