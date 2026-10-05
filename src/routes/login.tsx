import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Mi 411" },
      { name: "description", content: "Inicia sesión en Mi 411 para ver y editar tus metas." },
      { property: "og:title", content: "Entrar — Mi 411" },
      { property: "og:description", content: "Inicia sesión en Mi 411 para ver y editar tus metas." },
    ],
  }),
  component: LoginPage,
});

const OWNER_EMAIL = "english4callcenters@gmail.com";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [canSignUp, setCanSignUp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    supabase.rpc("has_any_user").then(({ data }) => setCanSignUp(data === false));
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() !== OWNER_EMAIL) {
      toast.error("Esta app es privada. Acceso no autorizado.");
      return;
    }
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error("Correo o contraseña incorrectos");
        return;
      }
      navigate({ to: "/", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) navigate({ to: "/", replace: true });
      else {
        toast.success("Revisa tu correo para confirmar la cuenta");
        setMode("in");
      }
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/icon-192.png" alt="" width={80} height={80} className="h-20 w-20 rounded-2xl shadow-soft" />
          <h1 className="text-3xl font-bold">Mi 411</h1>
          <p className="text-muted-foreground">Tus metas, cada semana.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" autoComplete="email" required className="h-12 text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Contraseña</Label>
            <Input
              id="pw"
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              minLength={6}
              className="h-12 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? "…" : mode === "in" ? "Entrar" : "Crear cuenta"}
          </Button>
          {mode === "in" && (
            <button
              type="button"
              className="min-h-11 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={async () => {
                if (email.trim().toLowerCase() !== OWNER_EMAIL) {
                  toast.error("Escribe tu correo arriba primero");
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error("No se pudo enviar el correo. Intenta de nuevo en un minuto.");
                else toast.success("Te enviamos un correo para cambiar tu contraseña");
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {canSignUp && (
            <button
              type="button"
              className="min-h-11 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "¿Primera vez? Crear cuenta" : "Ya tengo cuenta"}
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
