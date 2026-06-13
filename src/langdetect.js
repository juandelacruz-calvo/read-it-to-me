// Detects the language of a piece of text and returns a Piper "family" code.
//
// Uses tinyld: a lightweight, pure-JavaScript detector (no native build, works
// on old systems) that is accurate even on short text. Conveniently, tinyld
// returns ISO 639-1 codes (en, es, zh, ja, …) which are exactly the "family"
// codes Piper uses in each voice's *.onnx.json — so no extra mapping is needed.
import { detect } from "tinyld";
import { familyName } from "./langmap.js";

/**
 * @param {string} text
 * @returns {{ family: string|null, language: string|null }}
 */
export function detectLanguage(text) {
  const family = detect(text) || null;
  return { family, language: family ? familyName(family) : null };
}
