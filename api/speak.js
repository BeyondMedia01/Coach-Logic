// Vercel serverless function — proxies ElevenLabs TTS
// Keeps ELEVENLABS_API_KEY server-side, never exposed to the browser.

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// Default voice IDs — override via request body voice_id
const DEFAULT_VOICES = {
  English:    "EXAVITQu4vr4xnSDxMaL", // Sarah (multilingual)
  Spanish:    "EXAVITQu4vr4xnSDxMaL",
  French:     "EXAVITQu4vr4xnSDxMaL",
  Portuguese: "EXAVITQu4vr4xnSDxMaL",
  German:     "EXAVITQu4vr4xnSDxMaL",
};

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

  const voiceId = voice_id || DEFAULT_VOICES[language] || DEFAULT_VOICES.English;

  try {
    const elevenRes = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/stream`,
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

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    // Stream the audio directly to the client
    const reader = elevenRes.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(Buffer.from(value));
      await pump();
    };
    await pump();
  } catch (err) {
    console.error("speak handler error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
