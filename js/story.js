/**
 * Shard Circuit — narrative, cinematic layouts, animated portraits.
 */
(function () {
  "use strict";

  const SPEAKER_COL = {
    nova: "#7dffb8",
    system: "#6a9aff",
    overserver: "#ff5090",
    narrator: "#c8c8e0",
  };

  const INTRO = [
    {
      speaker: "narrator",
      text: "You are Nova. The city is one big computer grid, and something inside it is waking up.",
    },
    {
      speaker: "nova",
      text: "I’m Nova Reyes. I move through the grid to steal back data before the wrong side locks it forever.",
    },
    {
      speaker: "system",
      text: "Connection shaky. Something big is online. Be careful.",
    },
    {
      speaker: "overserver",
      text: "LITTLE RUNNER. I SEE YOU. TRY TO SURVIVE MY MAZE.",
    },
    {
      speaker: "nova",
      text: "Your job: move with the arrows or WASD. Grab the green shards, then get to the exit. I’ll handle the rest—let’s go.",
    },
  ];

  const AFTER_LEVEL = {
    0: [
      {
        speaker: "overserver",
        text: "YOU FINISHED ONE ROOM. BIG DEAL.",
      },
      {
        speaker: "nova",
        text: "Baby steps. Next rooms add spikes—don’t step on the red ones.",
      },
    ],
    1: [
      {
        speaker: "narrator",
        text: "The grid gets harder on purpose. Each floor teaches one new trick.",
      },
      {
        speaker: "nova",
        text: "Blue pads teleport you to their pair. You’ll need that when a wall blocks the hallway.",
      },
    ],
    3: [
      {
        speaker: "nova",
        text: "Ice floors slide you. Tap the direction you want to go, and use the yellow boost arrows to turn.",
      },
      {
        speaker: "system",
        text: "Cold zone ahead. Sentry ahead—move while it reloads.",
      },
      {
        speaker: "overserver",
        text: "SLIDE. MISS THE SHOT. TRY AGAIN.",
      },
    ],
    5: [
      {
        speaker: "narrator",
        text: "Purple gates open and close on a timer. Pink circles warn before they zap—get out in time.",
      },
      {
        speaker: "overserver",
        text: "WAIT. RUN. WAIT. YOU ARE STILL ON MY CLOCK.",
      },
      {
        speaker: "nova",
        text: "Red turrets shoot in a line. Break their sight with walls, or dodge while they reload.",
      },
    ],
    7: [
      {
        speaker: "overserver",
        text: "YOU ARE FAST. I WILL ADD MORE TRAPS.",
      },
      {
        speaker: "nova",
        text: "Gold scrap is bonus points. Hearts and haste boosts are on the floor when you need them.",
      },
    ],
    8: [
      {
        speaker: "overserver",
        text: "ONE MORE MAZE BEFORE ME. DON’T GET COMFORTABLE.",
      },
      {
        speaker: "nova",
        text: "Big enemy in the middle—give it space. Then we end this.",
      },
    ],
    2: [
      {
        speaker: "nova",
        text: "Teleporters are the only way past that wall. Step on blue T, you pop out at blue U.",
      },
      {
        speaker: "overserver",
        text: "CLEVER. BUT THE NEXT ROOMS ADD MORE TRAPS.",
      },
    ],
    4: [
      {
        speaker: "narrator",
        text: "Gates blink open and shut. Pulses flash before they shock the floor.",
      },
      {
        speaker: "nova",
        text: "Watch the timing. Rush in the open window—then keep moving.",
      },
    ],
    6: [
      {
        speaker: "system",
        text: "Survival timer armed. Stay alive until the exit unlocks.",
      },
      {
        speaker: "overserver",
        text: "STAND STILL. LET THE CLOCK RUN. YOU WILL FAIL.",
      },
      {
        speaker: "nova",
        text: "Or I move in the safe lane and waste your bet. Next.",
      },
    ],
  };

  const SECTOR_INTRO = {
    2: [
      {
        speaker: "narrator",
        text: "Sector 2: ice floors. You slide until you hit a wall or change direction.",
      },
      {
        speaker: "nova",
        text: "Yellow arrows give a speed kick—use them to steer on ice.",
      },
    ],
    3: [
      {
        speaker: "narrator",
        text: "Sector 3: more robots and tighter rooms.",
      },
      {
        speaker: "overserver",
        text: "I ADDED SENTRIES AND CHASERS. LET’S SEE YOU DODGE.",
      },
      {
        speaker: "nova",
        text: "Space bar = short ghost mode. Save it for shots or spikes.",
      },
    ],
    4: [
      {
        speaker: "narrator",
        text: "Sector 4: last stretch before the Overserver’s core.",
      },
      {
        speaker: "nova",
        text: "Big bruisers, busy floors—then the boss. Stay sharp.",
      },
    ],
  };

  const BOSS_APPROACH = [
    {
      speaker: "overserver",
      text: "YOU MADE IT. FACE ME IN THE CORE. NO MORE MAZES—JUST POWER.",
    },
    {
      speaker: "nova",
      text: "I grab the green cores to hurt you. When you fall, I run for the exit.",
    },
    {
      speaker: "system",
      text: "Boss fight. Shards damage the Overserver. Good luck.",
    },
  ];

  const OUTRO = [
    {
      speaker: "overserver",
      text: "NO… I WAS WINNING… I WILL COME BACK…",
    },
    {
      speaker: "narrator",
      text: "The Overserver shuts down. The grid goes quiet—for now.",
    },
    {
      speaker: "nova",
      text: "We bought people some time. That’s enough for today.",
    },
    {
      speaker: "system",
      text: "Run complete. Disconnecting. Nice work, Nova.",
    },
  ];

  function getIntro() {
    return INTRO.slice();
  }

  function getAfterLevel(completedIndex) {
    return AFTER_LEVEL[completedIndex] ? AFTER_LEVEL[completedIndex].slice() : null;
  }

  function getOutro() {
    return OUTRO.slice();
  }

  /** When entering a new sector (after interstitial Continue). */
  function getSectorIntro(newSector, completedSector) {
    if (newSector == null || completedSector == null) return null;
    if (newSector <= completedSector) return null;
    const block = SECTOR_INTRO[newSector];
    return block ? block.slice() : null;
  }

  function getBossApproach() {
    return BOSS_APPROACH.slice();
  }

  function speakerColor(speaker) {
    return SPEAKER_COL[speaker] || SPEAKER_COL.narrator;
  }

  function speakerLabel(speaker) {
    if (speaker === "nova") return "NOVA REYES";
    if (speaker === "system") return "SYSTEM";
    if (speaker === "overserver") return "THE OVERSERVER";
    return "NARRATION";
  }

  /**
   * Who appears on screen + mood for CSS.
   */
  function cutsceneLayout(slide, slideIndex, script) {
    const sp = slide.speaker;
    if (sp === "narrator") return { mood: "neutral", mode: "narrator", left: null, right: null };
    if (sp === "system") return { mood: "system", mode: "system", left: null, right: null };

    const scriptBefore = script.slice(0, slideIndex);
    const villainSeen = scriptBefore.some((s) => s.speaker === "overserver");

    if (sp === "overserver") {
      return {
        mood: "threat",
        mode: "dual",
        left: "nova",
        leftDim: true,
        leftTalk: false,
        right: "overserver",
        rightDim: false,
        rightTalk: true,
      };
    }

    if (sp === "nova") {
      if (!villainSeen) {
        return { mood: "hero", mode: "solo", left: "nova", leftDim: false, leftTalk: true, right: null };
      }
      return {
        mood: "hero",
        mode: "dual",
        left: "nova",
        leftDim: false,
        leftTalk: true,
        right: "overserver",
        rightDim: true,
        rightTalk: false,
      };
    }

    return { mood: "neutral", mode: "solo", left: "nova", leftTalk: true, right: null };
  }

  function drawNova(ctx, w, h, t, talking, dim) {
    const a = dim ? 0.42 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = false;
    const bob = Math.round(Math.sin(t * 3.2) * 1.5);
    const breathe = Math.floor(t * 2) % 2;
    ctx.translate(0, bob);
    const ox = ((w - 72) / 2) | 0;
    const oy = 12 + breathe;
    ctx.fillStyle = "#0a1218";
    ctx.fillRect(ox + 8, oy + 6, 56, 72);
    ctx.fillStyle = "#1a3040";
    ctx.fillRect(ox + 12, oy + 58, 48, 14);
    ctx.fillStyle = "#7dffb8";
    ctx.fillRect(ox + 14, oy + 18, 44, 44);
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(ox + 22, oy + 8, 28, 12);
    const ant = Math.round(Math.sin(t * 8) * 1);
    ctx.fillStyle = "#00ffc8";
    ctx.fillRect(ox + 28 + ant, oy + 2, 4, 8);
    ctx.fillRect(ox + 32 + ant, oy, 2, 4);
    const jetF = Math.floor(t * 14) % 2;
    ctx.fillStyle = jetF ? "#40ffc8" : "#208868";
    ctx.fillRect(ox + 20, oy + 72, 4, 3 + jetF);
    ctx.fillRect(ox + 48, oy + 72, 4, 3 + jetF);
    ctx.fillStyle = "#0a3020";
    ctx.fillRect(ox + 20, oy + 26, 12, 10);
    ctx.fillRect(ox + 40, oy + 26, 12, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(ox + 22, oy + 28, 5, 5);
    ctx.fillRect(ox + 45, oy + 28, 5, 5);
    ctx.fillStyle = "#061810";
    ctx.fillRect(ox + 24, oy + 30, 2, 3);
    ctx.fillRect(ox + 47, oy + 30, 2, 3);
    const mouthOpen = talking && Math.floor(t * 12) % 2 === 0;
    ctx.fillStyle = "#0a3020";
    if (mouthOpen) {
      ctx.fillRect(ox + 30, oy + 42, 12, 6);
      ctx.fillStyle = "#1a5040";
      ctx.fillRect(ox + 32, oy + 44, 8, 2);
    } else ctx.fillRect(ox + 30, oy + 44, 12, 2);
    ctx.fillStyle = "#2a5060";
    ctx.fillRect(ox + 18, oy + 50, 36, 6);
    ctx.fillStyle = "#ff3d7f";
    ctx.fillRect(ox + 28, oy + 56, 16, 3);
    ctx.fillStyle = "#4a6a78";
    ctx.fillRect(ox + 6, oy + 32, 8, 28);
    ctx.fillStyle = "#00ffc8";
    ctx.fillRect(ox + 4, oy + 26, 5, 12);
    ctx.strokeStyle = dim ? "#3a5a50" : "#00ffc8";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 7, oy + 5, 58, 74);
    const arm = Math.round(Math.sin(t * 5) * 1);
    ctx.fillStyle = "#5a8090";
    ctx.fillRect(ox + 1 + arm, oy + 38, 5, 8);
    ctx.fillRect(ox + 66 - arm, oy + 38, 5, 8);
    ctx.restore();
  }

  function drawOverserver(ctx, w, h, t, talking, dim) {
    const a = dim ? 0.38 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = false;
    const hover = Math.round(Math.sin(t * 2.4) * 2);
    ctx.translate(0, hover);
    const ox = ((w - 80) / 2) | 0;
    const oy = 8;
    const pulse = 0.5 + Math.sin(t * 4) * 0.5;
    const ringF = Math.floor(t * 3) % 3;
    ctx.strokeStyle = `rgba(255,60,120,${0.25 + ringF * 0.12})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 4 - ringF, oy - 4 - ringF, 88 + ringF * 2, 96 + ringF * 2);
    ctx.fillStyle = "#0a040e";
    ctx.fillRect(ox, oy, 80, 88);
    ctx.fillStyle = `rgba(255,20,80,${0.08 + pulse * 0.12})`;
    ctx.fillRect(ox + 4, oy + 4, 72, 80);
    ctx.fillStyle = "#2a1038";
    ctx.fillRect(ox + 8, oy + 12, 64, 70);
    ctx.fillStyle = "#5a2080";
    ctx.fillRect(ox + 14, oy + 18, 52, 52);
    ctx.fillStyle = "#ff2060";
    ctx.fillRect(ox + 22, oy + 26, 36, 32);
    ctx.fillStyle = "#fff8f0";
    ctx.fillRect(ox + 26, oy + 32, 12, 12);
    ctx.fillRect(ox + 44, oy + 32, 12, 12);
    ctx.fillStyle = "#120818";
    const blink = Math.floor(t * 3) % 7 === 0 ? 1 : 0;
    if (!blink) {
      ctx.fillRect(ox + 30, oy + 36, 5, 5);
      ctx.fillRect(ox + 48, oy + 36, 5, 5);
    }
    const mouthOpen = talking && Math.floor(t * 11) % 2 === 0;
    ctx.fillStyle = "#401020";
    if (mouthOpen) {
      ctx.fillRect(ox + 32, oy + 52, 16, 10);
      ctx.fillStyle = "#ff5090";
      ctx.fillRect(ox + 34, oy + 56, 12, 3);
    } else ctx.fillRect(ox + 34, oy + 54, 12, 5);
    ctx.fillStyle = "#1a0a20";
    ctx.fillRect(ox + 10, oy + 8, 12, 10);
    ctx.fillRect(ox + 58, oy + 8, 12, 10);
    ctx.strokeStyle = dim ? "#602040" : "#ff3d7f";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 2, oy + 2, 76, 84);
    const glitch = (Math.floor(t * 20) % 5) * 2;
    if (!dim && glitch > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(ox + 20, oy + 30 + glitch, 40, 2);
    }
    const orb = Math.floor(t * 5) % 8;
    ctx.fillStyle = `rgba(255,100,180,${0.35 + (orb % 3) * 0.15})`;
    ctx.fillRect(ox + 2 + (orb % 4) * 18, oy + 70 + ((orb >> 2) % 2) * 4, 3, 3);
    ctx.fillRect(ox + 70 - (orb % 3) * 8, oy + 4, 2, 2);
    const coreF = Math.floor(t * 12) % 2;
    ctx.fillStyle = coreF ? "#ff80b0" : "#ff2060";
    ctx.fillRect(ox + 36, oy + 38, 8, 8);
    ctx.restore();
  }

  function drawSystem(ctx, w, h, t) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const cx = (w / 2) | 0;
    ctx.fillStyle = "#040a18";
    ctx.fillRect(cx - 48, 8, 96, 80);
    ctx.strokeStyle = "#6a9aff";
    ctx.strokeRect(cx - 48, 8, 96, 80);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? "#102848" : "#0a1830";
      ctx.fillRect(cx - 40 + i * 12, 24, 10, 40);
    }
    ctx.fillStyle = "#6a9aff";
    ctx.fillRect(cx - 28, 36, 56, 20);
    ctx.fillStyle = "#00ffc8";
    const scan = (t * 8) % 22;
    ctx.fillRect(cx - 26, 36 + scan, 52, 2);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    const led = Math.floor(t * 6) % 2;
    ctx.fillRect(cx + 38, 14, 3, 3);
    if (led) ctx.fillRect(cx + 34, 18, 2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GRID", cx, 72);
    ctx.textAlign = "left";
    const blink = Math.floor(t * 4) % 2;
    ctx.strokeStyle = blink ? "#6a9aff" : "#4a6aaa";
    ctx.strokeRect(cx - 46, 6, 92, 84);
    ctx.restore();
  }

  function drawNarratorMark(ctx, w, h, t) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const ox = ((w - 80) / 2) | 0;
    ctx.fillStyle = "#12121c";
    ctx.fillRect(ox, 20, 80, 64);
    ctx.strokeStyle = "#6a6a90";
    ctx.strokeRect(ox, 20, 80, 64);
    for (let i = 0; i < 6; i++) {
      const y = 32 + i * 8;
      const shift = Math.sin(t * 2 + i) * 2;
      ctx.fillStyle = `rgba(200,200,220,${0.15 + i * 0.06})`;
      ctx.fillRect(ox + 8 + shift, y, 64, 3);
    }
    const br = Math.floor(t * 3) % 2;
    ctx.strokeStyle = `rgba(180,180,210,${0.4 + br * 0.3})`;
    ctx.strokeRect(ox + 4, 24, 72, 56);
    ctx.fillStyle = `rgba(100,100,140,${0.2 + Math.sin(t * 4) * 0.1})`;
    ctx.fillRect(ox + 12, 44, 56, 16);
    ctx.restore();
  }

  /** Legacy single canvas */
  function drawPortrait(speaker, ctx, w, h) {
    drawPortraitFrame(speaker, ctx, w, h, 0, true, false);
  }

  const PORTRAIT_VW = 140;
  const PORTRAIT_VH = 140;

  function drawPortraitFrame(speaker, ctx, w, h, timeSec, talking, dim) {
    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / PORTRAIT_VW, h / PORTRAIT_VH);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate((w - PORTRAIT_VW * scale) * 0.5, (h - PORTRAIT_VH * scale) * 0.5);
    ctx.scale(scale, scale);
    if (speaker === "nova") drawNova(ctx, PORTRAIT_VW, PORTRAIT_VH, timeSec, talking, dim);
    else if (speaker === "overserver") drawOverserver(ctx, PORTRAIT_VW, PORTRAIT_VH, timeSec, talking, dim);
    else if (speaker === "system") drawSystem(ctx, PORTRAIT_VW, PORTRAIT_VH, timeSec);
    else drawNarratorMark(ctx, PORTRAIT_VW, PORTRAIT_VH, timeSec);
    ctx.restore();
  }

  window.GRPStory = {
    getIntro,
    getAfterLevel,
    getOutro,
    getSectorIntro,
    getBossApproach,
    speakerColor,
    speakerLabel,
    cutsceneLayout,
    drawPortrait,
    drawPortraitFrame,
  };
})();
