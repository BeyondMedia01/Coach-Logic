// Vercel serverless function — transcribes audio via ElevenLabs Scribe STT
// Accepts multipart/form-data with an "audio" file field.

export const config = {
  api: {
    bodyParser: false, // Required to handle raw multipart data
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
  }

  try {
    // Collect raw body chunks
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Forward the multipart request directly to ElevenLabs
    const contentType = req.headers["content-type"];

    const elevenRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": contentType,
      },
      body: rawBody,
    });

    if (!elevenRes.ok) {
      const detail = await elevenRes.text();
      console.error("ElevenLabs STT error:", elevenRes.status, detail);
      return res.status(elevenRes.status).json({ error: "Transcription failed", detail });
    }

    const data = await elevenRes.json();
    return res.status(200).json({ transcript: data.text || "" });
  } catch (err) {
    console.error("transcribe handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
