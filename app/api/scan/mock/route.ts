import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TENDER_COUNT = 20;

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.split("```")[1];
    if (t.startsWith("json")) t = t.slice(4);
  }
  return t.trim();
}

const APP_URL = "https://tenderops-gazette-dubehvansh22-2337s-projects.vercel.app";

async function sendTelegramAlert(botToken: string, chatId: string, tender: any, businessId: string) {
  const bidExpertUrl = `${APP_URL}/bid-expert?business=${businessId}&bid=${encodeURIComponent(
    tender.bidNumber || ""
  )}`;
  const text =
    `🔔 [DEMO] New tender match (${tender.relevanceScore}% relevance)\n\n` +
    `${tender.title}\n` +
    `Bid #: ${tender.bidNumber}\n` +
    `Ministry: ${tender.ministry}\n` +
    `Location: ${tender.location}\n` +
    `Deadline: ${tender.bidEndDate}\n\n` +
    `${tender.relevanceReasoning}\n\n` +
    `Prepare bid docs: ${bidExpertUrl}\n\n` +
    `(This is sample data for demonstration purposes.)`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { businessId, sendTelegramNow } = await req.json();
    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured on the server yet." },
        { status: 500 }
      );
    }

    const admin = supabaseAdmin();

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();
    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const { data: kbRows } = await admin
      .from("knowledge_base")
      .select("*")
      .eq("business_id", businessId);

    const { data: telegramLink } = await admin
      .from("telegram_links")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    const kbText = (kbRows || [])
      .map((k) => `- ${k.category}: ${k.keywords || ""}`)
      .join("\n");

    const prompt = `Generate ${TENDER_COUNT} realistic, entirely FICTIONAL sample tender listings styled like India's Government e-Marketplace (GeM) portal, for demo/testing purposes only. These must be clearly synthetic — do not reference any real bid numbers, real ongoing procurements, or real officials.

The business "${business.business_name}" (sector: ${business.sector || "unspecified"}) has these categories:
${kbText || "(no categories provided)"}

The business prioritizes: ${business.state || "India"}

Vary the results realistically: some should be strong matches to the business's categories (relevanceScore 70-95), some moderate (40-65), some weak/irrelevant (10-35). About 3-4 should have location set to "${business.state}" with isJammuKashmir true if that state is Jammu and Kashmir.

Return ONLY a JSON array of ${TENDER_COUNT} objects, each with exactly these fields:
{
  "bidNumber": "GEM/2026/B/XXXXXXX (fictional format)",
  "title": "string",
  "ministry": "string",
  "department": "string",
  "organization": "string",
  "officeName": "string",
  "itemCategory": "string",
  "totalQuantity": number or null,
  "bidEndDate": "YYYY-MM-DD HH:MM:SS (a plausible near-future date)",
  "bidOpeningDate": "YYYY-MM-DD HH:MM:SS",
  "emdRequired": true/false,
  "emdAmount": number or null,
  "bidType": "string",
  "deliveryDays": number or null,
  "location": "Indian state/UT",
  "isJammuKashmir": true/false,
  "relevanceScore": 0-100,
  "relevanceReasoning": "one sentence",
  "shouldAlert": true/false (true if relevanceScore >= 60 or isJammuKashmir)
}

No preamble, no markdown fences — just the raw JSON array.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text : "";
    const tenders: any[] = JSON.parse(stripFences(text));

    const results = [];

    for (const t of tenders) {
      const { data: tenderRow, error: upsertErr } = await admin
        .from("tenders")
        .upsert(
          {
            bid_number: t.bidNumber,
            title: t.title,
            ministry: t.ministry,
            department: t.department,
            organization: t.organization,
            office_name: t.officeName,
            item_category: t.itemCategory,
            total_quantity: t.totalQuantity,
            bid_end_date: t.bidEndDate,
            bid_opening_date: t.bidOpeningDate,
            emd_required: t.emdRequired,
            emd_amount: t.emdAmount,
            bid_type: t.bidType,
            delivery_days: t.deliveryDays,
            bid_url: `demo://${t.bidNumber || "unknown"}`,
            location: t.location,
            is_jammu_kashmir: t.isJammuKashmir || false,
          },
          { onConflict: "bid_number" }
        )
        .select()
        .single();

      if (upsertErr) {
        console.error("tenders upsert failed:", upsertErr.message, "for bid", t.bidNumber);
        continue;
      }

      if (tenderRow) {
        const { error: matchErr } = await admin.from("tender_matches").upsert(
          {
            business_id: businessId,
            tender_id: tenderRow.id,
            relevance_score: t.relevanceScore,
            relevance_reasoning: t.relevanceReasoning,
            should_alert: t.shouldAlert,
          },
          { onConflict: "business_id,tender_id" }
        );
        if (matchErr) {
          console.error("tender_matches upsert failed:", matchErr.message, "for bid", t.bidNumber);
        }
      }

      results.push(t);

      if (
        sendTelegramNow &&
        t.shouldAlert &&
        telegramLink?.bot_token &&
        telegramLink?.telegram_chat_id
      ) {
        await sendTelegramAlert(telegramLink.bot_token, telegramLink.telegram_chat_id, t, businessId);
      }
    }

    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    return NextResponse.json({ results, demoMode: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
  }
}
