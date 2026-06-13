// Discovers the Piper voice models installed in the voices/ directory.
//
// Each Piper voice is two files that sit side by side:
//   <name>.onnx        the model weights
//   <name>.onnx.json   metadata (sample rate, language, etc.)
//
// We scan for *.onnx files, read the sibling *.onnx.json to learn the language
// family, and build a lookup so the detected language can pick the right voice.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { familyName } from "./langmap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOICES_DIR = process.env.VOICES_DIR
  ? path.resolve(process.env.VOICES_DIR)
  : path.join(__dirname, "..", "voices");

/**
 * @typedef {Object} Voice
 * @property {string} key        filename without extension, e.g. "en_US-amy-medium"
 * @property {string} modelPath  absolute path to the .onnx file
 * @property {string} family     2-letter language family, e.g. "en"
 * @property {string} code       locale code, e.g. "en_US"
 * @property {string} language   human-friendly language name
 */

/** @returns {Voice[]} */
export function scanVoices() {
  if (!fs.existsSync(VOICES_DIR)) return [];

  /** @type {Voice[]} */
  const voices = [];
  for (const file of fs.readdirSync(VOICES_DIR)) {
    if (!file.endsWith(".onnx")) continue;

    const modelPath = path.join(VOICES_DIR, file);
    const metaPath = `${modelPath}.json`;
    const key = file.slice(0, -".onnx".length);

    let family = key.slice(0, 2).toLowerCase();
    let code = key.split("-")[0];

    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        if (meta?.language?.family) family = meta.language.family;
        if (meta?.language?.code) code = meta.language.code;
      } catch {
        // Fall back to the filename-derived family/code.
      }
    }

    voices.push({ key, modelPath, family, code, language: familyName(family) });
  }
  return voices;
}

export class VoiceRegistry {
  constructor() {
    this.refresh();
  }

  refresh() {
    this.voices = scanVoices();

    /** @type {Map<string, Voice>} family -> first voice for that family */
    this.byFamily = new Map();
    for (const v of this.voices) {
      if (!this.byFamily.has(v.family)) this.byFamily.set(v.family, v);
    }

    // Default voice: env override by key, else an English voice, else the first.
    const wanted = process.env.DEFAULT_VOICE;
    this.defaultVoice =
      (wanted && this.voices.find((v) => v.key === wanted)) ||
      this.byFamily.get("en") ||
      this.voices[0] ||
      null;

    return this;
  }

  get dir() {
    return VOICES_DIR;
  }

  get families() {
    return [...this.byFamily.keys()];
  }

  /** Pick the best voice for a detected language family, falling back to default. */
  pick(family) {
    return this.byFamily.get(family) || this.defaultVoice;
  }

  /** Look up a specific voice by its key (filename without extension). */
  get(key) {
    return this.voices.find((v) => v.key === key) || null;
  }
}
