"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrquestraLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const accessDenied =
    status === "authenticated" &&
    Boolean(session?.user) &&
    sessionRole !== "SUPER_ADMIN";

  useEffect(() => {
    if (status === "authenticated" && sessionRole === "SUPER_ADMIN") {
      router.push("/admin/tenants");
    }
  }, [router, sessionRole, status]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Credenciais inválidas");
      setLoading(false);
      return;
    }

    // Session will update via useSession, useEffect handles redirect
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-emerald-950 to-gray-950">
      <Card className="w-full max-w-md border-emerald-800/50 bg-gray-900/90 backdrop-blur shadow-2xl shadow-emerald-900/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <span className="text-2xl font-bold text-white">J</span>
          </div>
          <CardTitle className="text-2xl text-white">Orquestra</CardTitle>
          <CardDescription className="text-emerald-400/70">
            Painel Administrativo LicitaIA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="admin@licitai.com"
                className="border-emerald-800/50 bg-gray-800 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="********"
                className="border-emerald-800/50 bg-gray-800 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            {(error || accessDenied) && (
              <p className="text-sm text-red-400 bg-red-950/30 rounded px-3 py-2 border border-red-800/30">
                {error || "Acesso restrito a administradores"}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || status === "loading"}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20"
            >
              {loading ? "Autenticando..." : "Entrar como Admin"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-600">
            Acesso restrito — SUPER_ADMIN
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
