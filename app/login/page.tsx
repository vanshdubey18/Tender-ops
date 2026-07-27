"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="eyebrow">Est. for the AI First Hackathon · Vol. I</div>
        <h1>TenderOps</h1>
        <p className="tagline">Return to your account.</p>
      </header>

      <form className="filing" onSubmit={handleSubmit}>
        <div className="section-label">Credentials</div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>

        {error && <div className="error-note">{error}</div>}

        <p className="tagline-body" style={{ marginTop: 20 }}>
          New here? <a href="/" style={{ textDecoration: "underline" }}>Register your business</a>.
        </p>
      </form>
    </div>
  );
}
