const $ = (id) => document.getElementById(id);
const textEl = $("text");
const readBtn = $("read");
const stopBtn = $("stop");
const statusEl = $("status");
const countEl = $("count");
const player = $("player");
const voiceEl = $("voice");
const speedEl = $("speed");
const speedValEl = $("speedVal");
const volumeEl = $("volume");
const volumeValEl = $("volumeVal");

let currentUrl = null;
let maxChars = 5000;

const PREFS_KEY = "ritm-prefs";

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    if (p.voice != null) voiceEl.dataset.saved = p.voice;
    if (p.speed != null) speedEl.value = p.speed;
    if (p.volume != null) volumeEl.value = p.volume;
  } catch {
    /* ignore corrupt prefs */
  }
}

function savePrefs() {
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({
      voice: voiceEl.value,
      speed: speedEl.value,
      volume: volumeEl.value,
    }),
  );
}

function applySpeed() {
  const rate = Number(speedEl.value);
  player.playbackRate = rate; // live: changes playback tempo without re-synthesis
  speedValEl.textContent = `${rate.toFixed(1)}×`;
}

function applyVolume() {
  player.volume = Number(volumeEl.value);
  volumeValEl.textContent = `${Math.round(volumeEl.value * 100)}%`;
}

function setStatus(msg, kind = "") {
  statusEl.textContent = "";
  statusEl.className = "status" + (kind ? " " + kind : "");
  statusEl.innerHTML = msg;
}

function updateCount() {
  countEl.textContent = `${textEl.value.length} / ${maxChars}`;
}

function revokeUrl() {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const s = await res.json();
    maxChars = s.maxChars || maxChars;
    updateCount();

    if (!s.piperReady) {
      setStatus(
        "⚠ Piper isn't installed yet. Run <code>npm run download-voices</code>, then refresh.",
        "error",
      );
      readBtn.disabled = true;
    } else if (!s.voices.length) {
      setStatus(
        "⚠ No voices found. Add a Piper voice to the <code>voices/</code> folder.",
        "error",
      );
      readBtn.disabled = true;
    } else {
      // Populate the voice picker (keeping the "Auto-detect" first option).
      for (const v of s.voices) {
        const opt = document.createElement("option");
        opt.value = v.key;
        opt.textContent = `${v.language} — ${v.key}`;
        voiceEl.appendChild(opt);
      }
      // Restore a saved voice choice if it's still installed.
      const saved = voiceEl.dataset.saved;
      if (saved && s.voices.some((v) => v.key === saved)) voiceEl.value = saved;

      const langs = [...new Set(s.voices.map((v) => v.language))].join(", ");
      setStatus(`Ready. Installed voices: ${langs}.`);
    }
  } catch {
    setStatus("Could not reach the server.", "error");
  }
}

async function read() {
  const text = textEl.value.trim();
  if (!text) {
    setStatus("Type some text first.", "error");
    textEl.focus();
    return;
  }

  readBtn.disabled = true;
  setStatus("Synthesizing…");

  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: voiceEl.value, // "" means auto-detect
        // speed is applied live on the player (playbackRate), not at synthesis
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server error (${res.status}).`);
    }

    const detected = res.headers.get("X-Detected-Language") || "unknown";
    const voiceLang = res.headers.get("X-Voice-Language") || "";
    const blob = await res.blob();

    revokeUrl();
    currentUrl = URL.createObjectURL(blob);
    player.src = currentUrl;
    applyVolume();
    applySpeed(); // playbackRate can reset when a new clip loads
    await player.play();

    if (voiceEl.value) {
      // Manual voice — detection was skipped.
      setStatus(`Reading with <strong>${voiceLang}</strong> voice.`, "ok");
    } else {
      const note =
        detected === "unknown" || detected === voiceLang
          ? ""
          : ` <span class="badge">read with ${voiceLang} voice</span>`;
      setStatus(`Detected: <strong>${detected}</strong>${note}`, "ok");
    }
    stopBtn.disabled = false;
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    readBtn.disabled = false;
  }
}

function stop() {
  player.pause();
  player.currentTime = 0;
  stopBtn.disabled = true;
}

readBtn.addEventListener("click", read);
stopBtn.addEventListener("click", stop);
textEl.addEventListener("input", updateCount);
player.addEventListener("ended", () => (stopBtn.disabled = true));

speedEl.addEventListener("input", () => {
  applySpeed(); // live: affects audio already playing
  savePrefs();
});
volumeEl.addEventListener("input", () => {
  applyVolume(); // live: affects audio already playing
  savePrefs();
});
voiceEl.addEventListener("change", savePrefs);

// Ctrl/Cmd + Enter to read.
textEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") read();
});

// Keep pitch natural when the tempo changes (avoids the "chipmunk" effect).
for (const k of ["preservesPitch", "mozPreservesPitch", "webkitPreservesPitch"]) {
  if (k in player) player[k] = true;
}

loadPrefs();
applySpeed();
applyVolume();
updateCount();
loadStatus();
