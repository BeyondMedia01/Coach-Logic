import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { conversationId } = await req.json();

  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey || !conversationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
    method: "DELETE",
    headers: { "x-api-key": apiKey },
  });

  return NextResponse.json({ ok: true });
}
