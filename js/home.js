/**
 * Title screen: full-viewport animated cyber grid + drift particles.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("homeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  let raf = 0;
  let running = false;
  let t0 = 0;
  let stars = [];
  let particles = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (stars.length === 0) {
      for (let i = 0; i < 120; i++) {
        stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          s: 0.3 + Math.random() * 1.2,
          tw: Math.random() * Math.PI * 2,
          sp: 0.02 + Math.random() * 0.04,
        });
      }
      for (let i = 0; i < 45; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 18,
          vy: -20 - Math.random() * 40,
          life: Math.random(),
        });
      }
    }
  }

  function frame(now) {
    if (!running) return;
    if (!t0) t0 = now;
    const t = (now - t0) * 0.001;
    const W = window.innerWidth;
    const H = window.innerHeight;

    const g = ctx.createLinearGradient(0, 0, W, H);
    const pulse = 0.5 + Math.sin(t * 0.7) * 0.08;
    g.addColorStop(0, `rgb(${8 + pulse * 20},${6 + pulse * 10},${22 + pulse * 30})`);
    g.addColorStop(0.45, "#060612");
    g.addColorStop(1, `rgb(${12 + pulse * 15},${4 + pulse * 8},${18 + pulse * 25})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const gridY = (t * 22) % 40;
    ctx.strokeStyle = "rgba(0, 255, 200, 0.06)";
    ctx.lineWidth = 1;
    for (let y = -gridY; y < H + 40; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const gridX = (t * 18) % 48;
    ctx.strokeStyle = "rgba(255, 61, 127, 0.045)";
    for (let x = -gridX; x < W + 48; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (const st of stars) {
      st.tw += st.sp;
      const a = 0.15 + Math.sin(st.tw) * 0.35;
      ctx.fillStyle = `rgba(180,220,255,${a * st.s})`;
      ctx.fillRect(st.x | 0, st.y | 0, 1, 1);
    }

    for (const p of particles) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.life += 0.016;
      if (p.y < -20 || p.x < -40 || p.x > W + 40) {
        p.x = Math.random() * W;
        p.y = H + 10;
        p.vx = (Math.random() - 0.5) * 14;
        p.vy = -18 - Math.random() * 35;
      }
      ctx.fillStyle = `rgba(0,255,200,${0.12 + Math.sin(p.life * 3) * 0.06})`;
      ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
    }

    const scan = (t * 80) % 255;
    ctx.fillStyle = `rgba(0,0,0,${0.03 + (scan / 255) * 0.04})`;
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    raf = requestAnimationFrame(frame);
  }

  function initLevelPicker() {
    const select = document.getElementById("homeStartLevel");
    const picker = document.getElementById("homeLevelPicker");
    if (!select || !picker) return;
    const trigger = document.getElementById("homeLevelTrigger");
    const dropdown = document.getElementById("homeLevelDropdown");
    const numEl = document.getElementById("homeLevelNum");
    const nameEl = document.getElementById("homeLevelName");
    if (!trigger || !dropdown || !numEl || !nameEl) return;

    function optionButtons() {
      return Array.from(dropdown.querySelectorAll(".home-level-option"));
    }

    function pad(n) {
      return String(n).padStart(2, "0");
    }

    function parseOptionText(text) {
      const m = text.trim().match(/^(\d+)\s*-\s*(.+)$/);
      return m ? { num: pad(m[1]), name: m[2] } : { num: pad(select.value), name: text.trim() };
    }

    function syncTrigger() {
      const opt = select.options[select.selectedIndex];
      const { num, name } = parseOptionText(opt.textContent);
      numEl.textContent = num;
      nameEl.textContent = name;
      optionButtons().forEach((btn) => {
        const sel = btn.dataset.value === select.value;
        btn.classList.toggle("is-selected", sel);
        btn.setAttribute("aria-selected", sel ? "true" : "false");
      });
    }

    function openQ() {
      return !dropdown.hidden;
    }

    function setOpen(open) {
      picker.classList.toggle("is-open", open);
      dropdown.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        const cur = optionButtons().find((b) => b.dataset.value === select.value) || optionButtons()[0];
        if (cur) cur.focus();
      } else {
        trigger.focus();
      }
    }

    function chooseValue(val) {
      select.value = val;
      syncTrigger();
      setOpen(false);
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!openQ());
    });

    optionButtons().forEach((btn) => {
      btn.addEventListener("click", () => chooseValue(btn.dataset.value));
    });

    document.addEventListener("mousedown", (e) => {
      if (!openQ()) return;
      if (!picker.contains(e.target)) setOpen(false);
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openQ()) {
        e.preventDefault();
        setOpen(false);
      }
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setOpen(!openQ());
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!openQ()) setOpen(true);
      } else if (e.key === "Escape" && openQ()) {
        e.preventDefault();
        setOpen(false);
      }
    });

    dropdown.addEventListener("keydown", (e) => {
      const opts = optionButtons();
      const i = opts.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(opts.length - 1, i < 0 ? 0 : i + 1);
        opts[next].focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, i <= 0 ? 0 : i - 1);
        opts[next].focus();
      }
      if (e.key === "Home") {
        e.preventDefault();
        opts[0].focus();
      }
      if (e.key === "End") {
        e.preventDefault();
        opts[opts.length - 1].focus();
      }
      if (e.key === "Enter" || e.key === " ") {
        if (i >= 0) {
          e.preventDefault();
          chooseValue(opts[i].dataset.value);
        }
      }
    });

    syncTrigger();
  }

  initLevelPicker();

  window.GRPHome = {
    start() {
      running = true;
      t0 = 0;
      resize();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      window.addEventListener("resize", resize);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
})();
