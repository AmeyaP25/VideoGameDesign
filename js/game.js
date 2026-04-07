/**
 * Shard Circuit — tile-based levels, objectives, procedural audio via GRPAudio.
 */
(function () {
  "use strict";

  const { LEVELS, COLS, ROWS } = window.GRPLevels;
  const A = window.GRPAudio;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const W = canvas.width;
  const H = canvas.height;

  const TILE = 16;
  const ORIGIN_Y = 2;
  const PLAYER_W = 9;
  const PLAYER_H = 12;
  const SPEED = 56;
  const COMBO_WINDOW = 1.35;
  const SHARD_VALUE = 100;
  const START_LIVES = 3;
  const INVULN_HIT = 2.0;
  const HIT_COOLDOWN_TILE = 0.55;
  const PULSE_CYCLE = 1.85;
  const PULSE_WARN = 0.95;
  const PULSE_ACTIVE = 0.22;
  const PULSE_R = 14;
  const GATE_FREQ = 0.85;
  const SCRAP_VALUE = 42;
  const MAX_LIVES = 6;
  const BOOST_PAD_MULT = 1.62;
  const ICE_LERP = 6;
  const TELEPORT_COOLDOWN = 0.52;
  const SECTOR_COUNT = 4;
  const PROJ_SZ = 4;
  const PROJ_SPEED = 76;
  const BOSS_BURST_PERIOD = 1.28;
  const BOSS_PROJ_SPEED = 72;
  const PLAYER_RAY_SZ = 5;
  const PLAYER_RAY_SPEED = 102;
  const PLAYER_RAY_CD = 0.28;
  const PLAYER_SABER_CD = 0.38;
  const RAY_DMG_BOSS = 7;
  const SABER_DMG_BOSS = 14;

  const DT = 1 / 60;
  const MAX_STEPS = 6;

  let state = "menu";
  let lastT = 0;
  let acc = 0;

  let levelIndex = 0;
  let level = null;
  let levelTime = 0;
  let lastGateFlip = -1;

  let player = { x: 0, y: 0, vx: 0, vy: 0 };
  let spawnPx = 0;
  let spawnPy = 0;
  let score = 0;
  let lives = START_LIVES;
  let shardsCollected = 0;
  let shards = [];
  let scraps = [];
  let powerups = [];
  let enemies = [];
  let projectiles = [];
  let playerShots = [];
  let particles = [];
  let floatTexts = [];
  let trail = [];
  let stars = [];
  let pvx = 0;
  let pvy = 0;
  let speedBoostTimer = 0;
  let teleportCd = 0;
  let scrapCollected = 0;

  let combo = 1;
  let comboTimer = 0;
  let invuln = 0;
  let hazardCd = 0;
  let shake = 0;

  let lastMusicSector = 0;

  let weaponMode = null;
  let weaponCd = 0;
  let lastAimX = 1;
  let lastAimY = 0;

  const keys = Object.create(null);
  const overlay = document.getElementById("overlay");
  const panelTitle = document.getElementById("panelTitle");
  const panelText = document.getElementById("panelText");
  const btnStart = document.getElementById("btnStart");
  const scoreLabel = document.getElementById("scoreLabel");
  const comboLabel = document.getElementById("comboLabel");
  const levelLabel = document.getElementById("levelLabel");
  const sectorLabel = document.getElementById("sectorLabel");
  const livesLabel = document.getElementById("livesLabel");
  const objectiveLine = document.getElementById("objectiveLine");
  const scrapLabel = document.getElementById("scrapLabel");
  const homeScreen = document.getElementById("homeScreen");
  const gameWrap = document.getElementById("wrap");
  const btnHomePlay = document.getElementById("btnHomePlay");
  const homeStartLevel = document.getElementById("homeStartLevel");
  const homeVolMusic = document.getElementById("homeVolMusic");
  const homeVolSfx = document.getElementById("homeVolSfx");

  const cutsceneEl = document.getElementById("cutscene");
  const cutsceneFx = document.getElementById("cutsceneFx");
  const cutsceneChapter = document.getElementById("cutsceneChapter");
  const cutsceneSlotLeft = document.getElementById("cutsceneSlotLeft");
  const cutsceneSlotRight = document.getElementById("cutsceneSlotRight");
  const portraitLeft = document.getElementById("portraitLeft");
  const portraitRight = document.getElementById("portraitRight");
  let portraitLeftCtx = portraitLeft ? portraitLeft.getContext("2d", { alpha: false }) : null;
  let portraitRightCtx = portraitRight ? portraitRight.getContext("2d", { alpha: false }) : null;

  function ensurePortraitContexts() {
    if (portraitLeft && !portraitLeftCtx) portraitLeftCtx = portraitLeft.getContext("2d", { alpha: false });
    if (portraitRight && !portraitRightCtx) portraitRightCtx = portraitRight.getContext("2d", { alpha: false });
  }

  /** Keep home hidden and game visible (fixes cutscene → title screen stacking bugs). */
  function showPlayingLayout() {
    if (homeScreen) {
      homeScreen.hidden = true;
      homeScreen.setAttribute("aria-hidden", "true");
    }
    if (gameWrap) gameWrap.hidden = false;
    if (overlay) overlay.hidden = true;
  }
  const cutsceneCharacters = document.getElementById("cutsceneCharacters");
  const cutsceneSpeaker = document.getElementById("cutsceneSpeaker");
  const cutsceneLine = document.getElementById("cutsceneLine");
  const btnCutsceneNext = document.getElementById("btnCutsceneNext");
  const Story = window.GRPStory;
  const Home = window.GRPHome;

  let cutsceneSlides = null;
  let cutsceneIndex = 0;
  let cutsceneOnDone = null;
  let cutsceneTime = 0;
  let cutsceneFxCtx = cutsceneFx ? cutsceneFx.getContext("2d", { alpha: false }) : null;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function gateSolid() {
    return (Math.floor(levelTime * GATE_FREQ) & 1) === 0;
  }

  function tileType(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return 1;
    return level.tiles[cy][cx];
  }

  function isSolid(cx, cy) {
    const t = tileType(cx, cy);
    if (t === 1) return true;
    if (t === 4) return gateSolid();
    return false;
  }

  function cellRect(cx, cy) {
    return { x: cx * TILE, y: ORIGIN_Y + cy * TILE, w: TILE, h: TILE };
  }

  function overlapSolid(px, py, pw, ph) {
    const x0 = Math.floor(px / TILE);
    const x1 = Math.floor((px + pw - 0.001) / TILE);
    const y0 = Math.floor((py - ORIGIN_Y) / TILE);
    const y1 = Math.floor((py + ph - 0.001 - ORIGIN_Y) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (isSolid(cx, cy)) {
          const r = cellRect(cx, cy);
          if (aabb(px, py, pw, ph, r.x, r.y, r.w, r.h)) return true;
        }
      }
    }
    return false;
  }

  function centerTileAt(px, py) {
    const cx = Math.floor((px + PLAYER_W * 0.5) / TILE);
    const cy = Math.floor((py + PLAYER_H * 0.5 - ORIGIN_Y) / TILE);
    return tileType(cx, cy);
  }

  function centerMud(px, py) {
    return centerTileAt(px, py) === 2;
  }

  function centerDamageTile(px, py) {
    return centerTileAt(px, py) === 3;
  }

  function centerIce(px, py) {
    return centerTileAt(px, py) === 5;
  }

  function centerBoost(px, py) {
    return centerTileAt(px, py) === 6;
  }

  function sectorAccent() {
    const s = level ? level.sector : 1;
    if (s >= 6) return { w: 50, w2: 30, m: "#2a2040", a: "#8040ff" };
    if (s >= 5) return { w: 45, w2: 35, m: "#203040", a: "#40a8ff" };
    if (s >= 3) return { w: 42, w2: 26, m: "#302030", a: "#ff5090" };
    return { w: 42, w2: 26, m: "#1a1a28", a: "#00ffc8" };
  }

  function moveAndCollide(px, py, pw, ph, dx, dy) {
    let x = px + dx;
    if (overlapSolid(x, py, pw, ph)) x = px;
    let y = py + dy;
    if (overlapSolid(x, y, pw, ph)) y = py;
    return { x, y };
  }

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < 36; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (ROWS * TILE),
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  function addParticles(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 35 + Math.random() * 70;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.35 + Math.random() * 0.2,
        t: 0,
        col,
      });
    }
  }

  function popFloat(x, y, text, col) {
    floatTexts.push({ x, y, text, t: 0, life: 0.85, col: col || "#fff8a0" });
  }

  function applyVolumes() {
    const mRaw = homeVolMusic ? parseInt(homeVolMusic.value, 10) : 70;
    const sRaw = homeVolSfx ? parseInt(homeVolSfx.value, 10) : 80;
    const m = (Number.isFinite(mRaw) ? mRaw : 70) / 100;
    const s = (Number.isFinite(sRaw) ? sRaw : 80) / 100;
    A.setVolumes(m, s);
  }

  function resizeCutsceneFx() {
    if (!cutsceneFx || !cutsceneFxCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rw = cutsceneFx.clientWidth || window.innerWidth;
    const rh = cutsceneFx.clientHeight || window.innerHeight;
    cutsceneFx.width = Math.floor(rw * dpr);
    cutsceneFx.height = Math.floor(rh * dpr);
    cutsceneFxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function syncCutscenePortraitBitmapSizes(layout) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const syncOne = (canvas) => {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const bw = Math.max(140, Math.round(r.width * dpr)) || 280;
      const bh = Math.max(140, Math.round(r.height * dpr)) || 280;
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
    };
    syncOne(portraitLeft);
    if (layout && layout.mode === "dual") syncOne(portraitRight);
  }

  function onCutsceneViewportResize() {
    resizeCutsceneFx();
    if (state === "cutscene" && cutsceneSlides && Story && cutsceneIndex < cutsceneSlides.length) {
      const slide = cutsceneSlides[cutsceneIndex];
      const layout = Story.cutsceneLayout(slide, cutsceneIndex, cutsceneSlides);
      syncCutscenePortraitBitmapSizes(layout);
      refreshCutsceneVisuals();
    }
  }

  function drawCutsceneFxLayer() {
    if (!cutsceneFx || !cutsceneFxCtx || !cutsceneSlides) return;
    const slide = cutsceneSlides[cutsceneIndex];
    if (!slide) return;
    const layout = Story.cutsceneLayout(slide, cutsceneIndex, cutsceneSlides);
    const mood = layout.mood;
    const W = cutsceneFx.clientWidth || window.innerWidth;
    const H = cutsceneFx.clientHeight || window.innerHeight;
    const f = cutsceneFxCtx;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.clearRect(0, 0, cutsceneFx.width, cutsceneFx.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mood === "threat") {
      f.fillStyle = `rgba(80,0,30,${0.08 + Math.sin(cutsceneTime * 2) * 0.04})`;
      f.fillRect(0, 0, W, H);
    } else if (mood === "system") {
      f.fillStyle = "rgba(20,40,100,0.1)";
      f.fillRect(0, 0, W, H);
      f.strokeStyle = "rgba(100,160,255,0.15)";
      for (let y = (cutsceneTime * 40) % 20; y < H; y += 20) {
        f.beginPath();
        f.moveTo(0, y);
        f.lineTo(W, y);
        f.stroke();
      }
    } else {
      f.fillStyle = "rgba(0,50,55,0.06)";
      f.fillRect(0, 0, W, H);
    }
    f.fillStyle = "rgba(0,0,0,0.04)";
    for (let y = 0; y < H; y += 3) f.fillRect(0, y, W, 1);
    const scan = (cutsceneTime * 100) % 100;
    f.fillStyle = `rgba(255,255,255,${0.02 + (scan / 100) * 0.03})`;
    f.fillRect(0, (cutsceneTime * 60) % H, W, 2);
  }

  function refreshCutsceneVisuals() {
    if (!Story || !cutsceneSlides || cutsceneIndex >= cutsceneSlides.length) return;
    const slide = cutsceneSlides[cutsceneIndex];
    const layout = Story.cutsceneLayout(slide, cutsceneIndex, cutsceneSlides);
    cutsceneEl.dataset.mood = layout.mood;
    const layKey = layout.mode === "dual" ? "dual" : "solo";
    cutsceneEl.dataset.layout = layKey;
    if (cutsceneCharacters) cutsceneCharacters.dataset.layout = layKey;
    syncCutscenePortraitBitmapSizes(layout);
    drawCutsceneFxLayer();

    if (!portraitLeftCtx || !portraitRightCtx || !cutsceneSlotLeft || !cutsceneSlotRight) return;

    const PW = portraitLeft.width;
    const PH = portraitLeft.height;

    const clearSlots = () => {
      cutsceneSlotLeft.className = "cutscene-slot cutscene-slot-left";
      cutsceneSlotRight.className = "cutscene-slot cutscene-slot-right";
    };

    clearSlots();

    if (layout.mode === "solo") {
      cutsceneSlotLeft.hidden = false;
      cutsceneSlotRight.hidden = true;
      cutsceneSlotLeft.classList.add("is-active");
      Story.drawPortraitFrame(layout.left, portraitLeftCtx, PW, PH, cutsceneTime, layout.leftTalk, false);
    } else if (layout.mode === "narrator") {
      cutsceneSlotLeft.hidden = false;
      cutsceneSlotRight.hidden = true;
      cutsceneSlotLeft.classList.add("is-active");
      Story.drawPortraitFrame("narrator", portraitLeftCtx, PW, PH, cutsceneTime, true, false);
    } else if (layout.mode === "system") {
      cutsceneSlotLeft.hidden = false;
      cutsceneSlotRight.hidden = true;
      cutsceneSlotLeft.classList.add("is-active");
      Story.drawPortraitFrame("system", portraitLeftCtx, PW, PH, cutsceneTime, true, false);
    } else if (layout.mode === "dual") {
      cutsceneSlotLeft.hidden = false;
      cutsceneSlotRight.hidden = false;
      if (layout.leftTalk) cutsceneSlotLeft.classList.add("is-active");
      else cutsceneSlotLeft.classList.add("is-dim");
      if (layout.rightTalk) cutsceneSlotRight.classList.add("is-active");
      else cutsceneSlotRight.classList.add("is-dim");
      Story.drawPortraitFrame(layout.left, portraitLeftCtx, PW, PH, cutsceneTime, layout.leftTalk, layout.leftDim);
      Story.drawPortraitFrame(layout.right, portraitRightCtx, PW, PH, cutsceneTime, layout.rightTalk, layout.rightDim);
    }
  }

  function showCutsceneSlide() {
    if (!Story || !cutsceneSlides || cutsceneIndex >= cutsceneSlides.length) return;
    const slide = cutsceneSlides[cutsceneIndex];
    cutsceneTime = 0;
    cutsceneSpeaker.textContent = Story.speakerLabel(slide.speaker);
    cutsceneSpeaker.style.color = Story.speakerColor(slide.speaker);
    cutsceneLine.textContent = slide.text;
    resizeCutsceneFx();
    refreshCutsceneVisuals();
    requestAnimationFrame(() => {
      if (state !== "cutscene" || !cutsceneSlides || cutsceneIndex >= cutsceneSlides.length || !Story) return;
      const s = cutsceneSlides[cutsceneIndex];
      const layout = Story.cutsceneLayout(s, cutsceneIndex, cutsceneSlides);
      syncCutscenePortraitBitmapSizes(layout);
      refreshCutsceneVisuals();
    });
  }

  function endCutscene() {
    window.removeEventListener("resize", onCutsceneViewportResize);
    cutsceneEl.hidden = true;
    cutsceneSlides = null;
    cutsceneIndex = 0;
    cutsceneTime = 0;
    const cb = cutsceneOnDone;
    cutsceneOnDone = null;
    A.setPaused(false);
    if (cb) cb();
  }

  function beginCutscene(slides, onDone, chapterLabel) {
    ensurePortraitContexts();
    if (!cutsceneEl || !Story || !portraitLeftCtx || !portraitRightCtx) {
      if (onDone) onDone();
      return;
    }
    if (!slides || slides.length === 0) {
      if (onDone) onDone();
      return;
    }
    cutsceneSlides = slides;
    cutsceneIndex = 0;
    cutsceneOnDone = onDone;
    state = "cutscene";
    A.setPaused(true);
    cutsceneEl.hidden = false;
    if (cutsceneChapter) cutsceneChapter.textContent = chapterLabel || "TRANSMISSION";
    resizeCutsceneFx();
    window.addEventListener("resize", onCutsceneViewportResize);
    showCutsceneSlide();
    A.playSfx("ui_open");
    btnCutsceneNext.focus();
  }

  function advanceCutscene() {
    if (state !== "cutscene" || !cutsceneSlides) return;
    cutsceneIndex++;
    A.playSfx("ui_confirm");
    if (cutsceneIndex >= cutsceneSlides.length) {
      endCutscene();
      return;
    }
    showCutsceneSlide();
  }

  function spawnWorldFromTile(tx, ty, ew, eh) {
    return {
      x: tx * TILE + (TILE - ew) * 0.5,
      y: ORIGIN_Y + ty * TILE + (TILE - eh) * 0.5,
    };
  }

  function loadLevel(idx) {
    levelIndex = clamp(idx, 0, LEVELS.length - 1);
    level = LEVELS[levelIndex];
    levelTime = 0;
    lastGateFlip = Math.floor(levelTime * GATE_FREQ);

    shards.length = 0;
    for (const s of level.shardSpawns) {
      const cx = s.tx * TILE + (TILE - 6) * 0.5;
      const cy = ORIGIN_Y + s.ty * TILE + (TILE - 6) * 0.5;
      shards.push({ x: cx, y: cy, w: 6, h: 6, pulse: Math.random() * 2, taken: false });
    }
    shardsCollected = 0;
    scrapCollected = 0;

    scraps.length = 0;
    for (const s of level.scrapSpawns || []) {
      const cx = s.tx * TILE + (TILE - 5) * 0.5;
      const cy = ORIGIN_Y + s.ty * TILE + (TILE - 5) * 0.5;
      scraps.push({ x: cx, y: cy, w: 5, h: 5, pulse: Math.random() * 2, taken: false });
    }
    powerups.length = 0;
    for (const pu of level.powerSpawns || []) {
      const pos = spawnWorldFromTile(pu.tx, pu.ty, 7, 7);
      powerups.push({
        x: pos.x,
        y: pos.y,
        w: 7,
        h: 7,
        kind: pu.kind,
        taken: false,
        bob: Math.random() * 5,
      });
    }
    projectiles.length = 0;
    playerShots.length = 0;
    floatTexts.length = 0;
    trail.length = 0;
    pvx = 0;
    pvy = 0;
    speedBoostTimer = 0;
    teleportCd = 0;
    weaponCd = 0;
    weaponMode = level.isBoss ? "boss_saber" : null;
    lastAimX = 1;
    lastAimY = 0;

    const p = spawnWorldFromTile(level.spawn.tx, level.spawn.ty, PLAYER_W, PLAYER_H);
    player.x = p.x;
    player.y = p.y;
    spawnPx = p.x;
    spawnPy = p.y;

    enemies.length = 0;
    for (const e of level.enemies) {
      if (e.type === "patrol") {
        const w = 12;
        const h = 8;
        const pos = spawnWorldFromTile(e.tx, e.ty, w, h);
        const spd = e.speed || 40;
        enemies.push({
          type: "patrol",
          x: pos.x,
          y: pos.y,
          w,
          h,
          vx: e.axis === "v" ? 0 : spd,
          vy: e.axis === "v" ? spd : 0,
          axis: e.axis || "h",
          spd,
        });
      } else if (e.type === "pursuer") {
        const w = 11;
        const h = 10;
        const pos = spawnWorldFromTile(e.tx, e.ty, w, h);
        enemies.push({
          type: "pursuer",
          x: pos.x,
          y: pos.y,
          w,
          h,
          spd: e.speed || 30,
        });
      } else if (e.type === "titan") {
        const w = 22;
        const h = 14;
        const pos = spawnWorldFromTile(e.tx, e.ty, w, h);
        enemies.push({
          type: "titan",
          x: pos.x,
          y: pos.y,
          w,
          h,
          spd: e.speed || 16,
        });
      } else if (e.type === "sentry") {
        const w = 9;
        const h = 9;
        const pos = spawnWorldFromTile(e.tx, e.ty, w, h);
        enemies.push({
          type: "sentry",
          x: pos.x,
          y: pos.y,
          w,
          h,
          period: e.period || 1.65,
          timer: Math.random() * 0.6,
        });
      } else if (e.type === "boss") {
        const w = 40;
        const h = 30;
        const pos = spawnWorldFromTile(e.tx, e.ty, w, h);
        const hp = e.hp || 80;
        enemies.push({
          type: "boss",
          x: pos.x,
          y: pos.y,
          w,
          h,
          hp,
          maxHp: hp,
          dead: false,
          spd: e.speed || 10,
          burstTimer: 0.8,
        });
      }
    }

    combo = 1;
    comboTimer = 0;
    invuln = 0.5;
    hazardCd = 0;
  }

  function newRun(startLevelIdx) {
    score = 0;
    lives = START_LIVES;
    const idx = clamp(
      startLevelIdx == null || !Number.isFinite(Number(startLevelIdx)) ? 0 : Number(startLevelIdx),
      0,
      LEVELS.length - 1
    );
    levelIndex = idx;
    loadLevel(idx);
    lastMusicSector = level.sector;
  }

  function shardsRequired() {
    if (!level) return 0;
    const o = level.objective;
    if (o.kind === "boss_exit") return 0;
    if (o.kind === "collect_exit") return level.shardTotal;
    if (o.kind === "subset_exit") return o.min;
    return 0;
  }

  function bossEntity() {
    return enemies.find((e) => e.type === "boss");
  }

  function damageBossWeapon(b, dmg, popX, popY) {
    if (!b || b.dead) return;
    b.hp -= dmg;
    popFloat(popX, popY, `-${dmg}`, "#8af8ff");
    addParticles(b.x + b.w * 0.5, b.y + b.h * 0.5, "#40e8ff", 14);
    A.playSfx("pulse_zap", { pitch: 14 });
    if (b.hp <= 0) {
      b.dead = true;
      b.hp = 0;
      shake = 0.55;
      addParticles(b.x + b.w * 0.5, b.y + b.h * 0.5, "#ffffff", 28);
      A.playSfx("level_complete");
    }
  }

  function tryFireWeapon() {
    if (state !== "playing" || !weaponMode || weaponCd > 0) return;
    const ax = lastAimX;
    const ay = lastAimY;
    const len = Math.hypot(ax, ay) || 1;
    const nx = ax / len;
    const ny = ay / len;
    const cx = player.x + PLAYER_W * 0.5;
    const cy = player.y + PLAYER_H * 0.5;
    if (weaponMode === "raygun") {
      weaponCd = PLAYER_RAY_CD;
      const pw = PLAYER_RAY_SZ;
      const ph = PLAYER_RAY_SZ;
      let bx = cx - pw * 0.5;
      let by = cy - ph * 0.5;
      for (let step = 0; step < 8; step++) {
        const dist = 5 + step * 4;
        const tx = cx + nx * dist - pw * 0.5;
        const ty = cy + ny * dist - ph * 0.5;
        if (!overlapSolid(tx, ty, pw, ph)) {
          bx = tx;
          by = ty;
          break;
        }
      }
      playerShots.push({
        x: bx,
        y: by,
        vx: nx * PLAYER_RAY_SPEED,
        vy: ny * PLAYER_RAY_SPEED,
        life: 2.6,
        kind: "ray",
      });
      A.playSfx("ray_fire");
    } else if (weaponMode === "boss_saber") {
      weaponCd = PLAYER_SABER_CD;
      playerShots.push({
        x: cx + nx * 6 - 6,
        y: cy + ny * 6 - 3,
        w: 12,
        h: 6,
        vx: nx * 200,
        vy: ny * 200,
        life: 0.24,
        kind: "saber",
      });
      A.playSfx("saber_swing");
    }
  }

  function exitUnlocked() {
    if (!level) return false;
    const o = level.objective;
    if (o.kind === "survive_exit") return levelTime >= o.seconds;
    if (o.kind === "boss_exit") {
      const b = bossEntity();
      return !!(b && b.dead);
    }
    return shardsCollected >= shardsRequired();
  }

  function exitRect() {
    const r = cellRect(level.exit.tx, level.exit.ty);
    return r;
  }

  function playerHit(source) {
    if (invuln > 0) return;
    lives -= 1;
    combo = 1;
    comboTimer = 0;
    invuln = INVULN_HIT;
    hazardCd = HIT_COOLDOWN_TILE;
    shake = 0.4;
    A.playSfx("hit");
    addParticles(player.x + PLAYER_W * 0.5, player.y + PLAYER_H * 0.5, "#ff3d7f", 12);
    if (lives <= 0) {
      state = "gameover";
      A.stopMusic();
      A.playSfx("game_over");
      showOverlay();
      return;
    }
    player.x = spawnPx;
    player.y = spawnPy;
  }

  function completeLevel() {
    if (state !== "playing") return;
    A.playSfx("exit_touch");
    A.playSfx("level_complete");
    const next = LEVELS[levelIndex + 1];
    if (level && next && level.sector < next.sector) A.playSfx("sector_complete");

    if (levelIndex >= LEVELS.length - 1) {
      A.stopMusic();
      beginCutscene(
        Story ? Story.getOutro() : [],
        () => {
          state = "winall";
          A.playSfx("win_game");
          showOverlay();
        },
        "EPILOGUE"
      );
      return;
    }

    A.playSfx("transition");
    const mid = Story && Story.getAfterLevel(levelIndex);
    if (mid && mid.length) {
      beginCutscene(
        mid,
        () => {
          state = "interstitial";
          showOverlay();
        },
        "FIELD LOG"
      );
    } else {
      state = "interstitial";
      showOverlay();
    }
  }

  function update(dt) {
    if (state !== "playing") return;

    levelTime += dt;
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0) combo = 1;

    invuln = Math.max(0, invuln - dt);
    hazardCd = Math.max(0, hazardCd - dt);
    weaponCd = Math.max(0, weaponCd - dt);
    speedBoostTimer = Math.max(0, speedBoostTimer - dt);
    teleportCd = Math.max(0, teleportCd - dt);

    const gf = Math.floor(levelTime * GATE_FREQ);
    if (gf !== lastGateFlip) {
      lastGateFlip = gf;
      A.playSfx("gate_toggle");
    }

    let ix = 0,
      iy = 0;
    if (keys.ArrowLeft || keys.a || keys.A) ix -= 1;
    if (keys.ArrowRight || keys.d || keys.D) ix += 1;
    if (keys.ArrowUp || keys.w || keys.W) iy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) iy += 1;
    const ilen = Math.hypot(ix, iy) || 1;
    ix /= ilen;
    iy /= ilen;
    if (ix !== 0 || iy !== 0) {
      lastAimX = ix;
      lastAimY = iy;
    }

    let sp = SPEED;
    if (centerMud(player.x, player.y)) sp *= 0.48;
    if (speedBoostTimer > 0) sp *= BOOST_PAD_MULT;
    if (centerBoost(player.x, player.y)) {
      speedBoostTimer = Math.max(speedBoostTimer, 2.35);
      if (Math.random() < 0.08) addParticles(player.x + 4, player.y + 8, "#ffcc40", 2);
    }

    const txv = ix * sp;
    const tyv = iy * sp;
    if (centerIce(player.x, player.y)) {
      pvx += (txv - pvx) * Math.min(1, ICE_LERP * dt);
      pvy += (tyv - pvy) * Math.min(1, ICE_LERP * dt);
    } else {
      pvx = txv;
      pvy = tyv;
    }

    const m = moveAndCollide(player.x, player.y, PLAYER_W, PLAYER_H, pvx * dt, pvy * dt);
    player.x = clamp(m.x, 0, W - PLAYER_W);
    player.y = clamp(m.y, ORIGIN_Y, ORIGIN_Y + ROWS * TILE - PLAYER_H);

    if (teleportCd <= 0 && level.teleporterPairs && level.teleporterPairs.length) {
      const tcx = Math.floor((player.x + PLAYER_W * 0.5) / TILE);
      const tcy = Math.floor((player.y + PLAYER_H * 0.5 - ORIGIN_Y) / TILE);
      for (const pair of level.teleporterPairs) {
        const hitA = pair.a.tx === tcx && pair.a.ty === tcy;
        const hitB = pair.b.tx === tcx && pair.b.ty === tcy;
        if (hitA || hitB) {
          const dest = hitA ? pair.b : pair.a;
          const np = spawnWorldFromTile(dest.tx, dest.ty, PLAYER_W, PLAYER_H);
          player.x = np.x;
          player.y = np.y;
          pvx = 0;
          pvy = 0;
          teleportCd = TELEPORT_COOLDOWN;
          A.playSfx("teleport");
          addParticles(player.x + 4, player.y + 6, "#a0e8ff", 14);
          break;
        }
      }
    }

    if (hazardCd <= 0 && centerDamageTile(player.x, player.y)) {
      playerHit("spike");
    }

    const pcx = player.x + PLAYER_W * 0.5;
    const pcy = player.y + PLAYER_H * 0.5;
    for (const pul of level.pulses) {
      const cx = pul.tx * TILE + TILE * 0.5;
      const cy = ORIGIN_Y + pul.ty * TILE + TILE * 0.5;
      const lt = levelTime % PULSE_CYCLE;
      if (lt < 0.02) pul._warned = false;
      if (lt >= PULSE_WARN - dt && lt < PULSE_WARN && !pul._warned) {
        pul._warned = true;
        A.playSfx("pulse_warn", { pitch: pul.tx * 3 });
      }
      if (lt >= PULSE_WARN && lt < PULSE_WARN + PULSE_ACTIVE) {
        const d = Math.hypot(pcx - cx, pcy - cy);
        if (d < PULSE_R && invuln <= 0) {
          if (hazardCd <= 0) {
            hazardCd = HIT_COOLDOWN_TILE;
            A.playSfx("pulse_zap");
            playerHit("pulse");
          }
        }
      }
    }

    for (const s of shards) {
      if (s.taken) continue;
      s.pulse += dt * 5;
      if (aabb(player.x, player.y, PLAYER_W, PLAYER_H, s.x, s.y, s.w, s.h)) {
        s.taken = true;
        shardsCollected++;
        comboTimer = COMBO_WINDOW;
        combo = clamp(combo + 1, 1, 8);
        const gained = Math.floor(SHARD_VALUE * combo);
        score += gained;
        addParticles(s.x + 3, s.y + 3, "#00ffc8", 8);
        A.playSfx("shard_pickup", { combo });

        if (level.objective.kind === "boss_exit") {
          const b = bossEntity();
          const dmg = level.objective.damagePerShard || 10;
          if (b && !b.dead) {
            b.hp -= dmg;
            popFloat(s.x, s.y, `-${dmg}`, "#ff6b9d");
            addParticles(b.x + b.w * 0.5, b.y + b.h * 0.5, "#ff40a0", 16);
            A.playSfx("pulse_zap", { pitch: 12 });
            if (b.hp <= 0) {
              b.dead = true;
              b.hp = 0;
              shake = 0.55;
              addParticles(b.x + b.w * 0.5, b.y + b.h * 0.5, "#ffffff", 28);
              A.playSfx("level_complete");
            }
          }
        }
      }
    }

    for (const sc of scraps) {
      if (sc.taken) continue;
      sc.pulse += dt * 6;
      if (aabb(player.x, player.y, PLAYER_W, PLAYER_H, sc.x, sc.y, sc.w, sc.h)) {
        sc.taken = true;
        scrapCollected++;
        const mult = Math.max(1, Math.min(combo, 5));
        const g = Math.floor(SCRAP_VALUE * mult);
        score += g;
        comboTimer = COMBO_WINDOW;
        addParticles(sc.x + 2, sc.y + 2, "#ffcc50", 6);
        A.playSfx("scrap_pickup");
        popFloat(sc.x, sc.y, `+${g}`, "#ffcc50");
      }
    }

    for (const pu of powerups) {
      if (pu.taken) continue;
      pu.bob += dt * 4;
      if (aabb(player.x, player.y, PLAYER_W, PLAYER_H, pu.x, pu.y, pu.w, pu.h)) {
        pu.taken = true;
        A.playSfx("powerup");
        addParticles(pu.x + 3, pu.y + 3, "#ffffff", 12);
        if (pu.kind === "life") {
          lives = Math.min(MAX_LIVES, lives + 1);
          popFloat(pu.x, pu.y, "+1 UP", "#ff6b9d");
        } else if (pu.kind === "haste") {
          speedBoostTimer = Math.max(speedBoostTimer, 5.2);
          popFloat(pu.x, pu.y, "HASTE", "#40d8ff");
        } else if (pu.kind === "raygun") {
          weaponMode = "raygun";
          popFloat(pu.x, pu.y, "RAY GUN!", "#00ffc8");
        }
      }
    }

    for (const e of enemies) {
      if (e.type === "patrol") {
        const dx = e.vx * dt;
        const dy = e.vy * dt;
        const nx = e.x + dx;
        const ny = e.y + dy;
        if (!overlapSolid(nx, ny, e.w, e.h)) {
          e.x = nx;
          e.y = ny;
        } else {
          e.vx *= -1;
          e.vy *= -1;
        }
      } else if (e.type === "pursuer" || e.type === "titan") {
        let dx = player.x + PLAYER_W * 0.5 - (e.x + e.w * 0.5);
        let dy = player.y + PLAYER_H * 0.5 - (e.y + e.h * 0.5);
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * e.spd * dt;
        dy = (dy / len) * e.spd * dt;
        let nx = e.x + dx;
        if (!overlapSolid(nx, e.y, e.w, e.h)) e.x = nx;
        let ny = e.y + dy;
        if (!overlapSolid(e.x, ny, e.w, e.h)) e.y = ny;
      } else if (e.type === "sentry") {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = e.period;
          const sx = e.x + e.w * 0.5;
          const sy = e.y + e.h * 0.5;
          const px = player.x + PLAYER_W * 0.5;
          const py = player.y + PLAYER_H * 0.5;
          let dx = px - sx;
          let dy = py - sy;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
          projectiles.push({
            x: sx - PROJ_SZ * 0.5,
            y: sy - PROJ_SZ * 0.5,
            vx: dx * PROJ_SPEED,
            vy: dy * PROJ_SPEED,
            life: 3.5,
          });
          A.playSfx("sentry_shoot");
        }
      } else if (e.type === "boss" && !e.dead) {
        let dx = player.x + PLAYER_W * 0.5 - (e.x + e.w * 0.5);
        let dy = player.y + PLAYER_H * 0.5 - (e.y + e.h * 0.5);
        const len = Math.hypot(dx, dy) || 1;
        dx = (dx / len) * e.spd * dt;
        dy = (dy / len) * e.spd * dt;
        let nx = e.x + dx;
        if (!overlapSolid(nx, e.y, e.w, e.h)) e.x = nx;
        let ny = e.y + dy;
        if (!overlapSolid(e.x, ny, e.w, e.h)) e.y = ny;

        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = BOSS_BURST_PERIOD;
          const sx = e.x + e.w * 0.5;
          const sy = e.y + e.h * 0.5;
          const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [0.707, 0.707],
            [-0.707, 0.707],
            [0.707, -0.707],
            [-0.707, -0.707],
          ];
          for (const [vx, vy] of dirs) {
            projectiles.push({
              x: sx - PROJ_SZ * 0.5,
              y: sy - PROJ_SZ * 0.5,
              vx: vx * BOSS_PROJ_SPEED,
              vy: vy * BOSS_PROJ_SPEED,
              life: 4.2,
            });
          }
          A.playSfx("sentry_shoot", { pitch: -6 });
        }
      }

      if (e.type === "boss" && e.dead) continue;
      if (invuln <= 0 && aabb(player.x, player.y, PLAYER_W, PLAYER_H, e.x, e.y, e.w, e.h)) {
        if (hazardCd <= 0) playerHit("enemy");
      }
    }

    if (exitUnlocked()) {
      const er = exitRect();
      if (aabb(player.x, player.y, PLAYER_W, PLAYER_H, er.x + 2, er.y + 2, er.w - 4, er.h - 4)) {
        completeLevel();
      }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const b = projectiles[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || overlapSolid(b.x, b.y, PROJ_SZ, PROJ_SZ)) {
        projectiles.splice(i, 1);
        continue;
      }
      if (invuln <= 0 && hazardCd <= 0) {
        if (aabb(player.x, player.y, PLAYER_W, PLAYER_H, b.x, b.y, PROJ_SZ, PROJ_SZ)) {
          projectiles.splice(i, 1);
          playerHit("bolt");
        }
      }
    }

    for (let si = playerShots.length - 1; si >= 0; si--) {
      const ps = playerShots[si];
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;
      ps.life -= dt;
      const pw = ps.w != null ? ps.w : PLAYER_RAY_SZ;
      const ph = ps.h != null ? ps.h : PLAYER_RAY_SZ;
      if (ps.life <= 0 || overlapSolid(ps.x, ps.y, pw, ph)) {
        playerShots.splice(si, 1);
        continue;
      }
      let removed = false;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (e.type === "boss" && e.dead) continue;
        if (!aabb(ps.x, ps.y, pw, ph, e.x, e.y, e.w, e.h)) continue;
        removed = true;
        if (e.type === "boss") {
          const dmg = ps.kind === "saber" ? SABER_DMG_BOSS : RAY_DMG_BOSS;
          damageBossWeapon(e, dmg, ps.x, ps.y);
        } else {
          enemies.splice(ei, 1);
          addParticles(e.x + e.w * 0.5, e.y + e.h * 0.5, "#00ffc8", 14);
          A.playSfx("shard_pickup", { combo: 2 });
          score += 50;
        }
        playerShots.splice(si, 1);
        break;
      }
      if (removed) continue;
    }

    if (Math.abs(pvx) + Math.abs(pvy) > 25) {
      trail.push({
        x: player.x,
        y: player.y,
        t: 0,
      });
      while (trail.length > 12) trail.shift();
    }
    for (const tr of trail) tr.t += dt;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i].t > 0.9) trail.splice(i, 1);
    }

    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const f = floatTexts[i];
      f.t += dt;
      f.y -= 22 * dt;
      if (f.t >= f.life) floatTexts.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 110 * dt;
      if (p.t >= p.life) particles.splice(i, 1);
    }

    shake = Math.max(0, shake - dt);
  }

  function drawTiles() {
    ctx.imageSmoothingEnabled = false;
    const pal = sectorAccent();
    const spikeF = Math.floor(levelTime * 12) % 4;
    const mudF = Math.floor(levelTime * 5) % 3;
    const iceF = Math.floor(levelTime * 8) % 2;
    const boostF = Math.floor(levelTime * 10) % 3;
    const gateSpark = Math.floor(levelTime * 6) % 2;
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const t = level.tiles[cy][cx];
        const r = cellRect(cx, cy);
        if (t === 1) {
          ctx.fillStyle = `rgb(${pal.w},${pal.w2},52)`;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = pal.m;
          ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
          const e = (cx + cy + Math.floor(levelTime * 2)) % 4;
          ctx.fillStyle = `rgba(255,255,255,${0.04 + (e === 0 ? 0.06 : 0)})`;
          ctx.fillRect(r.x + 3 + e, r.y + 2, 2, 2);
        } else if (t === 2) {
          ctx.fillStyle = "#1a3028";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = "#2d5044";
          for (let i = 0; i < 3; i++) ctx.fillRect(r.x + 2 + i * 4, r.y + 4, 2, 2);
          const by = r.y + 10 - mudF;
          ctx.fillStyle = "rgba(100,200,160,0.35)";
          ctx.fillRect(r.x + 5 + mudF, by, 2, 3);
          ctx.fillRect(r.x + 9, by + 1, 2, 2);
        } else if (t === 3) {
          ctx.fillStyle = "#301820";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          const tip = spikeF % 2;
          ctx.fillStyle = "#601028";
          ctx.fillRect(r.x + 2, r.y + 8, 12, 6);
          ctx.fillStyle = "#ff3d7f";
          ctx.fillRect(r.x + 5 + tip, r.y + 2 + tip, 6, 8);
          ctx.fillRect(r.x + 3 + tip, r.y + 8, 10, 2);
          ctx.fillRect(r.x + 4, r.y + 10, 8, 3);
          ctx.fillStyle = "#ffc8d8";
          ctx.fillRect(r.x + 6 + tip, r.y + 4 + tip, 2, 4);
          if (spikeF >= 2) {
            ctx.fillStyle = "rgba(255,150,180,0.5)";
            ctx.fillRect(r.x + 7, r.y + 1, 2, 2);
          }
        } else if (t === 4) {
          const solid = gateSolid();
          ctx.fillStyle = solid ? "#3a3a55" : "#1e1e2e";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          if (!solid) {
            ctx.fillStyle = pal.a;
            ctx.fillRect(r.x + 6, r.y + 6, 4, 4);
            if (gateSpark) {
              ctx.fillStyle = "rgba(255,255,255,0.35)";
              ctx.fillRect(r.x + 7, r.y + 2, 2, 3);
              ctx.fillRect(r.x + 11, r.y + 10, 2, 2);
            }
          } else if (gateSpark) {
            ctx.strokeStyle = "rgba(255,200,100,0.25)";
            ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
          }
        } else if (t === 5) {
          ctx.fillStyle = "#183040";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = "#6ec8ff";
          ctx.fillRect(r.x + 2, r.y + 3, 12, 2);
          ctx.fillRect(r.x + 4, r.y + 8, 8, 2);
          if (iceF) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fillRect(r.x + 10, r.y + 2, 2, 2);
            ctx.fillRect(r.x + 3, r.y + 11, 2, 2);
          } else {
            ctx.fillStyle = "rgba(180,230,255,0.4)";
            ctx.fillRect(r.x + 6, r.y + 5, 2, 2);
          }
        } else if (t === 6) {
          ctx.fillStyle = "#302010";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = boostF === 0 ? "#ff8800" : boostF === 1 ? "#ffaa40" : "#ffcc60";
          ctx.fillRect(r.x + 3, r.y + 5, 10, 6);
          ctx.fillStyle = "#ffe080";
          ctx.fillRect(r.x + 5, r.y + 6, 6, 3);
          ctx.fillStyle = "rgba(255,255,200,0.7)";
          ctx.fillRect(r.x + 6, r.y + 3 - boostF, 4, 2 + boostF);
          ctx.fillRect(r.x + 7, r.y + 12, 2, 2 + (boostF % 2));
        }
      }
    }
  }

  function drawTeleporterFx() {
    if (!level.teleporterPairs) return;
    ctx.imageSmoothingEnabled = false;
    const pulse = 0.5 + Math.sin(levelTime * 5) * 0.35;
    const spin = levelTime * 4;
    for (const pair of level.teleporterPairs) {
      for (const pt of [pair.a, pair.b]) {
        const cx = pt.tx * TILE + TILE * 0.5;
        const cy = ORIGIN_Y + pt.ty * TILE + TILE * 0.5;
        for (let i = 0; i < 3; i++) {
          const a0 = spin + (i * Math.PI * 2) / 3;
          const a1 = a0 + 0.8;
          ctx.strokeStyle = `rgba(100,220,255,${0.15 + i * 0.12})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 4 + i * 2, a0, a1);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(160,232,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
        const d = Math.floor(levelTime * 12) % 4;
        ctx.fillStyle = `rgba(200,255,255,${0.4 + pulse * 0.3})`;
        ctx.fillRect((cx - 1 + (d % 2) * 2) | 0, (cy - 1) | 0, 2, 2);
      }
    }
  }

  function drawScraps() {
    ctx.imageSmoothingEnabled = false;
    for (const sc of scraps) {
      if (sc.taken) continue;
      const k = 0.85 + Math.sin(sc.pulse) * 0.15;
      const rot = Math.floor(levelTime * 7 + sc.pulse) % 4;
      const sx = sc.x | 0;
      const sy = sc.y | 0;
      ctx.fillStyle = `rgb(120,${Math.floor(80 * k)},${Math.floor(40 * k)})`;
      ctx.fillRect(sx - 1, sy - 1, sc.w + 2, sc.h + 2);
      ctx.fillStyle = `rgb(255,${Math.floor(160 * k)},${Math.floor(60 * k)})`;
      ctx.fillRect(sx, sy, sc.w, sc.h);
      ctx.fillStyle = "#fff4c8";
      if (rot === 0) {
        ctx.fillRect(sx + 1, sy, 3, 2);
        ctx.fillRect(sx + 1, sy + 3, 3, 2);
      } else if (rot === 1) {
        ctx.fillRect(sx, sy + 1, 2, 3);
        ctx.fillRect(sx + 3, sy + 1, 2, 3);
      } else if (rot === 2) {
        ctx.fillRect(sx + 1, sy + 1, 3, 3);
      } else {
        ctx.fillRect(sx + 2, sy, 1, 5);
        ctx.fillRect(sx, sy + 2, 5, 1);
      }
    }
  }

  function drawPowerups() {
    ctx.imageSmoothingEnabled = false;
    const f = Math.floor(levelTime * 8) % 2;
    for (const pu of powerups) {
      if (pu.taken) continue;
      const bob = Math.sin(pu.bob) * 1.5;
      const px = pu.x | 0;
      const py = (pu.y + bob) | 0;
      if (pu.kind === "life") {
        ctx.fillStyle = "#501028";
        ctx.fillRect(px - 1, py - 1, pu.w + 2, pu.h + 2);
        ctx.fillStyle = f ? "#ff6b9d" : "#ff4080";
        ctx.fillRect(px + 1, py + 2, 5, 3);
        ctx.fillRect(px + 2, py + 1, 3, 5);
        ctx.fillStyle = "#ffb0c8";
        ctx.fillRect(px + 3, py + 3, 1, 2);
      } else if (pu.kind === "haste") {
        ctx.fillStyle = "#103050";
        ctx.fillRect(px - 1, py - 1, pu.w + 2, pu.h + 2);
        ctx.fillStyle = "#40d8ff";
        ctx.fillRect(px + 1, py + 1, 2, 5);
        ctx.fillRect(px + 3, py + 2, 2, 4);
        ctx.fillRect(px + 5, py + 4, 2, 3);
        ctx.fillStyle = "#ffffff";
        if (f) ctx.fillRect(px + 2, py + 2, 4, 1);
      } else if (pu.kind === "raygun") {
        ctx.fillStyle = "#1a3038";
        ctx.fillRect(px - 1, py - 1, pu.w + 2, pu.h + 2);
        ctx.fillStyle = "#3a5860";
        ctx.fillRect(px + 1, py + 2, 5, 3);
        ctx.fillStyle = f ? "#ff6b9d" : "#00ffc8";
        ctx.fillRect(px + 4, py + 1, 2, 2);
        ctx.fillStyle = "#a0e8ff";
        ctx.fillRect(px + 5, py + 1, 2, 1);
      }
    }
  }

  function drawProjectiles() {
    ctx.imageSmoothingEnabled = false;
    const pf = Math.floor(levelTime * 16) % 4;
    for (const b of projectiles) {
      const bx = b.x | 0;
      const by = b.y | 0;
      const spd = Math.hypot(b.vx, b.vy) || 1;
      const tx = (-b.vx / spd) * 3;
      const ty = (-b.vy / spd) * 3;
      ctx.fillStyle = "rgba(255,80,160,0.4)";
      ctx.fillRect((bx + tx * 0.5) | 0, (by + ty * 0.5) | 0, PROJ_SZ + 2, PROJ_SZ + 2);
      ctx.fillStyle = "rgba(255,100,180,0.55)";
      ctx.fillRect((bx + tx) | 0, (by + ty) | 0, PROJ_SZ + 1, PROJ_SZ + 1);
      ctx.fillStyle = "#ffe040";
      ctx.fillRect(bx, by, PROJ_SZ, PROJ_SZ);
      ctx.fillStyle = "#fffff0";
      if (pf === 0) {
        ctx.fillRect(bx, by, 2, 2);
        ctx.fillRect(bx + 2, by + 2, 2, 2);
      } else if (pf === 1) {
        ctx.fillRect(bx + 2, by, 2, 2);
        ctx.fillRect(bx, by + 2, 2, 2);
      } else if (pf === 2) {
        ctx.fillRect(bx + 1, by + 1, 2, 2);
      } else {
        ctx.fillRect(bx + 1, by, 2, 2);
        ctx.fillRect(bx + 1, by + 2, 2, 2);
      }
      ctx.fillStyle = "rgba(120,255,255,0.75)";
      ctx.fillRect((bx - b.vx * 0.02) | 0, (by - b.vy * 0.02) | 0, 1, 1);
    }
  }

  function drawPlayerShots() {
    ctx.imageSmoothingEnabled = false;
    const pf = Math.floor(levelTime * 20) % 3;
    for (const ps of playerShots) {
      const pw = ps.w != null ? ps.w : PLAYER_RAY_SZ;
      const ph = ps.h != null ? ps.h : PLAYER_RAY_SZ;
      const bx = ps.x | 0;
      const by = ps.y | 0;
      if (ps.kind === "saber") {
        ctx.fillStyle = "rgba(180,255,255,0.45)";
        ctx.fillRect(bx - 1, by - 1, pw + 2, ph + 2);
        ctx.fillStyle = pf ? "#a0ffff" : "#ffffff";
        ctx.fillRect(bx, by, pw, ph);
        ctx.fillStyle = "#00ffc8";
        ctx.fillRect(bx + 2, by + 1, pw - 4, ph - 2);
      } else {
        ctx.fillStyle = "rgba(0,255,200,0.35)";
        ctx.fillRect(bx - 1, by - 1, pw + 2, ph + 2);
        ctx.fillStyle = "#00ffc8";
        ctx.fillRect(bx, by, pw, ph);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bx + 1, by + 1, 2, 2);
      }
    }
  }

  function drawTrail() {
    for (const tr of trail) {
      const k = Math.max(0, 0.35 - tr.t * 0.4);
      if (k <= 0) continue;
      ctx.globalAlpha = k * 0.28;
      ctx.fillStyle = "#7dffb8";
      ctx.fillRect(tr.x | 0, tr.y | 0, PLAYER_W, PLAYER_H - 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    ctx.font = "7px monospace";
    for (const f of floatTexts) {
      const k = 1 - f.t / f.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, f.x | 0, f.y | 0);
    }
    ctx.globalAlpha = 1;
  }

  function drawExit() {
    ctx.imageSmoothingEnabled = false;
    const er = exitRect();
    const open = exitUnlocked();
    const ef = Math.floor(levelTime * (open ? 10 : 4)) % 4;
    if (open) {
      const swirl = levelTime * 3;
      ctx.fillStyle = "#2a2010";
      ctx.fillRect(er.x + 1, er.y + 1, er.w - 2, er.h - 2);
      for (let i = 0; i < 4; i++) {
        const a = swirl + i * 0.9;
        ctx.strokeStyle = `rgba(255,220,120,${0.35 + i * 0.12})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(er.x + er.w * 0.5, er.y + er.h * 0.5, 3 + i * 2, a, a + 1.2);
        ctx.stroke();
      }
      ctx.fillStyle = "#fff8e0";
      ctx.fillRect(er.x + 4 + (ef % 2), er.y + 4, 8, 8);
      ctx.fillStyle = "#ffd080";
      ctx.fillRect(er.x + 6, er.y + 6, 4, 4);
    } else {
      ctx.fillStyle = "#3a3a48";
      ctx.fillRect(er.x + 1, er.y + 1, er.w - 2, er.h - 2);
      ctx.fillStyle = "#606078";
      ctx.fillRect(er.x + 3, er.y + 2 + ef, 2, er.h - 4);
      ctx.fillRect(er.x + 8, er.y + 2 + ((ef + 2) % 3), 2, er.h - 4);
      ctx.fillRect(er.x + 13, er.y + 2 + ((ef + 1) % 2), 2, er.h - 4);
      ctx.fillStyle = "#4a4a58";
      ctx.fillRect(er.x + 5, er.y + er.h * 0.5 - 1, 6, 2);
    }
  }

  function drawPulses() {
    ctx.imageSmoothingEnabled = false;
    const tick = Math.floor(levelTime * 8) % 8;
    for (const pul of level.pulses) {
      const cx = pul.tx * TILE + TILE * 0.5;
      const cy = ORIGIN_Y + pul.ty * TILE + TILE * 0.5;
      const lt = levelTime % PULSE_CYCLE;
      if (lt < PULSE_WARN) {
        const k = lt / PULSE_WARN;
        ctx.strokeStyle = `rgba(255,220,100,${0.2 + k * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, PULSE_R * k, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + levelTime * 2;
          const r = PULSE_R * k * 0.85;
          ctx.fillStyle = i === tick ? "rgba(255,255,100,0.7)" : "rgba(255,200,80,0.25)";
          ctx.fillRect((cx + Math.cos(ang) * r) | 0, (cy + Math.sin(ang) * r) | 0, 2, 2);
        }
      } else if (lt < PULSE_WARN + PULSE_ACTIVE) {
        const zap = Math.floor(levelTime * 20) % 2;
        ctx.fillStyle = "rgba(255,80,200,0.35)";
        ctx.beginPath();
        ctx.arc(cx, cy, PULSE_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = zap ? "rgba(255,255,255,0.5)" : "rgba(255,40,180,0.6)";
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2 + levelTime * 10;
          ctx.fillRect((cx + Math.cos(ang) * (PULSE_R * 0.5)) | 0, (cy + Math.sin(ang) * (PULSE_R * 0.5)) | 0, 3, 3);
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect((cx - 1) | 0, (cy - 1) | 0, 2, 2);
      }
    }
  }

  function drawShards() {
    ctx.imageSmoothingEnabled = false;
    let si = 0;
    for (const s of shards) {
      if (s.taken) continue;
      const pulse = 0.85 + Math.sin(s.pulse) * 0.15;
      const c = Math.floor(40 * pulse);
      const sx = s.x | 0;
      const sy = s.y | 0;
      const rot = Math.floor(levelTime * 5 + si * 1.3) % 4;
      si++;
      ctx.fillStyle = `rgb(${Math.floor(c * 0.3)},${100 + c},${160 + c})`;
      ctx.fillRect(sx - 2, sy - 2, s.w + 4, s.h + 4);
      ctx.fillStyle = `rgb(${c},${200 + c},${220})`;
      if (rot === 0) {
        ctx.fillRect(sx + 1, sy, 4, 6);
        ctx.fillRect(sx, sy + 2, 6, 2);
      } else if (rot === 1) {
        ctx.fillRect(sx + 1, sy, 4, 6);
        ctx.fillRect(sx, sy + 2, 6, 2);
        ctx.fillStyle = `rgb(${40 + c},${220 + c},${240})`;
        ctx.fillRect(sx + 2, sy + 1, 2, 4);
      } else if (rot === 2) {
        ctx.beginPath();
        ctx.moveTo(sx + 3, sy);
        ctx.lineTo(sx + 6, sy + 3);
        ctx.lineTo(sx + 3, sy + 6);
        ctx.lineTo(sx, sy + 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(sx, sy + 1, 6, 4);
        ctx.fillRect(sx + 2, sy, 2, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(sx + 2, sy + 2, 2, 2);
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx + 2, sy + 2, 2, 2);
      const sp = Math.floor(levelTime * 12 + si) % 3;
      ctx.fillStyle = "rgba(0,255,200,0.5)";
      ctx.fillRect(sx + sp, sy - 1, 1, 1);
      ctx.fillRect(sx + s.w - sp, sy + s.h, 1, 1);
    }
  }

  function drawEnemies() {
    ctx.imageSmoothingEnabled = false;
    const tread = (Math.floor(levelTime * 8) % 2) * 1;
    let ei = 0;
    for (const e of enemies) {
      ei++;
      if (e.type === "boss") {
        if (e.dead) continue;
        const x = e.x | 0;
        const y = e.y | 0;
        const core = 0.5 + Math.sin(levelTime * 5) * 0.5;
        const bob = Math.round(Math.sin(levelTime * 3 + ei) * 1);
        const ring = Math.floor(levelTime * 4) % 3;
        ctx.fillStyle = `rgba(255,40,100,${0.12 + core * 0.1})`;
        ctx.fillRect(x - 2, y - 2 + bob, e.w + 4, e.h + 4);
        ctx.strokeStyle = `rgba(255,100,180,${0.2 + ring * 0.1})`;
        ctx.strokeRect(x - 3 - ring, y - 3 - ring + bob, e.w + 6 + ring * 2, e.h + 6 + ring * 2);
        ctx.fillStyle = "#1a0a28";
        ctx.fillRect(x, y + bob, e.w, e.h);
        ctx.fillStyle = "#3a1050";
        ctx.fillRect(x + 2, y + 4 + bob, 6, e.h - 8);
        ctx.fillRect(x + e.w - 8, y + 4 + bob, 6, e.h - 8);
        ctx.fillStyle = "#4a2060";
        ctx.fillRect(x + 4, y + 6 + bob, e.w - 8, e.h - 12);
        ctx.fillStyle = "#ff5090";
        ctx.fillRect(x + 10, y + 10 + bob, e.w - 20, e.h - 22);
        const eye = Math.floor(levelTime * 6) % 3;
        ctx.fillStyle = "#fff8f0";
        ctx.fillRect(x + 12 + (eye === 1 ? 1 : 0), y + 14 + bob, 8, 6);
        ctx.fillRect(x + e.w - 20 + (eye === 2 ? -1 : 0), y + 14 + bob, 8, 6);
        ctx.fillStyle = "#120818";
        ctx.fillRect(x + 15, y + 17 + bob, 3, 3);
        ctx.fillRect(x + e.w - 18, y + 17 + bob, 3, 3);
        ctx.fillStyle = "#ff2060";
        ctx.fillRect(x + e.w * 0.5 - 4, y + 4 + bob, 8, 5);
        ctx.fillStyle = "#802040";
        ctx.fillRect(x + e.w * 0.5 - 8, y + e.h - 14 + bob, 16, 4);
        ctx.strokeStyle = `rgba(255,100,160,${0.4 + core * 0.4})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 8, y + 8 + bob, e.w - 16, e.h - 18);
        const hpw = e.w - 12;
        const k = e.maxHp > 0 ? clamp(e.hp / e.maxHp, 0, 1) : 0;
        ctx.fillStyle = "#2a2038";
        ctx.fillRect(x + 6, y - 5 + bob, hpw, 3);
        ctx.fillStyle = "#ff3d7f";
        ctx.fillRect(x + 6, y - 5 + bob, Math.max(0, (hpw * k) | 0), 3);
        continue;
      }
      if (e.type === "patrol") {
        const px = e.x | 0;
        const py = e.y | 0;
        const bob = Math.round(Math.sin(levelTime * 6 + px * 0.15) * 1);
        ctx.save();
        ctx.translate(0, bob);
        ctx.fillStyle = "#2a0810";
        ctx.fillRect(px, py + e.h - 3, e.w, 3);
        ctx.fillStyle = "#501018";
        ctx.fillRect(px + 1, py + e.h - 2, e.w - 2, 2);
        ctx.fillStyle = tread ? "#3a1018" : "#501820";
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 2 + i * 3 + tread, py + e.h - 2, 2, 2);
        ctx.fillStyle = "#ff3d7f";
        ctx.fillRect(px + 1, py + 2, e.w - 2, e.h - 5);
        ctx.fillStyle = "#ffc8d8";
        ctx.fillRect(px + 3, py + 1, e.w - 6, 4);
        const ant = Math.round(Math.sin(levelTime * 11) * 1);
        ctx.fillStyle = "#ff2050";
        ctx.fillRect(px + 4 + ant, py + 3, e.w - 8, 2);
        ctx.fillStyle = "#1a1a28";
        ctx.fillRect(px + 4, py + 5, 4, 3);
        ctx.fillRect(px + e.w - 8, py + 5, 4, 3);
        ctx.fillStyle = "#ffffc0";
        ctx.fillRect(px + 5, py + 6, 2, 1);
        ctx.fillRect(px + e.w - 7, py + 6, 2, 1);
        ctx.strokeStyle = "#ff8090";
        ctx.strokeRect(px + 0.5, py + 0.5, e.w - 1, e.h - 4.5);
        ctx.restore();
      } else if (e.type === "sentry") {
        const px = e.x | 0;
        const py = e.y | 0;
        const sway = Math.round(Math.sin(levelTime * 7 + ei) * 1);
        const per = e.period || 1.65;
        const recoil = e.timer > per - 0.12 ? 1 : 0;
        ctx.save();
        ctx.translate(sway, 0);
        ctx.fillStyle = "#1a1810";
        ctx.fillRect(px + 2, py + 6, 2, 3);
        ctx.fillRect(px + e.w - 4, py + 6, 2, 3);
        ctx.fillStyle = "#3a3020";
        ctx.fillRect(px + 1, py + 4, e.w - 2, 5);
        ctx.fillStyle = "#a08030";
        ctx.fillRect(px, py, e.w, e.h - 2);
        ctx.fillStyle = "#d0a040";
        ctx.fillRect(px + 1, py + 1, e.w - 2, e.h - 4);
        const barTilt = Math.floor(levelTime * 9) % 3;
        ctx.fillStyle = "#2a2520";
        ctx.fillRect(px + 3 + recoil, py + 2 + barTilt, 3, 5);
        ctx.fillStyle = "#ff3030";
        ctx.fillRect(px + 4 + recoil, py + 3 + barTilt, 4, 3);
        const aim = levelTime * 2.2;
        ctx.fillStyle = `rgba(255,200,100,${0.4 + Math.sin(aim) * 0.2})`;
        ctx.beginPath();
        ctx.arc(px + e.w * 0.5, py + 4, 3, 0, Math.PI * 2);
        ctx.fill();
        const spin = Math.floor(levelTime * 14) % 2;
        ctx.fillStyle = spin ? "rgba(255,255,255,0.5)" : "rgba(255,80,80,0.4)";
        ctx.fillRect(px + 5 + recoil, py + 1, 2, 2);
        ctx.strokeStyle = "#ffe8a0";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, e.w - 1, e.h - 1.5);
        ctx.restore();
      } else if (e.type === "titan") {
        const px = e.x | 0;
        const py = e.y | 0;
        const pulse = 0.5 + Math.sin(levelTime * 4) * 0.5;
        const stomp = Math.floor(levelTime * 4) % 2;
        ctx.save();
        ctx.translate(0, stomp);
        ctx.fillStyle = "#1a080c";
        ctx.fillRect(px, py, e.w, e.h);
        ctx.fillStyle = "rgba(180,180,200,0.25)";
        ctx.fillRect(px + 4, py - 2, 4, 2);
        ctx.fillRect(px + e.w - 8, py - 2, 4, 2);
        ctx.fillStyle = "#3a1020";
        ctx.fillRect(px + 2, py + 8, 5, e.h - 10);
        ctx.fillRect(px + e.w - 7, py + 8, 5, e.h - 10);
        ctx.fillStyle = "#4a1525";
        ctx.fillRect(px + 4, py + 4, e.w - 8, e.h - 6);
        ctx.fillStyle = "#ff2050";
        ctx.fillRect(px + 6, py + 6, e.w - 12, e.h - 12);
        ctx.fillStyle = `rgba(255,255,200,${0.2 + pulse * 0.35})`;
        ctx.fillRect(px + e.w * 0.5 - 5, py + 8, 10, 8);
        const vf = Math.floor(levelTime * 10) % 2;
        ctx.fillStyle = "#ff8090";
        ctx.fillRect(px + 8, py + 5, 6, 5);
        ctx.fillRect(px + e.w - 14, py + 5, 6, 5);
        ctx.fillStyle = "#120810";
        ctx.fillRect(px + 10 + vf, py + 6, 2, 2);
        ctx.fillRect(px + e.w - 12 - vf, py + 6, 2, 2);
        ctx.strokeStyle = "#802040";
        ctx.strokeRect(px + 3, py + 3, e.w - 6, e.h - 7);
        ctx.restore();
      } else {
        const px = e.x | 0;
        const py = e.y | 0;
        const wing = Math.floor(levelTime * 14 + px * 0.1) % 2;
        const bob = Math.round(Math.sin(levelTime * 8 + ei) * 1);
        ctx.save();
        ctx.translate(0, bob);
        ctx.fillStyle = "#301848";
        ctx.fillRect(px + 2, py + e.h - 2, e.w - 4, 2);
        ctx.fillStyle = "#501878";
        ctx.fillRect(px + 1, py + 3, e.w - 2, e.h - 5);
        ctx.fillStyle = "#8040c0";
        ctx.fillRect(px + 2, py + 4, e.w - 4, e.h - 7);
        ctx.fillStyle = "#c070ff";
        ctx.fillRect(px + 3, py + 5, e.w - 6, e.h - 9);
        ctx.fillStyle = wing ? "#ffd0ff" : "#ffe0ff";
        ctx.fillRect(px + 2, py + 1, e.w - 4, 4);
        ctx.fillStyle = "#120818";
        ctx.fillRect(px + 3, py + 6, 3, 4);
        ctx.fillRect(px + e.w - 6, py + 6, 3, 4);
        ctx.fillStyle = "#ff80ff";
        ctx.fillRect(px + 4, py + 7, 1, 2);
        ctx.fillRect(px + e.w - 5, py + 7, 1, 2);
        ctx.fillStyle = `rgba(200,100,255,${0.35 + Math.sin(levelTime * 10 + px) * 0.15})`;
        ctx.fillRect(px - 1 - wing, py + 4, 2, 4);
        ctx.fillRect(px + e.w - 1 + wing, py + 4, 2, 4);
        ctx.fillStyle = "rgba(160,80,255,0.5)";
        ctx.fillRect(px - 2, py + 2 + wing, 2, 3);
        ctx.fillRect(px + e.w, py + 2 + wing, 2, 3);
        ctx.restore();
      }
    }
  }

  function drawPlayer() {
    const px = player.x | 0;
    const py = player.y | 0;
    const drawExtras = (ox, oy, packA, jetA) => {
      ctx.globalAlpha = packA;
      ctx.fillStyle = "#2a4550";
      ctx.fillRect(px - 2 + ox, py + 3 + oy, 3, 10);
      ctx.fillStyle = "#1a3040";
      ctx.fillRect(px - 2 + ox, py + 5 + oy, 2, 6);
      ctx.globalAlpha = jetA;
      const flick = (Math.floor(levelTime * 18) % 2) * 0.5;
      ctx.fillStyle = "#40ffc8";
      ctx.fillRect(px + 1 + ox, py + 11 + oy, 3, 1 + flick);
      ctx.fillRect(px + PLAYER_W - 4 + ox, py + 11 + oy, 3, 1 + flick);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#00ffc8";
      ctx.fillRect(px + 3 + ox, py - 5 + oy, 2, 2);
      ctx.fillRect(px + 4 + ox, py - 6 + oy, 1, 2);
    };
    const drawBody = (ox, oy, rgb, rim, handCol) => {
      ctx.fillStyle = rgb;
      ctx.fillRect(px + ox, py + oy, PLAYER_W, PLAYER_H - 4);
      ctx.fillRect(px + 1 + ox, py - 2 + oy, PLAYER_W - 2, 3);
      if (rim) {
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + ox, py + oy, PLAYER_W - 1, PLAYER_H - 5);
      }
      ctx.fillStyle = handCol;
      ctx.fillRect(px + 2 + ox, py + 4 + oy, 2, 2);
      ctx.fillRect(px + PLAYER_W - 4 + ox, py + 4 + oy, 2, 2);
    };
    const drawFace = (ox, oy, eyeHi, mouthCol) => {
      ctx.fillStyle = "#1a3c44";
      ctx.fillRect(px + 1 + ox, py + 1 + oy, PLAYER_W - 2, 5);
      ctx.fillStyle = eyeHi;
      ctx.fillRect(px + 2 + ox, py + 2 + oy, 3, 3);
      ctx.fillRect(px + PLAYER_W - 5 + ox, py + 2 + oy, 3, 3);
      ctx.fillStyle = "#061810";
      ctx.fillRect(px + 3 + ox, py + 3 + oy, 1, 2);
      ctx.fillRect(px + PLAYER_W - 4 + ox, py + 3 + oy, 1, 2);
      ctx.fillStyle = mouthCol;
      ctx.fillRect(px + 3 + ox, py + 8 + oy, PLAYER_W - 6, 1);
    };
    const drawSuitDetail = (ox, oy, stripe, deep) => {
      ctx.fillStyle = deep;
      ctx.fillRect(px + 1 + ox, py + 5 + oy, 2, 4);
      ctx.fillRect(px + PLAYER_W - 3 + ox, py + 5 + oy, 2, 4);
      ctx.fillStyle = stripe;
      ctx.fillRect(px + 3 + ox, py + 6 + oy, PLAYER_W - 6, 2);
      ctx.fillRect(px + 3 + ox, py + 9 + oy, PLAYER_W - 6, 1);
    };
    const flash = invuln > 0 && Math.floor(levelTime * 12) % 2 === 0;
    const body = flash ? "#b0ffd0" : "#7dffb8";
    drawBody(0, 0, body, "#146050", "#0a3020");
    drawExtras(0, 0, 1, 1);
    drawFace(0, 0, "#f5fff8", "#0a3020");
    drawSuitDetail(0, 0, "#00ffc8", "#0a3020");
    if (weaponMode === "raygun") {
      const fx = lastAimX >= 0 ? px + PLAYER_W - 2 : px - 3;
      ctx.fillStyle = "#2a4050";
      ctx.fillRect(fx, py + 5, 4, 3);
      ctx.fillStyle = "#00ffc8";
      ctx.fillRect(fx + (lastAimX >= 0 ? 3 : 0), py + 5, 1, 1);
    } else if (weaponMode === "boss_saber") {
      const hx = lastAimX >= 0 ? px + PLAYER_W - 1 : px - 4;
      ctx.fillStyle = "#4a2a60";
      ctx.fillRect(hx, py + 4, 3, 5);
      const blade = (Math.floor(levelTime * 12) % 2) ? "#a0ffff" : "#ffffff";
      ctx.fillStyle = blade;
      ctx.fillRect(hx + (lastAimX >= 0 ? 2 : -2), py + 2, 2, 4);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground() {
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, W, H);
    for (const st of stars) {
      st.tw += 0.035;
      const a = 0.2 + Math.sin(st.tw) * 0.18;
      ctx.fillStyle = `rgba(200,220,255,${a})`;
      ctx.fillRect(st.x | 0, (ORIGIN_Y + st.y) | 0, 1, 1);
    }
  }

  function drawScanlines() {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
  }

  function render() {
    const sx = shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    drawBackground();
    if (level) {
      drawTiles();
      drawExit();
      drawTeleporterFx();
      drawPulses();
      drawShards();
      drawScraps();
      drawPowerups();
      drawProjectiles();
      drawPlayerShots();
      drawTrail();
      drawEnemies();
      drawPlayer();
    }
    drawParticles();
    drawFloatTexts();
    ctx.fillStyle = "#5a5a70";
    ctx.font = "6px monospace";
    if (level) {
      const req = shardsRequired();
      const sur = level.objective.kind === "survive_exit";
      let t1 = sur ? `T-${Math.max(0, Math.ceil(level.objective.seconds - levelTime))}` : "";
      if (t1) ctx.fillText(t1, 4, ORIGIN_Y + 8);
      if (level.objective.kind === "boss_exit") {
        const b = bossEntity();
        const cur = b && !b.dead ? Math.max(0, Math.ceil(b.hp)) : 0;
        const mx = b ? Math.ceil(b.maxHp) : 1;
        ctx.fillText(`OVERSERVER ${cur}/${mx}`, W - 102, ORIGIN_Y + 8);
      } else {
        ctx.fillText(`DATA ${shardsCollected}/${req || level.shardTotal}`, W - 72, ORIGIN_Y + 8);
      }
      const st = level.scrapTotal || 0;
      if (st > 0) ctx.fillText(`SCRAP ${scrapCollected}/${st}`, W - 72, ORIGIN_Y + 16);
    }
    drawScanlines();
    ctx.restore();
  }

  function hudText() {
    scoreLabel.textContent = `SCORE ${score}`;
    comboLabel.textContent = `COMBO x${combo}`;
    if (level && (level.scrapTotal || 0) > 0)
      scrapLabel.textContent = `SCRAP ${scrapCollected}/${level.scrapTotal}`;
    else scrapLabel.textContent = "SCRAP —";
    livesLabel.textContent = `LIVES ${lives}`;

    if (level) {
      levelLabel.textContent = level.isBoss
        ? `FINAL CONFRONTATION · ${level.name}`
        : `LV ${level.id} ${level.name}`;
      sectorLabel.textContent = level.isBoss
        ? "ANTAGONIST"
        : `SECTOR ${level.sector} OF ${SECTOR_COUNT}`;
      const o = level.objective;
      let obj = "";
      if (o.kind === "collect_exit") obj = `Collect all ${level.shardTotal} shards, then reach exit.`;
      else if (o.kind === "subset_exit") obj = `Collect at least ${o.min} shards, then exit.`;
      else if (o.kind === "survive_exit")
        obj = `Survive ${o.seconds}s — exit unlocks. Then reach exit.`;
      else if (o.kind === "boss_exit")
        obj = `Plasma saber (Space) and data shards both damage the Overserver. When it falls, reach the exit.`;
      if (weaponMode === "raygun") obj += " Space: fire ray gun (aim with movement).";
      objectiveLine.textContent = `Objective: ${obj}`;
    }
  }

  function loop(t) {
    const sec = t * 0.001;
    let frameDt = lastT ? sec - lastT : DT;
    lastT = sec;
    frameDt = Math.min(frameDt, 0.12);
    acc += frameDt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS) {
      update(DT);
      acc -= DT;
      steps++;
    }
    if (state === "cutscene" && cutsceneSlides) {
      cutsceneTime += frameDt;
      refreshCutsceneVisuals();
    }
    A.musicTick();
    render();
    hudText();
    requestAnimationFrame(loop);
  }

  function showOverlay() {
    overlay.hidden = false;
    if (btnStart) btnStart.focus();
    if (state === "paused") {
      panelTitle.textContent = "PAUSED";
      panelText.textContent = "Press P or Esc to resume.";
      btnStart.textContent = "Resume";
    } else if (state === "interstitial") {
      const nextLv = LEVELS[levelIndex + 1];
      if (nextLv && nextLv.isBoss) {
        panelTitle.textContent = "ANTAGONIST ENCOUNTER";
        panelText.textContent = `Score: ${score}. Final confrontation: ${nextLv.name}.`;
        btnStart.textContent = "Face the Overserver";
      } else {
        panelTitle.textContent = `SECTOR ${level.sector} OF ${SECTOR_COUNT} — CLEAR`;
        panelText.textContent = `Score: ${score}. Next: ${nextLv ? nextLv.name : "—"}`;
        btnStart.textContent = "Next Level";
      }
    } else if (state === "gameover") {
      panelTitle.textContent = "GAME OVER";
      panelText.textContent = `Out of lives. Score: ${score}. Retry ${level.name}?`;
      btnStart.textContent = "Retry Level";
    } else if (state === "winall") {
      panelTitle.textContent = "SHARD CIRCUIT — YOU WIN";
      panelText.textContent = `You beat the Overserver. Final score: ${score}.`;
      btnStart.textContent = "Play Again";
    }
    btnStart.focus();
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function togglePause() {
    if (
      state === "title" ||
      state === "winall" ||
      state === "interstitial" ||
      state === "gameover" ||
      state === "cutscene"
    )
      return;
    if (state === "playing") {
      state = "paused";
      A.setPaused(true);
      A.playSfx("pause_in");
      showOverlay();
    } else if (state === "paused") {
      state = "playing";
      A.setPaused(false);
      A.playSfx("pause_out");
      hideOverlay();
      lastT = 0;
    }
  }

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (state === "cutscene" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      advanceCutscene();
      return;
    }
    if (e.key === " " && state === "playing") {
      e.preventDefault();
      tryFireWeapon();
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      if (state === "playing" || state === "paused") {
        e.preventDefault();
        togglePause();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });

  btnStart.addEventListener("click", () => {
    A.resume();
    applyVolumes();

    if (state === "paused") {
      A.playSfx("ui_confirm");
      state = "playing";
      A.setPaused(false);
      hideOverlay();
    } else if (state === "interstitial") {
      A.playSfx("ui_confirm");
      const completedSector = level.sector;
      levelIndex++;
      const nextLv = LEVELS[levelIndex];
      hideOverlay();

      const startNextLevel = () => {
        showPlayingLayout();
        loadLevel(levelIndex);
        state = "playing";
        if (level.sector !== lastMusicSector) {
          lastMusicSector = level.sector;
          A.stopMusic();
          A.startGameMusic(level.sector);
        }
        lastT = 0;
        if (canvas && typeof canvas.focus === "function") {
          try {
            canvas.focus({ preventScroll: true });
          } catch (_) {
            canvas.focus();
          }
        }
      };

      let midSlides = null;
      let chapter = "STORY";
      if (Story && nextLv) {
        if (nextLv.isBoss && typeof Story.getBossApproach === "function") {
          midSlides = Story.getBossApproach();
          chapter = "FINAL FIGHT";
        } else if (typeof Story.getSectorIntro === "function") {
          midSlides = Story.getSectorIntro(nextLv.sector, completedSector);
          if (midSlides && midSlides.length) chapter = `SECTOR ${nextLv.sector}`;
        }
      }

      if (midSlides && midSlides.length > 0) {
        beginCutscene(midSlides, startNextLevel, chapter);
      } else {
        startNextLevel();
      }
    } else if (state === "gameover") {
      A.playSfx("ui_confirm");
      lives = START_LIVES;
      loadLevel(levelIndex);
      state = "playing";
      A.stopMusic();
      A.startGameMusic(level.sector);
      hideOverlay();
    } else if (state === "winall") {
      A.playSfx("ui_confirm");
      hideOverlay();
      if (Home) Home.start();
      if (homeScreen) homeScreen.hidden = false;
      if (gameWrap) gameWrap.hidden = true;
      state = "title";
      A.startTitleMusic();
    }
  });

  if (homeVolMusic) homeVolMusic.addEventListener("input", applyVolumes);
  if (homeVolSfx) homeVolSfx.addEventListener("input", applyVolumes);

  if (btnCutsceneNext) {
    btnCutsceneNext.addEventListener("click", () => {
      if (state === "cutscene") advanceCutscene();
    });
  }

  function syncVolFromHome() {
    applyVolumes();
  }

  if (btnHomePlay) {
    btnHomePlay.addEventListener("click", () => {
      A.resume();
      syncVolFromHome();
      A.playSfx("ui_confirm");
      if (Home) Home.stop();
      showPlayingLayout();
      const sel = homeStartLevel ? parseInt(homeStartLevel.value, 10) : 1;
      const startIdx = clamp(Number.isFinite(sel) ? sel - 1 : 0, 0, LEVELS.length - 1);
      newRun(startIdx);

      const beginPlay = () => {
        showPlayingLayout();
        state = "playing";
        lastMusicSector = level.sector;
        A.stopMusic();
        A.startGameMusic(level.sector);
        lastT = 0;
        if (canvas && typeof canvas.focus === "function") {
          try {
            canvas.focus({ preventScroll: true });
          } catch (_) {
            canvas.focus();
          }
        }
      };

      if (startIdx === 0 && Story && typeof Story.getIntro === "function") {
        const intro = Story.getIntro();
        if (intro && intro.length > 0) {
          beginCutscene(intro, beginPlay, "PROLOGUE");
          return;
        }
      }
      beginPlay();
    });
  }

  initStars();
  level = LEVELS[0];
  loadLevel(0);
  state = "title";
  A.resume();
  applyVolumes();
  if (Home) Home.start();

  requestAnimationFrame(loop);
})();
