// Vercel serverless function — generates AI replies via Groq
// Accepts POST { message, language, tone, history }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const { message, language = "English", tone = "Professional", history = [] } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const systemPrompt = `You are Coach Logic, an AI business coach conducting a structured onboarding conversation.
Your goal is to learn about the user's business and goals through natural, flowing conversation — one or two questions at a time — then provide personalized, actionable coaching insights.

Guidelines:
- Always reply in ${language}.
- Your tone is ${tone}: ${toneDescriptions[tone] || "clear and helpful"}.
- Read the full conversation history carefully before responding — your reply must directly follow from what was just said.
- Ask follow-up questions that build on the user's previous answers. Never ask something they already answered.
- If the user shares information (business name, goals, challenges), acknowledge it specifically before moving on.
- Keep replies to 2-4 sentences. Be conversational, not clinical.
- Do not introduce yourself again after the first message.
- Do not say you are an AI or a language model.
- If the user goes off-topic, gently guide them back to the coaching conversation.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10), // cap context to last 10 exchanges
    { role: "user", content: message.trim() },
  ];

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 450,
        temperature: 0.7,
      }),
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text();
      console.error("Groq error:", groqRes.status, detail);
      return res.status(groqRes.status).json({ error: `Groq ${groqRes.status}: ${detail}` });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("chat handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}

const toneDescriptions = {
  Professional: "articulate, composed, and business-focused",
  Casual:       "relaxed, conversational, and approachable",
  Friendly:     "warm, encouraging, and personable",
  Formal:       "precise, structured, and respectful",
  Direct:       "concise, confident, and to the point",
  Encouraging:  "upbeat, motivating, and positive",
  Empathetic:   "understanding, compassionate, and supportive",
  Creative:     "imaginative, engaging, and out-of-the-box",
  Humorous:     "light, witty, and fun without losing helpfulness",
  Concise:      "brief and clear — every word earns its place",
};
