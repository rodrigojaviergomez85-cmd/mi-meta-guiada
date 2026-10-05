import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Mi 411" },
      { name: "description", content: "Elige una nueva contraseña para Mi 411." },
      { property: "og:title", content: "Nueva contraseña — Mi 411" },
      { property: "og:description", content: "Elige una nueva contraseña para Mi 411." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error("No se pudo cambiar: " + error.message);
      return;
    }
    toast.success("Contraseña actualizada");
    navigate({ to: "/", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-bold">Nueva contraseña</h1>
        {!ready ? (
          <p className="text-center text-muted-foreground">
            Abre esta página desde el enlace que te llegó al correo. Si ya pasó mucho tiempo, pide otro desde la pantalla de entrar.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <div className="space-y-2">
              <Label htmlFor="pw">Nueva contraseña</Label>
              <Input id="pw" type="password" autoComplete="new-password" required minLength={6} className="h-12 text-base" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Repite la contraseña</Label>
              <Input id="pw2" type="password" autoComplete="new-password" required minLength={6} className="h-12 text-base" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
              {busy ? "…" : "Guardar contraseña"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
