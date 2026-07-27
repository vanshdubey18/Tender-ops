"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type KBRow = { category: string; keywords: string };

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

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(
    searchParams.get("business")
  );
  const [step, setStep] = useState(() => {
    const s = Number(searchParams.get("step"));
    return s === 0 || s === 2 || s === 3 ? s : 1;
  });

  // Step 0 — Business details
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [bizState, setBizState] = useState("Jammu and Kashmir");
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [savingBiz, setSavingBiz] = useState(false);

  // Step 1 — Knowledge base
  const [kbRows, setKbRows] = useState<KBRow[]>([{ category: "", keywords: "" }]);
  const [savingKb, setSavingKb] = useState(false);

  // Step 2 — Telegram
  const [botToken, setBotToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  // Step 3 — Schedule
  const [sendTimes, setSendTimes] = useState<string[]>(["09:00", "17:00"]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    async function resolveBusiness() {
      let id = businessId;
      if (!id) {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.push("/login");
          return;
        }
        const { data: business } = await supabase
          .from("businesses")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (business) {
          id = business.id;
          setBusinessId(id);
        } else {
          router.push("/");
          return;
        }
      }

      const { data: biz } = await supabase
        .from("businesses")
        .select("business_name, sector, state")
        .eq("id", id)
        .maybeSingle();

      if (biz) {
        setBusinessName(biz.business_name || "");
        setSector(biz.sector || "");
        setBizState(biz.state || "Jammu and Kashmir");
      }
      setLoadingBiz(false);
    }
    resolveBusiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBusinessDetails() {
    if (!businessId) return;
    setSavingBiz(true);
    await supabase
      .from("businesses")
      .update({ business_name: businessName || "My Business", sector, state: bizState })
      .eq("id", businessId);
    setSavingBiz(false);
    setStep(1);
  }

  function updateKbRow(idx: number, field: keyof KBRow, value: string) {
    setKbRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function addKbRow() {
    setKbRows((rows) => [...rows, { category: "", keywords: "" }]);
  }
  function removeKbRow(idx: number) {
    setKbRows((rows) => rows.filter((_, i) => i !== idx));
  }

  async function saveKnowledgeBase() {
    if (!businessId) return;
    setSavingKb(true);
    const rows = kbRows
      .filter((r) => r.category.trim())
      .map((r) => ({ business_id: businessId, category: r.category, keywords: r.keywords }));

    if (rows.length > 0) {
      await supabase.from("knowledge_base").insert(rows);
    }
    setSavingKb(false);
    setStep(2);
  }

  async function connectTelegram() {
    if (!businessId || !botToken.trim()) return;
    setConnecting(true);
    setTelegramError(null);

    try {
      const res = await fetch("/api/telegram/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: botToken.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Could not confirm the bot connection.");

      const { error } = await supabase.from("telegram_links").upsert(
        {
          business_id: businessId,
          bot_token: botToken.trim(),
          telegram_chat_id: data.chatId,
          linked_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
      if (error) throw error;

      setTelegramConnected(true);
    } catch (err: any) {
      setTelegramError(err.message || "Something went wrong connecting Telegram.");
    } finally {
      setConnecting(false);
    }
  }

  function updateSendTime(idx: number, value: string) {
    setSendTimes((times) => times.map((t, i) => (i === idx ? value : t)));
  }
  function addSendTime() {
    setSendTimes((times) => [...times, "12:00"]);
  }
  function removeSendTime(idx: number) {
    setSendTimes((times) => times.filter((_, i) => i !== idx));
  }

  async function finishSetup() {
    if (!businessId) return;
    setSavingSchedule(true);
    const { error } = await supabase.from("alert_schedules").upsert(
      {
        business_id: businessId,
        send_times: sendTimes,
        timezone: "Asia/Kolkata",
        active: true,
      },
      { onConflict: "business_id" }
    );
    setSavingSchedule(false);
    if (!error) {
      router.push(`/dashboard?business=${businessId}`);
    }
  }

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="eyebrow">Est. for the AI First Hackathon · Vol. I</div>
        <h1>TenderOps</h1>
        <p className="tagline">Complete your filing to activate the daily agent.</p>
      </header>

      <div className="step-indicator">
        <span className={step === 0 ? "step-active" : step > 0 ? "step-done" : ""}>
          0. Business
        </span>
        <span className={step === 1 ? "step-active" : step > 1 ? "step-done" : ""}>
          1. Goods &amp; Services
        </span>
        <span className={step === 2 ? "step-active" : step > 2 ? "step-done" : ""}>
          2. Telegram
        </span>
        <span className={step === 3 ? "step-active" : ""}>3. Schedule</span>
      </div>

      {step === 0 && (
        <div className="filing">
          <div className="section-label">Business Particulars</div>
          <p className="tagline-body">
            Update your business name, sector, and priority state at any time.
          </p>

          {loadingBiz ? (
            <p className="tagline-body">Loading...</p>
          ) : (
            <>
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
                  <label htmlFor="bizState">Priority State</label>
                  <select
                    id="bizState"
                    value={bizState}
                    onChange={(e) => setBizState(e.target.value)}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <button className="submit-btn" onClick={saveBusinessDetails} disabled={savingBiz}>
                  {savingBiz ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="filing">
          <div className="section-label">Schedule of Goods &amp; Services</div>
          <p className="tagline-body">
            List what your business sells or supplies. The agent scores each tender against
            these categories.
          </p>

          <div className="kb-list">
            {kbRows.map((row, idx) => (
              <div className="kb-row" key={idx}>
                <div className="field">
                  <label>Category</label>
                  <input
                    value={row.category}
                    onChange={(e) => updateKbRow(idx, "category", e.target.value)}
                    placeholder="e.g. Medical Imaging Equipment"
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <label>Keywords</label>
                  <input
                    value={row.keywords}
                    onChange={(e) => updateKbRow(idx, "keywords", e.target.value)}
                    placeholder="e.g. X-ray, ultrasound, MRI"
                    autoComplete="off"
                  />
                </div>
                {kbRows.length > 1 && (
                  <button type="button" className="kb-remove" onClick={() => removeKbRow(idx)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="kb-add" onClick={addKbRow}>
            + Add another category
          </button>

          <div>
            <button className="submit-btn" onClick={saveKnowledgeBase} disabled={savingKb}>
              {savingKb ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="filing">
          <div className="section-label">Connect Telegram</div>

          <div className="instruction-box">
            <div className="instruction-title">New to Telegram bots? Here's how to get a token:</div>
            <ol>
              <li>
                Open Telegram and search for <strong>@BotFather</strong> (the official bot
                that creates other bots).
              </li>
              <li>
                Send the command <code>/newbot</code> and follow the prompts — pick a name
                and a username ending in "bot" (e.g. <code>mybusiness_tenders_bot</code>).
              </li>
              <li>
                BotFather replies with a token that looks like{" "}
                <code>123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>. Copy it.
              </li>
              <li>Paste that token below.</li>
            </ol>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="botToken">Bot Token</label>
              <input
                id="botToken"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          {!telegramConnected ? (
            <>
              <p className="tagline-body">
                After saving your token, open your new bot in Telegram and send{" "}
                <code>/start</code> — then click Connect below.
              </p>
              <div>
                <button className="submit-btn" onClick={connectTelegram} disabled={connecting}>
                  {connecting ? "Checking for /start..." : "Connect"}
                </button>
              </div>
              {telegramError && <div className="error-note">{telegramError}</div>}
            </>
          ) : (
            <div className="success-note">Telegram connected. You'll receive alerts here.</div>
          )}

          <div style={{ marginTop: 20 }}>
            <button type="button" className="kb-add" onClick={() => setStep(3)}>
              {telegramConnected ? "Continue" : "Skip for now"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="filing">
          <div className="section-label">Sitting Times — When Should the Agent Run</div>
          <p className="tagline-body">
            Choose when the agent checks for new tenders and sends alerts, in IST.
          </p>

          <div className="kb-list">
            {sendTimes.map((t, idx) => (
              <div className="kb-row" key={idx}>
                <div className="field">
                  <label>Time</label>
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => updateSendTime(idx, e.target.value)}
                  />
                </div>
                {sendTimes.length > 1 && (
                  <button type="button" className="kb-remove" onClick={() => removeSendTime(idx)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="kb-add" onClick={addSendTime}>
            + Add another time
          </button>

          <div>
            <button className="submit-btn" onClick={finishSetup} disabled={savingSchedule}>
              {savingSchedule ? "Finishing..." : "Finish setup"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="wrap" />}>
      <OnboardingInner />
    </Suspense>
  );
}
