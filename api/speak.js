// Vercel serverless function — proxies ElevenLabs TTS
// Keeps ELEVENLABS_API_KEY server-side, never exposed to the browser.

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
  }

  const { text, voice_id, language = "English" } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "text is required" });
  }

  // Use provided voice_id or fall back to ElevenLabs' multilingual default
  const targetVoiceId = voice_id || "EXAVITQu4vr4xnSDxMaL";

  try {
    const elevenRes = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${targetVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const detail = await elevenRes.text();
      console.error("ElevenLabs error:", elevenRes.status, detail);
      return res.status(elevenRes.status).json({
        error: "ElevenLabs request failed",
        detail,
      });
    }

    // Collect full audio buffer then send — more reliable than streaming on Vercel
    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audioBuffer);
  } catch (err) {
    console.error("speak handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
