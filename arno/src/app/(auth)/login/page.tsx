'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/actions/auth';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className="w-full max-w-[380px] rounded-2xl bg-white p-8"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[#1A1A1A] font-bold text-white text-lg">
            A
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              Arno
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Connectez-vous à votre espace
            </p>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[13px] text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px]">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="arnaud@exemple.fr"
              autoComplete="email"
              required
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px]">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="h-10"
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="w-full h-10 bg-[#1A1A1A] text-white font-semibold hover:bg-black transition-colors"
          >
            {pending ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
