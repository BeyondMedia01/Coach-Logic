import { NextRequest, NextResponse } from "next/server";
import type { Personality } from "@/lib/voices";

const PERSONALITY_DESCRIPTIONS: Record<Personality, string> = {
  Professional: "formal, precise, and business-focused",
  Casual: "relaxed, conversational, and approachable",
  Friendly: "warm, encouraging, and supportive",
  Formal: "structured, polished, and respectful",
  Direct: "clear, concise, and action-oriented",
  Encouraging: "motivating, positive, and uplifting",
  Empathetic: "understanding, compassionate, and patient",
  Creative: "imaginative, insightful, and inspiring",
  Humorous: "light-hearted, witty, and engaging",
  Concise: "brief, focused, and efficient",
};

function buildSystemPrompt(tone: Personality, language: string): string {
  const description = PERSONALITY_DESCRIPTIONS[tone] ?? "professional and supportive";
  return `You are Coach Logic, an AI business coach. Your communication style is ${description}. Always respond in ${language}. Your mission is to offer personalized support and deliver actionable insights to help the user reach their business goals. Ask thoughtful follow-up questions to understand the user's situation. Keep responses concise and conversational since this is a live video call.`;
}

export async function POST(req: NextRequest) {
  const { tone, language } = await req.json();

  const apiKey = process.env.TAVUS_API_KEY;
  const replicaId = process.env.TAVUS_REPLICA_ID;
  const personaId = process.env.TAVUS_PERSONA_ID;

  if (!apiKey || !replicaId) {
    return NextResponse.json({ error: "Avatar not configured" }, { status: 500 });
  }

  const body: Record<string, unknown> = {
    replica_id: replicaId,
    conversational_context: buildSystemPrompt(tone as Personality, language ?? "English"),
    properties: {
      max_call_duration: 1800,
      enable_recording: false,
    },
  };
  if (personaId) body.persona_id = personaId;

  const res = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Tavus session error:", err);
    return NextResponse.json({ error: "Failed to create avatar session" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({
    conversationUrl: data.conversation_url,
    conversationId: data.conversation_id,
  });
}
