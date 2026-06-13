// Thin wrapper around the Piper TTS binary.
//
// Piper reads UTF-8 text on stdin and writes a WAV file. It is a small,
// CPU-only native binary (no GPU, no Python) which is why it runs well on old
// hardware. We spawn it per request and hand the resulting WAV back as a Buffer.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the Piper executable. Checks, in order:
 *   1. $PIPER_PATH (explicit override)
 *   2. bin/piper/piper(.exe)  — layout produced by the official release archives
 *   3. bin/piper(.exe)        — if you dropped the binary in directly
 * Returns the first that exists, else candidate #2 (for error messages).
 */
export function resolvePiperPath() {
  if (process.env.PIPER_PATH) return path.resolve(process.env.PIPER_PATH);
  const exe = process.platform === "win32" ? "piper.exe" : "piper";
  const bin = path.join(__dirname, "..", "bin");
  const candidates = [path.join(bin, "piper", exe), path.join(bin, exe)];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export function piperAvailable() {
  return fs.existsSync(resolvePiperPath());
}

/**
 * Synthesize speech for `text` using the given Piper model.
 * @param {string} text
 * @param {string} modelPath absolute path to a .onnx voice model
 * @param {{ lengthScale?: number }} [opts]
 *   lengthScale — Piper's phoneme length multiplier (>1 slower, <1 faster).
 * @returns {Promise<Buffer>} WAV audio
 */
export function synthesize(text, modelPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const piper = resolvePiperPath();
    if (!fs.existsSync(piper)) {
      reject(new Error(`Piper binary not found at ${piper}`));
      return;
    }
    if (!fs.existsSync(modelPath)) {
      reject(new Error(`Voice model not found at ${modelPath}`));
      return;
    }

    const outFile = path.join(
      os.tmpdir(),
      `ritm-${crypto.randomBytes(8).toString("hex")}.wav`,
    );

    const args = ["--model", modelPath, "--output_file", outFile];
    if (Number.isFinite(opts.lengthScale)) {
      args.push("--length_scale", String(opts.lengthScale));
    }

    const child = spawn(piper, args, {
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        cleanup(outFile);
        reject(new Error(`Piper exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      fs.readFile(outFile, (err, buf) => {
        cleanup(outFile);
        if (err) reject(err);
        else resolve(buf);
      });
    });

    child.stdin.write(text, "utf8");
    child.stdin.end();
  });
}

function cleanup(file) {
  fs.unlink(file, () => {});
}
