"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type Match = {
  id: string;
  relevance_score: number;
  relevance_reasoning: string;
  should_alert: boolean;
  created_at: string;
  tenders: {
    bid_number: string;
    title: string;
    ministry: string;
    location: string;
    bid_end_date: string;
    emd_required: boolean | null;
    is_jammu_kashmir: boolean | null;
    bid_url: string;
  };
};

type KBRow = { id: string; category: string; keywords: string };
type TelegramLink = { telegram_chat_id: string | null; linked_at: string | null };
type Schedule = { send_times: string[]; active: boolean };
type Business = { business_name: string; sector: string; state: string };
type Tab = "overview" | "knowledge" | "cases";

function verdictFor(m: Match): { label: string; colorVar: string } {
  const score = m.relevance_score ?? 0;
  if (m.should_alert && score >= 60) return { label: "STRONG MATCH", colorVar: "#3f6b4f" };
  if (m.should_alert) return { label: "FOR REVIEW", colorVar: "#b98a32" };
  return { label: "LOW PRIORITY", colorVar: "#8891a3" };
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(searchParams.get("business"));
  const [business, setBusiness] = useState<Business | null>(null);
  const [kbRows, setKbRows] = useState<KBRow[]>([]);
  const [telegramLink, setTelegramLink] = useState<TelegramLink | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [phraseIdx, setPhraseIdx] = useState(0);

  const scanPhrases = [
    "Dispatching the agent to the registry...",
    "Reading government bid listings...",
    "Matching against your knowledge base...",
    "Stamping the strong matches...",
  ];

  useEffect(() => {
    if (!scanning) return;
    setPhraseIdx(0);
    const interval = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % scanPhrases.length);
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  useEffect(() => {
    async function init() {
      let id = businessId;

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setError(`Auth error: ${authError.message}`);
        setLoading(false);
        return;
      }
      if (!userData.user && !id) {
        router.push("/login");
        return;
      }

      if (!id) {
        const { data: biz, error: bizError } = await supabase
          .from("businesses")
          .select("id, business_name, sector, state")
          .eq("user_id", userData.user!.id)
          .maybeSingle();

        if (bizError) {
          setError(`Database error: ${bizError.message}`);
          setLoading(false);
          return;
        }
        if (!biz) {
          setError("Signed in, but no business profile was found for this account yet.");
          setLoading(false);
          return;
        }
        id = biz.id;
        setBusinessId(id);
        setBusiness({ business_name: biz.business_name, sector: biz.sector, state: biz.state });
      } else {
        const { data: biz, error: bizError } = await supabase
          .from("businesses")
          .select("business_name, sector, state")
          .eq("id", id)
          .maybeSingle();
        if (bizError) {
          setError(`Database error: ${bizError.message}`);
          setLoading(false);
          return;
        }
        if (biz) setBusiness(biz);
      }

      const [kbRes, linkRes, scheduleRes] = await Promise.all([
        supabase.from("knowledge_base").select("id, category, keywords").eq("business_id", id),
        supabase
          .from("telegram_links")
          .select("telegram_chat_id, linked_at")
          .eq("business_id", id)
          .maybeSingle(),
        supabase
          .from("alert_schedules")
          .select("send_times, active")
          .eq("business_id", id)
          .maybeSingle(),
      ]);

      setKbRows(kbRes.data || []);
      setTelegramLink(linkRes.data || null);
      setSchedule(scheduleRes.data || null);

      await loadMatches(id!);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMatches(id: string) {
    const { data } = await supabase
      .from("tender_matches")
      .select(
        "id, relevance_score, relevance_reasoning, should_alert, created_at, tenders(bid_number,title,ministry,location,bid_end_date,emd_required,is_jammu_kashmir,bid_url)"
      )
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    setMatches((data as any) || []);
  }

  async function runScanNow() {
    if (!businessId) return;
    setScanning(true);
    setError(null);
    setScanLog("Generating sample tender matches...");
    setTab("overview");

    try {
      const res = await fetch("/api/scan/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, sendTelegramNow: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The scan could not be completed.");

      await loadMatches(businessId);
      setScanLog("");
      setTab("cases");
    } catch (err: any) {
      setError(err.message || "Something went wrong running the scan.");
      setScanLog("");
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="wrap">
        <header className="masthead">
          <h1>TenderOps</h1>
        </header>
        {error && <div className="error-note" style={{ marginTop: 24 }}>{error}</div>}
      </div>
    );
  }

  const strongMatches = matches.filter((m) => m.should_alert && (m.relevance_score ?? 0) >= 60).length;
  const jkMatches = matches.filter((m) => m.tenders?.is_jammu_kashmir).length;
  const telegramConnected = !!telegramLink?.telegram_chat_id;

  return (
    <div className="dash-shell">
      {/* ---------- Sidebar ---------- */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-eyebrow">AI First Hackathon</div>
          <div className="sidebar-title">TenderOps</div>
        </div>

        <div className="sidebar-business">
          <span>Filing for</span>
          <strong>{business?.business_name || "your business"}</strong>
        </div>

        <nav className="sidebar-nav">
          <button
            className={tab === "overview" ? "sidebar-link active" : "sidebar-link"}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            className={tab === "knowledge" ? "sidebar-link active" : "sidebar-link"}
            onClick={() => setTab("knowledge")}
          >
            Knowledge Base
            <span className="sidebar-badge">{kbRows.length}</span>
          </button>
          <button
            className={tab === "cases" ? "sidebar-link active" : "sidebar-link"}
            onClick={() => setTab("cases")}
          >
            Case Files
            <span className="sidebar-badge">{matches.length}</span>
          </button>
          <a href={`/bid-expert?business=${businessId}`} className="sidebar-link">
            Bid Expert
          </a>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-section-label">Setup</div>
        <a href={`/onboarding?business=${businessId}&step=0`} className="sidebar-link">
          Business Details
        </a>
        <a href={`/onboarding?business=${businessId}&step=2`} className="sidebar-link">
          Telegram
          <span className={telegramConnected ? "sidebar-dot good" : "sidebar-dot warn"} />
        </a>
        <a href={`/onboarding?business=${businessId}&step=3`} className="sidebar-link">
          Schedule
          <span className={schedule ? "sidebar-dot good" : "sidebar-dot warn"} />
        </a>

        <div className="sidebar-stats">
          <div>
            <strong>{matches.length}</strong>
            <span>Total</span>
          </div>
          <div>
            <strong style={{ color: "var(--match-green)" }}>{strongMatches}</strong>
            <span>Strong</span>
          </div>
          <div>
            <strong style={{ color: "var(--stamp-red-deep)" }}>{jkMatches}</strong>
            <span>J&amp;K</span>
          </div>
        </div>

        <button className="submit-btn sidebar-scan-btn" onClick={runScanNow} disabled={scanning}>
          {scanning ? "Generating..." : "Run scan now"}
        </button>
        {scanLog && <div className="scan-log">{scanLog}</div>}
        {error && <div className="error-note" style={{ marginTop: 10 }}>{error}</div>}
      </aside>

      {/* ---------- Main content ---------- */}
      <main className="dash-main">
        <div className="demo-banner">
          DEMO MODE — sample tenders generated for demonstration, not live GeM data. (Real
          GeM scraping can take 10+ minutes per run due to portal load times, so this demo
          uses AI-generated sample data to show the full pipeline instantly.)
        </div>

        {tab === "overview" && (
          <>
            <div className="dash-header">
              <h2>Overview</h2>
              <p>Every tender that matters, found for you.</p>
            </div>

            <div className="scan-walker-box">
              {scanning ? (
                <>
                  <div className="scan-walker-track">
                    <div className="scan-walker-figure">
                      <div className="scan-walker-bob">
                        <svg width="46" height="94" viewBox="0 -8 46 94">
                          <ellipse cx="23" cy="9" rx="15" ry="4.5" fill="#161616" />
                          <path d="M11 9 Q11 -2 23 -2 Q35 -2 35 9 L11 9 Z" fill="#161616" />
                          <rect x="14" y="0" width="18" height="5" fill="#161616" />
                          <circle cx="23" cy="20" r="6.5" fill="#e8e0c9" stroke="#161616" strokeWidth="1.5" />
                          <path d="M18 22 Q23 25 28 22 L28 24 Q23 27 18 24 Z" fill="#161616" />
                          <path
                            className="scan-leg-back"
                            d="M23 30 L17 30 L15 68 L21 68 L24 34 Z"
                            fill="#3a3a3a"
                          />
                          <path
                            className="scan-leg-front"
                            d="M23 30 L29 30 L31 68 L25 68 L22 34 Z"
                            fill="#555555"
                          />
                          <path
                            d="M10 28 Q10 22 23 22 Q36 22 36 28 L34 60 Q23 66 12 60 Z"
                            fill="#1e1e1e"
                          />
                          <path d="M23 22 L21 60" stroke="#0a0a0a" strokeWidth="1" />
                          <path d="M10 28 L4 58 Q3 61 6 61 L9 61 L12 30 Z" fill="#161616" />
                          <line
                            className="scan-arm-back"
                            x1="14"
                            y1="30"
                            x2="6"
                            y2="46"
                            stroke="#161616"
                            strokeWidth="7"
                            strokeLinecap="round"
                          />
                          <g className="scan-arm-front">
                            <line x1="32" y1="30" x2="40" y2="42" stroke="#161616" strokeWidth="7" strokeLinecap="round" />
                            <rect x="37" y="41" width="13" height="11" rx="1.5" fill="#3a3a3a" />
                            <rect x="41.5" y="38" width="4" height="4" fill="#3a3a3a" />
                          </g>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="scan-walker-text">{scanPhrases[phraseIdx]}</div>
                </>
              ) : (
                <>
                  <div className="scan-idle-track">
                    <svg width="46" height="94" viewBox="0 -8 46 94">
                      <ellipse cx="23" cy="9" rx="15" ry="4.5" fill="#161616" />
                      <path d="M11 9 Q11 -2 23 -2 Q35 -2 35 9 L11 9 Z" fill="#161616" />
                      <rect x="14" y="0" width="18" height="5" fill="#161616" />
                      <circle cx="23" cy="20" r="6.5" fill="#e8e0c9" stroke="#161616" strokeWidth="1.5" />
                      <path d="M23 30 L17 30 L15 68 L21 68 L24 34 Z" fill="#3a3a3a" />
                      <path d="M23 30 L29 30 L31 68 L25 68 L22 34 Z" fill="#555555" />
                      <path d="M10 28 Q10 22 23 22 Q36 22 36 28 L34 60 Q23 66 12 60 Z" fill="#1e1e1e" />
                      <path d="M23 22 L21 60" stroke="#0a0a0a" strokeWidth="1" />
                      <path d="M10 28 L4 58 Q3 61 6 61 L9 61 L12 30 Z" fill="#161616" />
                      <line x1="14" y1="30" x2="9" y2="47" stroke="#161616" strokeWidth="7" strokeLinecap="round" />
                      <g className="scan-idle-wave-arm">
                        <line x1="32" y1="30" x2="34" y2="15" stroke="#161616" strokeWidth="7" strokeLinecap="round" />
                      </g>
                    </svg>
                  </div>
                  <div className="scan-walker-text">Ready when you are</div>
                </>
              )}
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <span>Business</span>
                <strong>{business?.business_name || "—"}</strong>
                <small>{business?.sector || "Sector not set"}</small>
                <a href={`/onboarding?business=${businessId}&step=0`} className="summary-link">
                  Edit →
                </a>
              </div>

              <div className="summary-card">
                <span>Priority State</span>
                <strong>{business?.state || "—"}</strong>
              </div>

              <div className="summary-card">
                <span>Telegram</span>
                <strong className={telegramConnected ? "status-good" : "status-warn"}>
                  {telegramConnected ? "Connected" : "Not connected"}
                </strong>
                {!telegramConnected && (
                  <a href={`/onboarding?business=${businessId}&step=2`} className="summary-link">
                    Connect now →
                  </a>
                )}
              </div>

              <div className="summary-card">
                <span>Alert Schedule</span>
                <strong>
                  {schedule?.send_times?.length ? schedule.send_times.join(", ") + " IST" : "Not set"}
                </strong>
                {!schedule && (
                  <a href={`/onboarding?business=${businessId}&step=3`} className="summary-link">
                    Set schedule →
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "knowledge" && (
          <>
            <div className="dash-header">
              <h2>Knowledge Base</h2>
              <p>Categories the agent scores every tender against.</p>
            </div>

            {kbRows.length === 0 ? (
              <div className="empty-note" style={{ padding: "16px 0" }}>
                No categories filed yet.{" "}
                <a href={`/onboarding?business=${businessId}`} style={{ textDecoration: "underline" }}>
                  Add your knowledge base →
                </a>
              </div>
            ) : (
              <div className="kb-display">
                {kbRows.map((row) => (
                  <div className="kb-chip" key={row.id}>
                    <strong>{row.category}</strong>
                    {row.keywords && <span> — {row.keywords}</span>}
                  </div>
                ))}
              </div>
            )}

            <a
              href={`/onboarding?business=${businessId}&step=1`}
              className="quick-action"
              style={{ marginTop: 20, display: "inline-block" }}
            >
              Edit Knowledge Base
            </a>
          </>
        )}

        {tab === "cases" && (
          <>
            <div className="dash-header">
              <h2>Case Files</h2>
              <p>{matches.length} entries on record.</p>
            </div>

            {matches.length === 0 && (
              <div className="empty-state-rich">
                <p className="empty-note" style={{ padding: "0 0 8px" }}>
                  No case files yet.
                </p>
                <p className="tagline-body" style={{ maxWidth: 420, margin: "0 auto" }}>
                  Hit <strong>Run scan now</strong> in the sidebar and the agent will generate
                  sample tender listings tailored to your filed categories, and stamp the ones
                  worth your attention.
                </p>
              </div>
            )}

            {matches.map((m) => {
              const verdict = verdictFor(m);
              const t = m.tenders;
              return (
                <article className="case-file" key={m.id}>
                  <div className="stamp" style={{ ["--stamp-color" as any]: verdict.colorVar }}>
                    <div className="verdict">{verdict.label}</div>
                    <div className="score">{m.relevance_score ?? "—"}%</div>
                  </div>

                  <div className="bid-number">
                    {t?.bid_number || "Bid number unavailable"}
                    {t?.is_jammu_kashmir && <span className="jk-flag">J&amp;K</span>}
                  </div>
                  <h3>{t?.title || "Untitled tender"}</h3>

                  <div className="meta-grid">
                    <div>
                      <span>Ministry</span>
                      {t?.ministry || "—"}
                    </div>
                    <div>
                      <span>Location</span>
                      {t?.location || "—"}
                    </div>
                    <div>
                      <span>Bid End Date</span>
                      {t?.bid_end_date || "—"}
                    </div>
                    <div>
                      <span>EMD Required</span>
                      {t?.emd_required === null || t?.emd_required === undefined
                        ? "—"
                        : t.emd_required
                        ? "Yes"
                        : "No"}
                    </div>
                  </div>

                  {m.relevance_reasoning && <div className="reasoning">{m.relevance_reasoning}</div>}

                  <div className="tender-actions">
                    <a href={`/bid-expert?business=${businessId}&bid=${encodeURIComponent(t?.bid_number || "")}`}>
                      Prepare bid docs →
                    </a>
                  </div>
                </article>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="wrap" />}>
      <DashboardInner />
    </Suspense>
  );
}
