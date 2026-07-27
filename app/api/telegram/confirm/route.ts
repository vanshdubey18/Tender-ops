import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { botToken } = await req.json();

    if (!botToken || typeof botToken !== "string") {
      return NextResponse.json({ error: "A bot token is required." }, { status: 400 });
    }

    const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
    const data = await resp.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: "That token was rejected by Telegram. Double-check it and try again." },
        { status: 400 }
      );
    }

    const updates = data.result || [];
    const startMessage = [...updates]
      .reverse()
      .find((u: any) => u.message?.text?.trim().startsWith("/start"));

    if (!startMessage) {
      return NextResponse.json(
        {
          error:
            "No /start message found yet. Open your bot in Telegram, send /start, then try Connect again.",
        },
        { status: 404 }
      );
    }

    const chatId = startMessage.message.chat.id;

    return NextResponse.json({ chatId: String(chatId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unexpected error." }, { status: 500 });
  }
}
