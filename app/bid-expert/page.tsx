"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function BidExpertInner() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("business");
  const bidNumber = searchParams.get("bid");

  return (
    <div className="wrap">
      <header className="masthead">
        <div className="eyebrow">Est. for the AI First Hackathon · Vol. I</div>
        <h1>Bid Expert</h1>
        <p className="tagline">
          An AI that reads the tender's documents and your knowledge base to help you
          prepare bid materials.
        </p>
      </header>

      <div className="demo-banner">
        COMING SOON — this is a placeholder. In the full version, Bid Expert will read the
        specific tender's bid documents alongside your company's knowledge base, and help
        you draft the paperwork needed to actually bid.
      </div>

      {bidNumber && (
        <div className="filing" style={{ paddingTop: 24 }}>
          <div className="section-label">Preparing for</div>
          <p className="tagline-body" style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {bidNumber}
          </p>
        </div>
      )}

      <div className="filing" style={{ paddingTop: bidNumber ? 8 : 24 }}>
        <div className="section-label">Chat</div>
        <div className="bid-expert-chat">
          <div className="bid-expert-message">
            Hi! Once this is live, I'll walk through this tender's requirements with you
            and help draft your bid using what I know about your business. For now this
            is just a preview of where that conversation will happen.
          </div>
        </div>
        <div className="bid-expert-input-row">
          <input
            className="bid-expert-input"
            placeholder="Ask Bid Expert anything about this tender..."
            disabled
          />
          <button className="submit-btn" disabled style={{ padding: "12px 22px" }}>
            Send
          </button>
        </div>
      </div>

      {businessId && (
        <p className="tagline-body" style={{ marginTop: 20 }}>
          <a href={`/dashboard?business=${businessId}`} style={{ textDecoration: "underline" }}>
            ← Back to dashboard
          </a>
        </p>
      )}
    </div>
  );
}

export default function BidExpertPage() {
  return (
    <Suspense fallback={<div className="wrap" />}>
      <BidExpertInner />
    </Suspense>
  );
}
