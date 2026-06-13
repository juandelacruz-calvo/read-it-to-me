// Read It To Me — a tiny local web app.
//
// Serves a one-page UI. You paste text, click "Read", and the server detects
// the language, picks a matching Piper voice, synthesizes a WAV on the CPU, and
// streams it back for the browser to play.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VoiceRegistry } from "./src/voices.js";
import { detectLanguage } from "./src/langdetect.js";
import { synthesize, piperAvailable, resolvePiperPath } from "./src/tts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const MAX_CHARS = Number(process.env.MAX_CHARS) || 5000;

const registry = new VoiceRegistry();

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Reports what's installed so the UI can show a helpful setup message.
app.get("/api/status", (_req, res) => {
  res.json({
    piperReady: piperAvailable(),
    piperPath: resolvePiperPath(),
    voicesDir: registry.dir,
    voices: registry.voices.map((v) => ({
      key: v.key,
      family: v.family,
      language: v.language,
    })),
    defaultVoice: registry.defaultVoice?.key ?? null,
    maxChars: MAX_CHARS,
  });
});

app.post("/api/speak", async (req, res) => {
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).json({ error: "No text provided." });
  if (text.length > MAX_CHARS) {
    return res
      .status(413)
      .json({ error: `Text too long (max ${MAX_CHARS} characters).` });
  }
  if (!piperAvailable()) {
    return res.status(503).json({
      error: "Piper binary not installed. See README (npm run download-voices).",
    });
  }
  if (registry.voices.length === 0) {
    return res.status(503).json({
      error: "No voice models found. Add a Piper voice to the voices/ folder.",
    });
  }

  // Voice selection: an explicit voice key overrides auto-detection.
  const requestedKey = (req.body?.voice ?? "").toString().trim();
  let voice;
  let language;
  if (requestedKey) {
    voice = registry.get(requestedKey);
    if (!voice) {
      return res.status(400).json({ error: `Unknown voice: ${requestedKey}` });
    }
    language = voice.language;
  } else {
    const detected = detectLanguage(text);
    language = detected.language;
    voice = registry.pick(detected.family);
  }

  // Speed: 0.5x–2.0x. Piper's length_scale is inverse (higher = slower).
  const speed = clamp(Number(req.body?.speed) || 1, 0.5, 2);
  const lengthScale = 1 / speed;

  try {
    const wav = await synthesize(text, voice.modelPath, { lengthScale });
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("X-Detected-Language", language || "unknown");
    res.setHeader("X-Voice", voice.key);
    res.setHeader("X-Voice-Language", voice.language);
    res.send(wav);
  } catch (err) {
    console.error("Synthesis failed:", err);
    res.status(500).json({ error: err.message || "Synthesis failed." });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`\n  Read It To Me  →  http://${HOST}:${PORT}\n`);
  if (!piperAvailable()) {
    console.log("  ⚠  Piper binary not found. Run: npm run download-voices");
  } else if (registry.voices.length === 0) {
    console.log("  ⚠  No voices found. Run: npm run download-voices");
  } else {
    console.log(
      `  Voices: ${registry.voices.map((v) => v.key).join(", ")}\n`,
    );
  }
});
