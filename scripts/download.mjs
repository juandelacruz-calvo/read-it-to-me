// One-shot setup: downloads the Piper binary for this platform and a couple of
// starter voices. Re-run any time; existing files are skipped.
//
//   npm run download-voices
//
// Everything lands in bin/ and voices/, both git-ignored. Voice models are
// pulled from the official Piper voices repository on Hugging Face.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BIN_DIR = path.join(ROOT, "bin");
const VOICES_DIR = path.join(ROOT, "voices");

const PIPER_VERSION = "2023.11.14-2";

// platform/arch -> Piper release asset filename
const PIPER_ASSETS = {
  "win32-x64": "piper_windows_amd64.zip",
  "linux-x64": "piper_linux_x86_64.tar.gz",
  "linux-arm64": "piper_linux_aarch64.tar.gz",
  "linux-arm": "piper_linux_armv7l.tar.gz",
  "darwin-x64": "piper_macos_x64.tar.gz",
  "darwin-arm64": "piper_macos_aarch64.tar.gz",
};

// Starter voices (Hugging Face path under rhasspy/piper-voices/resolve/main/).
// Add more by copying the pattern; browse https://rhasspy.github.io/piper-samples/
const STARTER_VOICES = [
  "en/en_US/amy/medium/en_US-amy-medium",
  "es/es_ES/davefx/medium/es_ES-davefx-medium",
];

const HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

async function download(url, dest) {
  if (fs.existsSync(dest)) {
    console.log(`  ✓ already have ${path.basename(dest)}`);
    return;
  }
  process.stdout.write(`  ↓ ${path.basename(dest)} … `);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log(`done (${(buf.length / 1e6).toFixed(1)} MB)`);
}

async function installPiper() {
  console.log("\nPiper binary:");
  const key = `${process.platform}-${process.arch}`;
  const asset = PIPER_ASSETS[key];

  if (fs.existsSync(path.join(BIN_DIR, "piper")) || hasPiperExe()) {
    console.log("  ✓ already installed");
    return;
  }
  if (!asset) {
    console.log(`  ⚠ No prebuilt binary mapped for ${key}.`);
    console.log("    Download manually from:");
    console.log(`    https://github.com/rhasspy/piper/releases/tag/${PIPER_VERSION}`);
    console.log("    and extract into the bin/ folder.");
    return;
  }

  const url = `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/${asset}`;
  const archive = path.join(os.tmpdir(), asset);
  fs.mkdirSync(BIN_DIR, { recursive: true });
  await download(url, archive);

  // `tar -xf` (bsdtar on Windows 10+/macOS, GNU tar on Linux) handles both
  // .zip and .tar.gz and auto-detects the compression.
  process.stdout.write("  ⇲ extracting … ");
  const r = spawnSync("tar", ["-xf", archive, "-C", BIN_DIR], { stdio: "pipe" });
  if (r.status !== 0) {
    console.log("failed");
    throw new Error(
      `Could not extract ${asset}. Extract it into ${BIN_DIR} manually.\n` +
        (r.stderr?.toString() || ""),
    );
  }
  fs.rmSync(archive, { force: true });
  console.log("done");
}

function hasPiperExe() {
  return (
    fs.existsSync(path.join(BIN_DIR, "piper", "piper")) ||
    fs.existsSync(path.join(BIN_DIR, "piper", "piper.exe")) ||
    fs.existsSync(path.join(BIN_DIR, "piper.exe"))
  );
}

async function installVoices() {
  console.log("\nVoices:");
  fs.mkdirSync(VOICES_DIR, { recursive: true });
  for (const v of STARTER_VOICES) {
    const name = v.split("/").pop();
    await download(`${HF_BASE}/${v}.onnx`, path.join(VOICES_DIR, `${name}.onnx`));
    await download(
      `${HF_BASE}/${v}.onnx.json`,
      path.join(VOICES_DIR, `${name}.onnx.json`),
    );
  }
}

(async () => {
  console.log("Setting up Read It To Me…");
  try {
    await installPiper();
    await installVoices();
    console.log("\nAll set. Start the app with:  npm start\n");
  } catch (err) {
    console.error(`\n✗ ${err.message}\n`);
    process.exitCode = 1;
  }
})();
