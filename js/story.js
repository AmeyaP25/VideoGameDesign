/**
 * Shard Circuit — narrative, cinematic layouts, animated portraits.
 */
(function () {
  "use strict";

  const SPEAKER_COL = {
    nova: "#f0b060",
    system: "#7ab0ff",
    overserver: "#e07050",
    narrator: "#b8b8c8",
  };

  const INTRO = [
    {
      speaker: "narrator",
      text: "There’s a basement under the transit yards nobody maps anymore. The lights still blink. Something’s chewing power down there.",
    },
    {
      speaker: "nova",
      text: "Juno Hale. Job was dumb on paper—pull “archive keys” off a dead rack. Client didn’t mention the place arguing back.",
    },
    {
      speaker: "system",
      text: "Comm check… link’s noisy. Heavy process just came online two floors under you.",
    },
    {
      speaker: "overserver",
      text: "Visitor logged. Cute. Try not to scuff the tile.",
    },
    {
      speaker: "nova",
      text: "WASD or arrows to move. Pick up the green chips, then bail through the exit when you’ve got enough. Try not to step in anything red.",
    },
  ];

  const AFTER_LEVEL = {
    0: [
      {
        speaker: "overserver",
        text: "One room. You want a ribbon?",
      },
      {
        speaker: "nova",
        text: "Next stretch has spikes. If it’s red and on the floor, it’s not decoration.",
      },
    ],
    1: [
      {
        speaker: "narrator",
        text: "Whoever built this wasn’t trying to be fair—they were trying to teach habits.",
      },
      {
        speaker: "nova",
        text: "See a T on the floor? Paired with a U somewhere else. It’s a dumb shortcut, but it’s yours.",
      },
    ],
    3: [
      {
        speaker: "nova",
        text: "Ice doesn’t care about your dignity—you slide until you hit a wall or steer. Yellow arrows shove you harder; use that.",
      },
      {
        speaker: "system",
        text: "Sentry line-of-sight ahead. Move between its shots.",
      },
      {
        speaker: "overserver",
        text: "Skate, little thief. Let’s see the footwork.",
      },
    ],
    5: [
      {
        speaker: "narrator",
        text: "Gates stutter open and closed. Pulse tiles warm up pink before they bite.",
      },
      {
        speaker: "overserver",
        text: "Hurry up. Wait. Hurry up. Boring yet?",
      },
      {
        speaker: "nova",
        text: "Turrets need a straight line—break it with a corner or keep strafing while they reload.",
      },
    ],
    7: [
      {
        speaker: "overserver",
        text: "You’re quick. I can add weight.",
      },
      {
        speaker: "nova",
        text: "Gold scrap pads the score. Hearts and haste pickups are lying around if you’re greedy.",
      },
    ],
    8: [
      {
        speaker: "overserver",
        text: "After this, we talk face to face. Metaphorically.",
      },
      {
        speaker: "nova",
        text: "Big thing in the pit—don’t hug it. Clear the room, then we finish the job.",
      },
    ],
    2: [
      {
        speaker: "nova",
        text: "Wall in the way? Teleporter pair’s the only door. Step on T, you wake up on U.",
      },
      {
        speaker: "overserver",
        text: "Smart. The building’s still meaner than you.",
      },
    ],
    4: [
      {
        speaker: "narrator",
        text: "Timing floors. Learn the rhythm or donate another shoe.",
      },
      {
        speaker: "nova",
        text: "Blink through when the gate’s up; don’t stand on the warning tiles.",
      },
    ],
    6: [
      {
        speaker: "system",
        text: "Timer armed. Exit stays sealed until you’ve survived the window.",
      },
      {
        speaker: "overserver",
        text: "Freeze and fry. Move and maybe not. Pick one.",
      },
      {
        speaker: "nova",
        text: "Or I keep jogging in the boring safe lane and you lose your bet. Moving on.",
      },
    ],
  };

  const SECTOR_INTRO = {
    2: [
      {
        speaker: "narrator",
        text: "Sector 2—someone waxed the concrete. You’ll glide until something stops you.",
      },
      {
        speaker: "nova",
        text: "Boost pads shove harder than your boots can. Aim before you hit them.",
      },
    ],
    3: [
      {
        speaker: "narrator",
        text: "Sector 3—more metal in the hallways, less room to hide.",
      },
      {
        speaker: "overserver",
        text: "I borrowed a few guard routines. Don’t take it personally.",
      },
      {
        speaker: "nova",
        text: "If you’ve got a sidearm, Space fires it—your last move aim picks the angle.",
      },
    ],
    4: [
      {
        speaker: "narrator",
        text: "Sector 4—last floors before the rack’s angry landlord shows up.",
      },
      {
        speaker: "nova",
        text: "Heavy units, messy wiring, then the big room. Don’t save ammo for a photo.",
      },
    ],
  };

  const BOSS_APPROACH = [
    {
      speaker: "overserver",
      text: "End of the tour. No more puzzles—just me and the fine print.",
    },
    {
      speaker: "nova",
      text: "Every chip you lose and every swing I land scrapes your bar. You bottom out—I’m walking out that door.",
    },
    {
      speaker: "system",
      text: "Boss engagement. Chips apply damage on pickup—don’t get cute.",
    },
  ];

  const OUTRO = [
    {
      speaker: "overserver",
      text: "Fine. Reboot me. I’ll remember the grudge in the logs.",
    },
    {
      speaker: "narrator",
      text: "Fans spin down. For a minute the basement sounds like a basement again.",
    },
    {
      speaker: "nova",
      text: "Client gets their keys. I get paid. Nobody needs a speech.",
    },
    {
      speaker: "system",
      text: "Session closed. Juno—good hustle. Out.",
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
    if (speaker === "nova") return "JUNO HALE";
    if (speaker === "system") return "COMM";
    if (speaker === "overserver") return "CINDER";
    return "LOG";
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
    ctx.fillStyle = "#3a5a62";
    ctx.fillRect(ox + 14, oy + 18, 44, 44);
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(ox + 22, oy + 8, 28, 12);
    const ant = Math.round(Math.sin(t * 8) * 1);
    ctx.fillStyle = "#ffb040";
    ctx.fillRect(ox + 28 + ant, oy + 2, 4, 8);
    ctx.fillRect(ox + 32 + ant, oy, 2, 4);
    const jetF = Math.floor(t * 14) % 2;
    ctx.fillStyle = jetF ? "#ff9a3c" : "#b86220";
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
    ctx.fillStyle = "#d08030";
    ctx.fillRect(ox + 4, oy + 26, 5, 12);
    ctx.strokeStyle = dim ? "#4a5048" : "#e89840";
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
    ctx.strokeStyle = `rgba(220,90,50,${0.28 + ringF * 0.1})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 4 - ringF, oy - 4 - ringF, 88 + ringF * 2, 96 + ringF * 2);
    ctx.fillStyle = "#0a040e";
    ctx.fillRect(ox, oy, 80, 88);
    ctx.fillStyle = `rgba(200,60,40,${0.1 + pulse * 0.14})`;
    ctx.fillRect(ox + 4, oy + 4, 72, 80);
    ctx.fillStyle = "#1a1018";
    ctx.fillRect(ox + 8, oy + 12, 64, 70);
    ctx.fillStyle = "#4a2820";
    ctx.fillRect(ox + 14, oy + 18, 52, 52);
    ctx.fillStyle = "#c84828";
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
      ctx.fillStyle = "#ff7848";
      ctx.fillRect(ox + 34, oy + 56, 12, 3);
    } else ctx.fillRect(ox + 34, oy + 54, 12, 5);
    ctx.fillStyle = "#1a0a20";
    ctx.fillRect(ox + 10, oy + 8, 12, 10);
    ctx.fillRect(ox + 58, oy + 8, 12, 10);
    ctx.strokeStyle = dim ? "#604038" : "#e06040";
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
    ctx.fillText("COMM", cx, 72);
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
