import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_BIDS_TO_PROCESS = 6;
const WINDOW_MINUTES = 60; // cron granularity — matches a business's send_time if within this window

const EXTRACTION_PROMPT = `You are extracting structured data from a Government e-Marketplace (GeM) bid PDF.

Return ONLY a JSON object (no preamble, no markdown fences) with these fields:
- bidNumber, title, ministry, department, organization, officeName, itemCategory
- totalQuantity (number or null)
- bidEndDate, bidOpeningDate (format "YYYY-MM-DD HH:MM:SS", or null)
- emdRequired (true/false)
- emdAmount (number or null)
- bidType (string or null)
- deliveryDays (number or null)
- location: the state/UT of the consignee/delivery address
- isJammuKashmir: true/false

If a field genuinely isn't present, use null — never guess.`;

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.split("```")[1];
    if (t.startsWith("json")) t = t.slice(4);
  }
  return t.trim();
}

async function discoverBids(): Promise<any[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not configured on the server.");
  const resp = await fetch(
    `https://api.apify.com/v2/acts/krawlify~gem-portal-scraper/run-sync-get-dataset-items?token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
  );
  if (!resp.ok) throw new Error(`Apify discovery failed (${resp.status}).`);
  return resp.json();
}

async function downloadPdf(bidUrl: string): Promise<Buffer> {
  const resp = await fetch(bidUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    },
  });
  if (!resp.ok) throw new Error(`Could not download bid document (${resp.status}).`);
  return Buffer.from(await resp.arrayBuffer());
}

async function extractFields(pdfBuffer: Buffer): Promise<any> {
  const pdfB64 = pdfBuffer.toString("base64");
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfB64 } },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });
  const block = response.content[0];
  const text = block.type === "text" ? block.text : "";
  return JSON.parse(stripFences(text));
}

async function scoreTender(tender: any, businessName: string, state: string, knowledgeBase: any[]) {
  const kbText = knowledgeBase.map((k) => `- ${k.category}: ${k.keywords || ""}`).join("\n");
  const prompt = `A business called "${businessName}" has these product/service categories:
${kbText || "(no categories provided)"}

The business is based in / prioritizes: ${state}

A government tender has this profile:
- Title: ${tender.title || ""}
- Item Category: ${tender.itemCategory || ""}
- Location: ${tender.location || ""}

Return ONLY a JSON object:
{
  "relevanceScore": <0-100>,
  "relevanceReasoning": "<one sentence>",
  "shouldAlert": <true/false — true if the tender is in the business's priority state, OR relevanceScore >= 30>
}`;
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  const text = block.type === "text" ? block.text : "";
  return JSON.parse(stripFences(text));
}

async function sendTelegramAlert(botToken: string, chatId: string, tender: any, score: any) {
  const text =
    `🔔 New tender match (${score.relevanceScore}% relevance)\n\n` +
    `${tender.title}\n` +
    `Bid #: ${tender.bidNumber}\n` +
    `Ministry: ${tender.ministry}\n` +
    `Location: ${tender.location}\n` +
    `Deadline: ${tender.bidEndDate}\n\n` +
    `${score.relevanceReasoning}\n` +
    `${tender.bidUrl || ""}`;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function isWithinWindow(sendTimes: string[], now: Date): boolean {
  // Compares against IST (Asia/Kolkata) wall-clock time.
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const nowMinutes = istNow.getHours() * 60 + istNow.getMinutes();

  return sendTimes.some((t) => {
    const [h, m] = t.split(":").map(Number);
    const targetMinutes = h * 60 + m;
    return Math.abs(nowMinutes - targetMinutes) <= WINDOW_MINUTES / 2;
  });
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends a GET request with an authorization header matching CRON_SECRET.
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const admin = supabaseAdmin();
    const now = new Date();

    const { data: businesses } = await admin.from("businesses").select("*");
    const { data: allKb } = await admin.from("knowledge_base").select("*");
    const { data: allLinks } = await admin.from("telegram_links").select("*");
    const { data: allSchedules } = await admin.from("alert_schedules").select("*");

    const kbByBusiness: Record<string, any[]> = {};
    (allKb || []).forEach((row) => {
      kbByBusiness[row.business_id] = kbByBusiness[row.business_id] || [];
      kbByBusiness[row.business_id].push(row);
    });
    const linkByBusiness: Record<string, any> = {};
    (allLinks || []).forEach((row) => (linkByBusiness[row.business_id] = row));
    const scheduleByBusiness: Record<string, any> = {};
    (allSchedules || []).forEach((row) => (scheduleByBusiness[row.business_id] = row));

    const dueBusinesses = (businesses || []).filter((b) => {
      const schedule = scheduleByBusiness[b.id];
      return schedule && schedule.active && isWithinWindow(schedule.send_times || [], now);
    });

    if (dueBusinesses.length === 0) {
      return NextResponse.json({ message: "No businesses due for a scan this window.", processed: 0 });
    }

    const bids = await discoverBids();
    const toProcess = bids.filter((b: any) => b.bidUrl).slice(0, MAX_BIDS_TO_PROCESS);

    // Extract + score once per bid, then fan out per-business scoring
    let alertsSent = 0;
    for (const bid of toProcess) {
      let fields: any;
      try {
        const pdfBuffer = await downloadPdf(bid.bidUrl);
        fields = await extractFields(pdfBuffer);
        fields.bidUrl = bid.bidUrl;
      } catch {
        continue;
      }

      const { data: tenderRow } = await admin
        .from("tenders")
        .upsert(
          {
            bid_number: fields.bidNumber,
            title: fields.title,
            ministry: fields.ministry,
            department: fields.department,
            organization: fields.organization,
            office_name: fields.officeName,
            item_category: fields.itemCategory,
            total_quantity: fields.totalQuantity,
            bid_end_date: fields.bidEndDate,
            bid_opening_date: fields.bidOpeningDate,
            emd_required: fields.emdRequired,
            emd_amount: fields.emdAmount,
            bid_type: fields.bidType,
            delivery_days: fields.deliveryDays,
            bid_url: bid.bidUrl,
            location: fields.location,
            is_jammu_kashmir: fields.isJammuKashmir || false,
          },
          { onConflict: "bid_number" }
        )
        .select()
        .single();

      for (const business of dueBusinesses) {
        try {
          const score = await scoreTender(
            fields,
            business.business_name,
            business.state,
            kbByBusiness[business.id] || []
          );

          if (tenderRow) {
            await admin.from("tender_matches").upsert(
              {
                business_id: business.id,
                tender_id: tenderRow.id,
                relevance_score: score.relevanceScore,
                relevance_reasoning: score.relevanceReasoning,
                should_alert: score.shouldAlert,
                sent_to_telegram_at: score.shouldAlert ? new Date().toISOString() : null,
              },
              { onConflict: "business_id,tender_id" }
            );
          }

          const link = linkByBusiness[business.id];
          if (score.shouldAlert && link?.bot_token && link?.telegram_chat_id) {
            await sendTelegramAlert(link.bot_token, link.telegram_chat_id, fields, score);
            alertsSent++;
          }
        } catch {
          continue;
        }
      }
    }

    return NextResponse.json({
      message: "Scan complete.",
      businessesProcessed: dueBusinesses.length,
      bidsProcessed: toProcess.length,
      alertsSent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
  }
}
