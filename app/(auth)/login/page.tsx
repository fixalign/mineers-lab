"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signInWithEmail } from "@/lib/authService";
import { useMockData } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const session = await getSession();
      if (!session) return;
      const role = session.user.role;
      if (role === "mineers") router.replace("/admin");
      else if (role === "lab") router.replace("/lab");
    };
    void checkSession();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { user, error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    if (!user) {
      setError("Authentication failed");
      return;
    }
    const role = user.role;
    // Use window.location for full page refresh after auth
    if (role === "mineers") {
      window.location.href = "/admin";
      return;
    }
    if (role === "lab") {
      window.location.href = "/lab";
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 border rounded-lg p-6 bg-card"
      >
        <h1 className="text-xl font-semibold">Sign in</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {showHints ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Mock credentials</p>
            <p>Mineers: mineers@example.com / password</p>
            <p>Lab: lab@example.com / password</p>
            <button
              type="button"
              onClick={() => setShowHints(false)}
              className="text-primary hover:underline"
            >
              Hide
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowHints(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Show demo credentials
          </button>
        )}
        <div className="space-y-2">
          <label className="block text-sm">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border px-3 py-2 bg-background"
            placeholder="you@mineers.com"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 bg-background"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
