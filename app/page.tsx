"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";

const INDIAN_STATES = [
  "Jammu and Kashmir",
  "Andhra Pradesh",
  "Delhi",
  "Karnataka",
  "Maharashtra",
  "Punjab",
  "Uttar Pradesh",
  "West Bengal",
  "Other",
];

export default function SignUpPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [state, setState] = useState("Jammu and Kashmir");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("tenderops2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let userId: string | null = null;
      let session = null;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        // If this email already has an account, just try logging in with the
        // same credentials instead of blocking the person out.
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw authError; // report the original signup error
        userId = loginData.user?.id || null;
        session = loginData.session;
      } else {
        if (!authData.session || !authData.user) {
          setNeedsConfirmation(true);
          setLoading(false);
          return;
        }
        userId = authData.user.id;
        session = authData.session;
      }

      if (!userId) throw new Error("Could not resolve a user for this account.");

      // Reuse an existing business profile for this account if one already exists.
      const { data: existingBiz } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      let businessId = existingBiz?.id;

      if (!businessId) {
        const { data: business, error: businessError } = await supabase
          .from("businesses")
          .insert({
            user_id: userId,
            business_name: businessName || "My Business",
            sector,
            state,
          })
          .select()
          .single();

        if (businessError) throw businessError;
        businessId = business.id;
      }

      router.push(`/onboarding?business=${businessId}`);
    } catch (err: any) {
      setError(err.message || "Registration could not be completed.");
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="wrap">
        <header className="masthead">
          <div className="eyebrow">Est. for the AI First Hackathon · Vol. I</div>
          <h1>TenderOps</h1>
        </header>
        <div className="filing">
          <div className="section-label">Registration Pending</div>
          <p className="tagline-body">
            A confirmation link has been sent to <strong>{email}</strong>. Confirm your
            address, then return here and{" "}
            <a href="/login" style={{ textDecoration: "underline" }}>
              sign in
            </a>{" "}
            to continue setting up your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="eyebrow">Est. for the AI First Hackathon · Vol. I</div>
        <h1>TenderOps</h1>
        <p className="tagline">
          Register your business and let an agent read the day's government bids on your
          behalf.
        </p>
      </header>

      <form className="filing" onSubmit={handleSignUp}>
        <div className="section-label">Registration — Account Particulars</div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
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
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
        </div>

        <div className="section-label">Registration — Business Particulars</div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="businessName">Business Name</label>
            <input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Techno Med Services"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="sector">Sector</label>
            <input
              id="sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g. Medical Equipment Distribution"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="state">Priority State</label>
            <select id="state" value={state} onChange={(e) => setState(e.target.value)}>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Filing registration..." : "Register"}
          </button>
        </div>

        {error && <div className="error-note">{error}</div>}

        <p className="tagline-body" style={{ marginTop: 20 }}>
          Already registered?{" "}
          <a href="/login" style={{ textDecoration: "underline" }}>
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
