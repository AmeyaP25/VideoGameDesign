/**
 * Shard Circuit — procedural Web Audio (BGM + SFX). Original, copyright-safe.
 * Global: window.GRPAudio
 */
(function () {
  "use strict";

  const AC = window.AudioContext || window.webkitAudioContext;

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;

  let musicMode = "off";
  let sectorTag = "s1";
  let pausedMusic = false;
  let stepIndex = 0;
  let nextNoteTime = 0;
  let activeOscs = [];

  const TITLE_BPM = 92;
  const GAME_BPM = { s1: 118, s2: 128, s3: 138 };

  const SCALE = [0, 2, 3, 5, 7, 8, 10];
  const ROOT = { title: 48, s1: 52, s2: 50, s3: 53 };

  function mtof(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function ensureCtx() {
    if (ctx) return ctx;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.55;
    sfxGain.connect(master);

    return ctx;
  }

  function resume() {
    const c = ensureCtx();
    if (c && c.state === "suspended") c.resume();
    return c;
  }

  function setVolumes(music01, sfx01) {
    if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, music01)) * 0.4;
    if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, sfx01)) * 0.65;
  }

  function stopScheduledMusic() {
    const t = ctx ? ctx.currentTime : 0;
    for (const o of activeOscs) {
      try {
        o.stop(t);
      } catch (_) {}
    }
    activeOscs.length = 0;
    stepIndex = 0;
    nextNoteTime = 0;
  }

  function scheduleTone(time, freq, dur, type, gain, dest) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    activeOscs.push(osc);
  }

  function scheduleNoiseBurst(time, dur, gain) {
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(g);
    g.connect(sfxGain);
    src.start(time);
    src.stop(time + dur + 0.05);
  }

  function bassPattern(mode, step) {
    const root = ROOT[mode === "title" ? "title" : sectorTag] || ROOT.s1;
    const deg = [0, 0, 5, 5, 3, 3, 7, 4][step % 8];
    const oct = step % 8 === 6 ? -12 : -12;
    return root + deg + oct;
  }

  function leadPattern(mode, step) {
    const root = ROOT[mode === "title" ? "title" : sectorTag] || ROOT.s1;
    const pat =
      mode === "title"
        ? [0, 3, 5, 7, 5, 3, 2, 0, 3, 5, 8, 7, 5, 3, 0, 2]
        : sectorTag === "s2"
          ? [0, 2, 3, 5, 7, 5, 3, 2, 0, 3, 2, 0, 5, 7, 8, 7]
          : sectorTag === "s3"
            ? [0, 5, 7, 8, 7, 5, 3, 0, 5, 7, 10, 8, 7, 5, 3, 2]
            : [0, 3, 5, 7, 8, 7, 5, 3, 5, 7, 8, 10, 8, 7, 5, 0];
    return root + pat[step % 16];
  }

  function sixteenthDur(bpm) {
    return 60 / bpm / 4;
  }

  function musicTick() {
    if (!ctx || pausedMusic || musicMode === "off") return;
    const bpm = musicMode === "title" ? TITLE_BPM : GAME_BPM[sectorTag] || GAME_BPM.s1;
    const stepDur = sixteenthDur(bpm);
    const now = ctx.currentTime;
    const lookAhead = 0.14;
    if (nextNoteTime === 0) nextNoteTime = now + 0.05;

    while (nextNoteTime < now + lookAhead) {
      const s = stepIndex;
      if (musicMode === "title") {
        if (s % 2 === 0) {
          const m = bassPattern("title", Math.floor(s / 4));
          scheduleTone(nextNoteTime, mtof(m), stepDur * 1.8, "triangle", 0.07, musicGain);
        }
        if (s % 4 === 0) {
          const m = leadPattern("title", s);
          scheduleTone(nextNoteTime, mtof(m + 12), stepDur * 0.9, "square", 0.04, musicGain);
        }
      } else {
        if (s % 2 === 0) {
          const m = bassPattern("game", Math.floor(s / 4));
          scheduleTone(nextNoteTime, mtof(m), stepDur * 1.6, "square", 0.065, musicGain);
        }
        if (s % 4 === 2) {
          const m = leadPattern("game", s);
          scheduleTone(nextNoteTime, mtof(m + 12), stepDur * 0.75, "square", 0.045, musicGain);
        }
        if (s % 8 === 0) {
          scheduleTone(nextNoteTime, mtof(ROOT[sectorTag] + 24), stepDur * 0.4, "triangle", 0.03, musicGain);
        }
      }
      nextNoteTime += stepDur;
      stepIndex++;
      if (stepIndex > 1e6) stepIndex = 0;
    }

    const cap = 64;
    if (activeOscs.length > cap) {
      const old = activeOscs.splice(0, activeOscs.length - cap);
      const t = ctx.currentTime;
      for (const o of old) {
        try {
          o.stop(t);
        } catch (_) {}
      }
    }
  }

  function startTitleMusic() {
    resume();
    if (!ctx) return;
    stopScheduledMusic();
    musicMode = "title";
    sectorTag = "s1";
    pausedMusic = false;
    nextNoteTime = ctx.currentTime + 0.05;
  }

  function startGameMusic(sector) {
    resume();
    if (!ctx) return;
    stopScheduledMusic();
    musicMode = "game";
    sectorTag = sector >= 3 ? "s3" : sector >= 2 ? "s2" : "s1";
    pausedMusic = false;
    nextNoteTime = ctx.currentTime + 0.05;
  }

  function stopMusic() {
    stopScheduledMusic();
    musicMode = "off";
  }

  function setPaused(p) {
    pausedMusic = p;
    if (p && ctx) {
      musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    } else if (!p && ctx && musicMode !== "off") {
      const v = parseFloat(document.getElementById("homeVolMusic")?.value ?? "70") / 100;
      musicGain.gain.linearRampToValueAtTime(v * 0.4, ctx.currentTime + 0.12);
    }
  }

  function playSfx(name, arg) {
    resume();
    if (!ctx || !sfxGain) return;
    const t0 = ctx.currentTime;
    const g = sfxGain.gain.value;

    switch (name) {
      case "ui_open":
        scheduleTone(t0, 330, 0.06, "square", 0.05 * g, sfxGain);
        scheduleTone(t0 + 0.05, 440, 0.08, "square", 0.04 * g, sfxGain);
        break;
      case "ui_confirm":
        scheduleTone(t0, 523, 0.07, "square", 0.07 * g, sfxGain);
        scheduleTone(t0 + 0.06, 659, 0.1, "square", 0.05 * g, sfxGain);
        break;
      case "pause_in":
        scheduleTone(t0, 220, 0.12, "triangle", 0.06 * g, sfxGain);
        break;
      case "pause_out":
        scheduleTone(t0, 330, 0.1, "triangle", 0.06 * g, sfxGain);
        break;
      case "shard_pickup": {
        const tier = Math.min(8, (arg && arg.combo) || 1);
        scheduleTone(t0, 360 + tier * 45, 0.05, "square", 0.065 * g, sfxGain);
        scheduleTone(t0 + 0.04, 520 + tier * 30, 0.06, "square", 0.04 * g, sfxGain);
        break;
      }
      case "hit":
        scheduleTone(t0, 95, 0.18, "sawtooth", 0.09 * g, sfxGain);
        scheduleNoiseBurst(t0, 0.06, 0.04 * g);
        break;
      case "pulse_warn":
        scheduleTone(t0, 180 + (arg && arg.pitch ? arg.pitch : 0), 0.04, "square", 0.05 * g, sfxGain);
        break;
      case "pulse_zap":
        scheduleTone(t0, 120, 0.12, "sawtooth", 0.07 * g, sfxGain);
        scheduleNoiseBurst(t0 + 0.02, 0.08, 0.06 * g);
        break;
      case "hazard_floor":
        scheduleTone(t0, 140, 0.1, "square", 0.06 * g, sfxGain);
        break;
      case "exit_touch":
        scheduleTone(t0, 440, 0.08, "triangle", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.08, 554, 0.1, "triangle", 0.05 * g, sfxGain);
        break;
      case "level_complete":
        scheduleTone(t0, 523, 0.1, "square", 0.07 * g, sfxGain);
        scheduleTone(t0 + 0.1, 659, 0.1, "square", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.2, 784, 0.15, "square", 0.055 * g, sfxGain);
        break;
      case "sector_complete":
        scheduleTone(t0, 392, 0.12, "square", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.12, 523, 0.12, "square", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.24, 659, 0.14, "square", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.38, 784, 0.2, "square", 0.055 * g, sfxGain);
        break;
      case "game_over":
        scheduleTone(t0, 200, 0.2, "sawtooth", 0.08 * g, sfxGain);
        scheduleTone(t0 + 0.18, 150, 0.35, "triangle", 0.07 * g, sfxGain);
        scheduleNoiseBurst(t0 + 0.1, 0.15, 0.05 * g);
        break;
      case "win_game":
        for (let i = 0; i < 6; i++) {
          scheduleTone(t0 + i * 0.1, 523 + i * 40, 0.12, "square", 0.05 * g, sfxGain);
        }
        break;
      case "transition":
        scheduleNoiseBurst(t0, 0.12, 0.05 * g);
        scheduleTone(t0 + 0.05, 400, 0.15, "triangle", 0.04 * g, sfxGain);
        break;
      case "gate_toggle":
        scheduleTone(t0, 260, 0.05, "square", 0.04 * g, sfxGain);
        break;
      case "teleport":
        scheduleTone(t0, 880, 0.04, "sine", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.05, 1320, 0.08, "triangle", 0.05 * g, sfxGain);
        scheduleNoiseBurst(t0 + 0.02, 0.06, 0.04 * g);
        break;
      case "scrap_pickup":
        scheduleTone(t0, 420, 0.05, "square", 0.055 * g, sfxGain);
        scheduleTone(t0 + 0.04, 620, 0.07, "square", 0.04 * g, sfxGain);
        break;
      case "powerup":
        scheduleTone(t0, 523, 0.08, "square", 0.07 * g, sfxGain);
        scheduleTone(t0 + 0.07, 784, 0.12, "square", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.14, 1046, 0.1, "triangle", 0.04 * g, sfxGain);
        break;
      case "sentry_shoot":
        scheduleTone(t0, 200, 0.04, "square", 0.05 * g, sfxGain);
        scheduleNoiseBurst(t0 + 0.02, 0.04, 0.03 * g);
        break;
      case "ray_fire":
        scheduleTone(t0, 520, 0.05, "square", 0.06 * g, sfxGain);
        scheduleTone(t0 + 0.04, 880, 0.06, "triangle", 0.05 * g, sfxGain);
        scheduleNoiseBurst(t0 + 0.02, 0.04, 0.03 * g);
        break;
      case "saber_swing":
        scheduleTone(t0, 660, 0.04, "triangle", 0.07 * g, sfxGain);
        scheduleTone(t0 + 0.03, 990, 0.05, "square", 0.055 * g, sfxGain);
        scheduleTone(t0 + 0.06, 440, 0.08, "sawtooth", 0.04 * g, sfxGain);
        break;
      default:
        break;
    }
  }

  window.GRPAudio = {
    ensureCtx,
    resume,
    setVolumes,
    musicTick,
    startTitleMusic,
    startGameMusic,
    stopMusic,
    setPaused,
    playSfx,
    setSectorFromIndex(sectorNum) {
      sectorTag = sectorNum >= 3 ? "s3" : sectorNum >= 2 ? "s2" : "s1";
    },
  };
})();
