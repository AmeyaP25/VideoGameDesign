/**
 * Shard Circuit: procedural Web Audio (BGM + SFX). Works on HTTPS (e.g. Vercel) after a user gesture.
 * Global: window.GRPAudio
 *
 * All level/title music is synthesized here (oscillators + noise). It is not a recording of
 * third-party music — nothing to license, attribute, or cite for soundtrack use.
 */
(function () {
  "use strict";

  const AC = window.AudioContext || window.webkitAudioContext;

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;

  let musicMode = "off";
  let pausedMusic = false;
  /** Last UI volume 0 to 1 (no sliders; fixed defaults, still correct after pause). */
  let lastMusic01 = 0.7;
  let lastSfx01 = 0.8;
  let stepIndex = 0;
  let nextNoteTime = 0;
  let activeOscs = [];
  /** Which level theme (1–6) is active during gameplay BGM. */
  let gameLevelId = 1;

  const TITLE_BPM = 92;

  /**
   * One original procedural “track” per mission level: BPM, root MIDI note, bass/lead degree patterns,
   * mix levels, and rhythm (kick/hat divisors on the 16th-note grid).
   */
  const GAME_THEMES = [
    {
      id: 1,
      name: "lab",
      bpm: 115,
      root: 52,
      bassDeg: [0, 0, 5, 5, 3, 3, 7, 4],
      lead: [0, 3, 5, 7, 5, 3, 2, 0, 3, 5, 7, 5, 3, 2, 0, 3],
      bassGain: 0.064,
      leadGain: 0.05,
      accentGain: 0.032,
      bassType: "square",
      kickDiv: 16,
      hatDiv: 4,
      hatPhase: 2,
    },
    {
      id: 2,
      name: "training",
      bpm: 122,
      root: 51,
      bassDeg: [0, 5, 3, 5, 7, 5, 0, 5],
      lead: [0, 2, 3, 5, 7, 8, 7, 5, 3, 2, 0, 5, 7, 5, 3, 2],
      bassGain: 0.062,
      leadGain: 0.052,
      accentGain: 0.03,
      bassType: "square",
      kickDiv: 16,
      hatDiv: 4,
      hatPhase: 2,
    },
    {
      id: 3,
      name: "dust",
      bpm: 128,
      root: 53,
      bassDeg: [0, 7, 5, 3, 0, 5, 7, 4],
      lead: [0, 5, 7, 10, 8, 7, 5, 3, 5, 7, 8, 7, 5, 3, 2, 0],
      bassGain: 0.066,
      leadGain: 0.05,
      accentGain: 0.034,
      bassType: "square",
      kickDiv: 8,
      hatDiv: 4,
      hatPhase: 2,
    },
    {
      id: 4,
      name: "rift",
      bpm: 134,
      root: 55,
      bassDeg: [0, 0, 7, 7, 5, 5, 3, 7],
      lead: [0, 3, 5, 8, 7, 5, 3, 0, 5, 7, 10, 8, 7, 5, 3, 2],
      bassGain: 0.068,
      leadGain: 0.055,
      accentGain: 0.035,
      bassType: "square",
      kickDiv: 16,
      hatDiv: 2,
      hatPhase: 1,
    },
    {
      id: 5,
      name: "citadel",
      bpm: 120,
      root: 50,
      bassDeg: [0, 5, 3, 7, 0, 5, 3, 4],
      lead: [0, 3, 5, 7, 8, 7, 5, 3, 2, 3, 5, 7, 5, 3, 0, 2],
      bassGain: 0.063,
      leadGain: 0.047,
      accentGain: 0.03,
      bassType: "triangle",
      kickDiv: 16,
      hatDiv: 4,
      hatPhase: 2,
    },
    {
      id: 6,
      name: "boss",
      bpm: 98,
      root: 46,
      bassDeg: [0, 0, 3, 3, 5, 5, 7, 2],
      lead: [0, 1, 3, 5, 7, 8, 7, 5, 3, 2, 0, 5, 3, 2, 1, 0],
      bassGain: 0.078,
      leadGain: 0.056,
      accentGain: 0.038,
      bassType: "sawtooth",
      kickDiv: 8,
      hatDiv: 4,
      hatPhase: 2,
    },
  ];

  const ROOT = { title: 48 };

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
    if (c && c.state === "suspended") {
      const p = c.resume();
      if (p && typeof p.catch === "function") p.catch(function () {});
    }
    return c;
  }

  function setVolumes(music01, sfx01) {
    lastMusic01 = Math.max(0, Math.min(1, music01));
    lastSfx01 = Math.max(0, Math.min(1, sfx01));
    if (musicGain) musicGain.gain.value = lastMusic01 * 0.4;
    if (sfxGain) sfxGain.gain.value = lastSfx01 * 0.65;
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

  function titleBassMidi(step) {
    const root = ROOT.title;
    const deg = [0, 0, 5, 5, 3, 3, 7, 4][step % 8];
    return root + deg - 12;
  }

  function titleLeadMidi(step) {
    const root = ROOT.title;
    const pat = [0, 3, 5, 7, 5, 3, 2, 0, 3, 5, 8, 7, 5, 3, 0, 2];
    return root + pat[step % 16];
  }

  function scheduleMusicNoise(time, dur, gain) {
    if (!ctx || !musicGain) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(g);
    g.connect(musicGain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function sixteenthDur(bpm) {
    return 60 / bpm / 4;
  }

  function musicTick() {
    if (!ctx || pausedMusic || musicMode === "off") return;
    const bpm =
      musicMode === "title" ? TITLE_BPM : GAME_THEMES[Math.max(0, Math.min(5, gameLevelId - 1))].bpm;
    const stepDur = sixteenthDur(bpm);
    const now = ctx.currentTime;
    const lookAhead = 0.14;
    if (nextNoteTime === 0) nextNoteTime = now + 0.05;

    while (nextNoteTime < now + lookAhead) {
      const s = stepIndex;
      if (musicMode === "title") {
        if (s % 2 === 0) {
          const m = titleBassMidi(Math.floor(s / 4));
          scheduleTone(nextNoteTime, mtof(m), stepDur * 1.8, "triangle", 0.07, musicGain);
        }
        if (s % 4 === 0) {
          const m = titleLeadMidi(s);
          scheduleTone(nextNoteTime, mtof(m + 12), stepDur * 0.9, "square", 0.04, musicGain);
        }
      } else {
        const th = GAME_THEMES[Math.max(0, Math.min(5, gameLevelId - 1))];
        if (s % 2 === 0) {
          const bi = Math.floor(s / 4) % 8;
          const m = th.root + th.bassDeg[bi];
          scheduleTone(nextNoteTime, mtof(m), stepDur * 1.62, th.bassType || "square", th.bassGain, musicGain);
        }
        if (s % 4 === 2) {
          const m = th.root + th.lead[s % 16];
          scheduleTone(nextNoteTime, mtof(m + 12), stepDur * 0.76, "square", th.leadGain, musicGain);
        }
        if (s % 8 === 0) {
          scheduleTone(nextNoteTime, mtof(th.root + 24), stepDur * 0.42, "triangle", th.accentGain, musicGain);
        }
        if (th.kickDiv && s % th.kickDiv === 0) {
          scheduleTone(nextNoteTime, 62, stepDur * 1.1, "sine", 0.085, musicGain);
        }
        if (th.hatDiv && s % th.hatDiv === th.hatPhase) {
          scheduleMusicNoise(nextNoteTime, Math.min(0.04, stepDur * 2.2), 0.028);
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
    pausedMusic = false;
    nextNoteTime = ctx.currentTime + 0.05;
  }

  function startGameMusic(levelId) {
    resume();
    if (!ctx) return;
    stopScheduledMusic();
    musicMode = "game";
    const lid = Number(levelId);
    gameLevelId = Number.isFinite(lid) ? Math.max(1, Math.min(6, Math.floor(lid))) : 1;
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
      musicGain.gain.linearRampToValueAtTime(lastMusic01 * 0.4, ctx.currentTime + 0.12);
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
    /** Switch in-level BGM to match mission 1–6 (procedural theme). */
    setGameLevelMusic(levelId) {
      const lid = Number(levelId);
      gameLevelId = Number.isFinite(lid) ? Math.max(1, Math.min(6, Math.floor(lid))) : 1;
    },
  };
})();
