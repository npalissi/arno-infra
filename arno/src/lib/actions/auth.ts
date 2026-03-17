'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';

// =============================================================
// Schemas Zod
// =============================================================

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// =============================================================
// Types
// =============================================================

type ActionResult = { error: string } | null;

// =============================================================
// signIn (raw data)
// =============================================================

export async function signIn(data: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.message };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// =============================================================
// login (useActionState compatible — prevState + FormData)
// =============================================================

export async function login(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return signIn({
    email: formData.get('email'),
    password: formData.get('password'),
  });
}

// =============================================================
// signOut
// =============================================================

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
