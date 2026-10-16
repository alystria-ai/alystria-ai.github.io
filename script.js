/* Alystria · a small page with a resident character */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finePointer = matchMedia("(pointer: fine)").matches;
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");

  // localStorage can throw (private mode, blocked storage); everything works without it
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* forget quietly */ } },
  };

  const LINKS = {
    youtube: "https://www.youtube.com/@AlystriaAI",
    patreon: "https://www.patreon.com/cw/AlystriaAI",
    github: "https://github.com/alystria-ai",
    discord: "https://discord.gg/3p2FzjZQZ",
    chess: "https://chessbuddy.live",
  };

  // Calls `fn(visible)` whenever `el` scrolls in or out of view.
  function whenVisible(el, fn, options = { threshold: 0.15 }) {
    new IntersectionObserver(([e]) => fn(e.isIntersecting), options).observe(el);
  }

  $("#year").textContent = new Date().getFullYear();

  /* ── Motion: the OS setting or the pause button stills the page ── */
  const Motion = (() => {
    const btn = $("#motionToggle");
    const label = $(".sr", btn);
    const listeners = [];
    let paused = store.get("alystria.still") === "1";
    const still = () => paused || reducedQuery.matches;

    function apply() {
      document.documentElement.classList.toggle("still", paused);
      btn.setAttribute("aria-pressed", String(paused));
      btn.title = label.textContent = paused ? "Play animations" : "Pause animations";
      listeners.forEach((fn) => fn(still()));
    }
    btn.addEventListener("click", () => {
      paused = !paused;
      store.set("alystria.still", paused ? "1" : "0");
      apply();
    });
    if (reducedQuery.addEventListener) reducedQuery.addEventListener("change", apply);
    apply();

    return {
      get still() { return still(); },
      onChange(fn) { listeners.push(fn); },
    };
  })();

  /* ── Stars: three box-shadow fields instead of a hundred elements ── */
  {
    const field = $("#stars");
    const perLayer = innerWidth < 700 ? 22 : 40;
    for (let l = 0; l < 3; l++) {
      const shadows = [];
      for (let i = 0; i < perLayer; i++) {
        shadows.push(`${rand(0, 100).toFixed(2)}vw ${rand(0, 88).toFixed(2)}vh 0 0 rgba(255,255,255,${rand(0.45, 1).toFixed(2)})`);
      }
      const layer = document.createElement("i");
      layer.style.boxShadow = shadows.join(",");
      field.appendChild(layer);
    }
  }

  /* ── Reveal on scroll ── */
  {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ── Nav: underline the section you're in, and firm up once scrolled ── */
  {
    const nav = $(".nav");
    const solid = () => nav.classList.toggle("solid", scrollY > 40);
    addEventListener("scroll", solid, { passive: true });
    solid();
    const links = new Map($$(".nav nav a").map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const a = links.get(e.target.id);
        if (a) a.classList.toggle("here", e.isIntersecting);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ── The mane: iridescent strands that flow and part around the cursor ── */
  {
    const canvas = $("#mane");
    const hero = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const PALETTE = [[111, 231, 255], [106, 168, 255], [167, 123, 255], [255, 122, 217]];
    const strands = [];
    const mouse = { x: -9999, y: -9999, pull: 0 };
    let w = 0, h = 0, rect = { left: 0, top: 0 };
    let running = false, raf = 0, visible = true, frameNo = 0;

    const colorAt = (t) => {
      t = ((t % 1) + 1) % 1;
      const f = t * PALETTE.length;
      const a = PALETTE[Math.floor(f)];
      const b = PALETTE[(Math.floor(f) + 1) % PALETTE.length];
      const k = f - Math.floor(f);
      return a.map((v, i) => Math.round(v + (b[i] - v) * k));
    };

    const N = innerWidth < 700 ? 16 : 28;
    for (let i = 0; i < N; i++) {
      strands.push({
        t: i / (N - 1),
        amp: rand(18, 54),
        freq: rand(0.0016, 0.0032),
        speed: rand(0.00022, 0.0005),
        phase: rand(0, Math.PI * 2),
        width: rand(0.7, 2.6),
        alpha: rand(0.3, 0.75),
        grad: null,
      });
    }

    function measure() {
      const r = canvas.getBoundingClientRect();
      rect = { left: r.left, top: r.top };
      return r;
    }

    function resize() {
      const r = measure();
      if (Math.round(r.width) === Math.round(w) && Math.round(r.height) === Math.round(h)) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      strands.forEach((s) => (s.grad = null));
      if (!running) frame(performance.now());
    }

    function gradientFor(s, hue) {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      const base = s.t * 0.6 + hue;
      const c0 = colorAt(base), c1 = colorAt(base + 0.33), c2 = colorAt(base + 0.66);
      g.addColorStop(0, `rgba(${c0},0)`);
      g.addColorStop(0.3, `rgba(${c0},${s.alpha * 0.4})`);
      g.addColorStop(0.65, `rgba(${c1},${s.alpha})`);
      g.addColorStop(1, `rgba(${c2},${s.alpha * 0.8})`);
      return g;
    }

    function frame(now) {
      frameNo++;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      mouse.pull += ((mouse.x > -999 ? 1 : 0) - mouse.pull) * 0.05;
      const step = w < 700 ? 18 : 12;
      const spread = h * 0.24;
      const hue = now * 0.00003;
      const recolor = frameNo % 6 === 0; // the colours drift slowly; no need to rebuild gradients every frame

      for (let si = 0; si < strands.length; si++) {
        const s = strands[si];
        ctx.beginPath();
        for (let x = -40; x <= w + 40; x += step) {
          const nx = x / w;
          // a band that sweeps up to the right and fans out like a mane
          let y = h * (0.78 - nx * 0.36) + (s.t - 0.5) * spread * (0.45 + nx * 0.9);
          y += Math.sin(x * s.freq + now * s.speed + s.phase) * s.amp;
          y += Math.sin(x * s.freq * 2.3 - now * s.speed * 1.6 + s.phase * 2) * s.amp * 0.3;
          if (mouse.pull > 0.01) {
            const dx = x - mouse.x, dy = y - mouse.y;
            const f = Math.exp(-(dx * dx + dy * dy) / (2 * 130 * 130));
            y += Math.tanh(dy / 50) * f * 64 * mouse.pull;
          }
          x === -40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        if (!s.grad || recolor) s.grad = gradientFor(s, hue);
        ctx.strokeStyle = s.grad;
        ctx.lineWidth = s.width;
        ctx.stroke();
        if (si % 2 === 0) {
          ctx.lineWidth = s.width * 9;
          ctx.globalAlpha = 0.06;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      if (running) raf = requestAnimationFrame(frame);
    }

    function update() {
      const on = visible && !Motion.still && !document.hidden;
      hero.classList.toggle("off", !visible);
      if (on === running) return;
      running = on;
      if (on) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    }

    resize();
    frame(performance.now()); // a still frame, also the reduced-motion view
    new ResizeObserver(resize).observe(canvas);
    addEventListener("scroll", () => { if (visible) measure(); }, { passive: true });
    addEventListener("pointermove", (e) => {
      if (!visible) return;
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
    whenVisible(canvas, (v) => { visible = v; if (v) measure(); update(); }, { threshold: 0 });
    document.addEventListener("visibilitychange", update);
    Motion.onChange(update);
  }

  /* ── Lys: follows you, perches on headings, sleeps, remembers, can be thrown ── */
  const Lys = (() => {
    const el = $("#lys");
    const bubble = $("#bubble");
    const said = $("#lysSaid");
    const eyes = $(".eyes", el);
    const psst = $("#psst");
    if (finePointer) psst.hidden = false; // on touch screens the greeting says it instead

    let x = 0, y = 0, vx = 0, vy = 0;
    let mode = "float"; // float | drag | thrown
    let rot = 0, squash = 0, spin = 0;
    let dropped = null; // still mode: where Lys was put down
    let hardThrow = false;
    let sleeping = false, dizzyUntil = 0;
    let lastInput = performance.now();
    const pointer = { x: -1, y: -1, t: -1e9 };
    let running = false, lastTick = 0;
    let bubbleUntil = 0, bubbleW = 0, bubbleH = 0, lastSpoke = 0, lastLine = "";

    // Lys remembers you (only in this browser)
    const visits = (parseInt(store.get("alystria.visits"), 10) || 0) + 1;
    store.set("alystria.visits", String(visits));
    let throws = parseInt(store.get("alystria.throws"), 10) || 0;

    const LINES = {
      click: [
        "hi! I'm Lys.",
        "I live on this page. The rent is very reasonable.",
        "you can throw me, you know. I won't mind. much.",
        "everything here is made by one person. and me. I help.",
        "most of it is free, and the code is open.",
        "the real characters can hear you. I can only read.",
        "my mane matches the logo. on purpose.",
        "I'm watching your cursor. it's a very nice cursor.",
      ],
      grab: ["hey!", "where are we going?", "wheee", "up we go!"],
      dizzy: ["whoa… the room is spinning.", "everything is purple now.", "ok. ok. I'm fine.", "do that again and I'm telling."],
      soft: ["again!", "nice landing, if I say so myself.", "thanks for the ride."],
      wake: ["oh! you're back.", "I wasn't asleep. I was resting my eyes.", "mm? hi."],
    };

    /* perches: cached in page coordinates so the loop never measures layout */
    let perches = [];
    function measurePerches() {
      perches = $$("[data-perch]").map((p) => {
        const r = p.getBoundingClientRect();
        return { top: r.top + scrollY, right: r.right, height: r.height, onTop: p.hasAttribute("data-perch-top") };
      });
    }

    function home() {
      const small = innerWidth < 600;
      // on touch screens the bottom-right corner is where Send buttons live
      return { x: finePointer ? innerWidth - (small ? 52 : 80) : 54, y: innerHeight - (small ? 64 : 90) };
    }

    function perchTarget() {
      const mid = innerHeight / 2;
      let best = null, bestD = Infinity;
      for (const p of perches) {
        const top = p.top - scrollY;
        if (top < 90 || top + p.height > innerHeight - 40) continue;
        const d = Math.abs(top + p.height / 2 - mid);
        if (d < bestD) { bestD = d; best = { ...p, top }; }
      }
      if (!best) return null;
      // sit at the end of the heading; with no room beside it, sit on top (if allowed) or wait in the corner
      if (best.right + 60 < innerWidth) return { x: best.right + 44, y: best.top + Math.min(best.height * 0.3, 40) };
      if (best.onTop) return { x: best.right - 46, y: best.top - 34 };
      return null;
    }

    function target(now) {
      if (Motion.still) return dropped || home();
      if (Math.hypot(pointer.x - x, pointer.y - y) < 110 && now - pointer.t < 4000) return { x, y }; // let people come close
      if (finePointer && now - pointer.t < 2600) {
        const side = pointer.x > innerWidth * 0.62 ? -1 : 1;
        return { x: pointer.x + side * 78, y: pointer.y - 58 };
      }
      return perchTarget() || home();
    }

    function wakeLoop() {
      if (running) return;
      running = true;
      lastTick = performance.now();
      requestAnimationFrame(tick);
    }

    function say(text, ms = 3400, force = false) {
      const now = performance.now();
      if (!force && now < bubbleUntil) return false;
      bubble.textContent = text;
      bubbleW = bubble.offsetWidth;
      bubbleH = bubble.offsetHeight;
      bubble.classList.add("show");
      bubbleUntil = now + ms;
      lastSpoke = now;
      lastLine = text;
      setHappy(1400);
      wakeLoop();
      return true;
    }

    let happyTimer = 0;
    function setHappy(ms) {
      el.classList.add("happy");
      clearTimeout(happyTimer);
      if (ms) happyTimer = setTimeout(() => el.classList.remove("happy"), ms);
    }

    function talk() {
      let line;
      do line = pick(LINES.click); while (line === lastLine);
      say(line, 3400, true);
      said.textContent = "Lys says: " + line; // announced only when asked for
      if (mode === "float" && !Motion.still) vy -= 5; // a little hop
      hidePsst();
    }

    const hidePsst = () => psst && psst.classList.add("gone");

    function wake() {
      lastInput = performance.now();
      if (sleeping) {
        sleeping = false;
        el.classList.remove("sleeping");
        say(pick(LINES.wake), 2800, true);
      }
      wakeLoop();
    }

    function tick(now) {
      const dt = clamp((now - lastTick) / 16.67, 0.2, 3);
      lastTick = now;
      const floor = innerHeight - 40;
      let settled = false;

      if (mode === "float") {
        const t = target(now);
        t.x = clamp(t.x, 44, innerWidth - 44);
        t.y = clamp(t.y, 96, innerHeight - 44);
        if (Motion.still) {
          x = t.x; y = t.y; vx = vy = 0;
        } else {
          vx += (t.x - x) * 0.016 * dt;
          vy += (t.y - y) * 0.016 * dt;
          const damp = Math.pow(0.88, dt);
          vx *= damp; vy *= damp;
          const sp = Math.hypot(vx, vy);
          if (sp > 13) { vx *= 13 / sp; vy *= 13 / sp; }
          x += vx * dt; y += vy * dt;
        }
        rot += (clamp(vx * 2.2, -18, 18) - rot) * (1 - Math.pow(0.85, dt));
        spin *= Math.pow(0.9, dt);
        settled = Math.abs(t.x - x) < 0.3 && Math.abs(t.y - y) < 0.3 && Math.hypot(vx, vy) < 0.02;
      } else if (mode === "thrown") {
        vy += 0.75 * dt;
        x += vx * dt; y += vy * dt;
        spin += vx * 1.6 * dt;
        if (x < 40) { x = 40; vx = -vx * 0.6; }
        if (x > innerWidth - 40) { x = innerWidth - 40; vx = -vx * 0.6; }
        if (y < 60) { y = 60; vy = -vy * 0.5; }
        if (y > floor) {
          y = floor;
          if (Math.abs(vy) > 3) { squash = Math.min(0.35, Math.abs(vy) / 40); vy = -vy * 0.5; vx *= 0.8; }
          else { vy = 0; vx *= Math.pow(0.85, dt); }
        }
        if (y >= floor - 0.5 && Math.abs(vy) < 0.5 && Math.abs(vx) < 0.4) land(now);
      }

      squash *= Math.pow(0.85, dt);
      const angle = mode === "thrown" ? spin : rot + spin;
      el.style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) ` +
        `scale(${(1 + squash).toFixed(3)}, ${(1 - squash).toFixed(3)})`;

      // eyes follow the cursor
      if (pointer.x >= 0 && !sleeping) {
        const dx = pointer.x - x, dy = pointer.y - y, d = Math.hypot(dx, dy) || 1;
        eyes.style.transform = `translate(${(dx / d * 3.6).toFixed(2)}px, ${(dy / d * 3).toFixed(2)}px)`;
      }

      if (dizzyUntil && now > dizzyUntil) { dizzyUntil = 0; el.classList.remove("dizzy"); }

      // the speech bubble rides along, staying on screen
      const talking = bubble.classList.contains("show");
      if (talking) {
        if (now > bubbleUntil) bubble.classList.remove("show");
        const left = clamp(x - bubbleW / 2, 12, innerWidth - bubbleW - 12);
        const below = y - 60 - bubbleH < 70;
        const top = below ? y + 44 : y - 58 - bubbleH;
        bubble.classList.toggle("below", below);
        bubble.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
        bubble.style.setProperty("--tail", clamp(x - left, 18, bubbleW - 18).toFixed(1) + "px");
      }

      // rest when nothing is moving; any input, scroll or remark wakes the loop again
      const resting = mode === "float" && settled && !talking && !dizzyUntil &&
        Math.abs(rot) < 0.05 && Math.abs(spin) < 0.05 && squash < 0.002;
      if (resting) running = false;
      else requestAnimationFrame(tick);
    }

    function land(now) {
      mode = "float";
      el.classList.remove("thrown");
      vx = vy = 0;
      if (hardThrow) {
        throws++;
        store.set("alystria.throws", String(throws));
        dizzyUntil = now + 2400;
        el.classList.add("dizzy");
        const line = throws === 1 ? "whoa… nobody's ever thrown me before."
          : throws % 5 === 0 ? `that's throw number ${throws}. I'm keeping count.`
          : pick(LINES.dizzy);
        say(line, 2900, true);
      } else {
        say(pick(LINES.soft), 2400, true);
      }
      hardThrow = false;
      if (Motion.still) dropped = { x, y };
    }

    // blinking and dozing off run on timers, not in the frame loop
    (function blink() {
      if (!sleeping && !dizzyUntil && !document.hidden) {
        el.classList.add("blink");
        setTimeout(() => el.classList.remove("blink"), 130);
      }
      setTimeout(blink, rand(2200, 6000));
    })();
    setInterval(() => {
      if (!sleeping && mode === "float" && !dizzyUntil && performance.now() - lastInput > 28000) {
        sleeping = true;
        el.classList.add("sleeping");
        bubble.classList.remove("show");
      }
    }, 2000);

    /* grabbing and throwing */
    let down = null; // { id, ox, oy, sx, sy, moved, samples }
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or stale pointer */ }
      down = { id: e.pointerId, ox: e.clientX - x, oy: e.clientY - y, sx: e.clientX, sy: e.clientY, moved: false, samples: [] };
      wake();
    });
    el.addEventListener("pointermove", (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (!down.moved && Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > 6) {
        down.moved = true;
        mode = "drag";
        el.classList.add("dragging");
        if (dizzyUntil) { dizzyUntil = 0; el.classList.remove("dizzy"); }
        say(pick(LINES.grab), 1600, true);
        hidePsst();
      }
      if (down.moved) {
        x = e.clientX - down.ox;
        y = e.clientY - down.oy;
        down.samples.push({ x, y, t: e.timeStamp });
        if (down.samples.length > 8) down.samples.shift();
        wakeLoop();
      }
    });
    el.addEventListener("pointerup", (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      el.classList.remove("dragging");
      if (!d.moved) { talk(); return; }
      // velocity from the last ~90ms of movement, in px per frame
      const recent = d.samples.filter((s) => e.timeStamp - s.t < 90);
      let tvx = 0, tvy = 0;
      if (recent.length > 1) {
        const a = recent[0], b = recent[recent.length - 1];
        const ms = Math.max(b.t - a.t, 8);
        tvx = ((b.x - a.x) / ms) * 16.67;
        tvy = ((b.y - a.y) / ms) * 16.67;
      }
      if (Motion.still) { dropped = { x, y }; mode = "float"; return; }
      vx = clamp(tvx, -45, 45);
      vy = clamp(tvy, -45, 45);
      hardThrow = Math.hypot(tvx, tvy) > 16;
      mode = "thrown";
      el.classList.add("thrown");
      wakeLoop();
    });
    el.addEventListener("pointercancel", (e) => {
      if (!down || e.pointerId !== down.id) return;
      // the browser took the gesture (long-press, scroll); just let go
      down = null;
      el.classList.remove("dragging");
      if (mode === "drag") mode = "float";
      wakeLoop();
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wake(); talk(); }
    });
    if (finePointer) {
      el.addEventListener("pointerenter", () => { setHappy(0); el.classList.remove("blink"); });
      el.addEventListener("pointerleave", () => setHappy(600));
    }

    /* anything the visitor does keeps Lys awake */
    addEventListener("pointermove", (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now();
      wake();
    }, { passive: true });
    for (const ev of ["scroll", "keydown", "touchstart"]) addEventListener(ev, wake, { passive: true });
    addEventListener("resize", () => {
      x = clamp(x, 40, innerWidth - 40);
      y = clamp(y, 60, innerHeight - 40);
      measurePerches();
      wakeLoop();
    });
    new ResizeObserver(() => { measurePerches(); wakeLoop(); }).observe(document.body);
    if (document.fonts) document.fonts.ready.then(measurePerches);

    // step aside while someone is typing
    document.addEventListener("focusin", (e) => { if (e.target.matches("input, textarea")) el.classList.add("shy"); });
    document.addEventListener("focusout", (e) => { if (e.target.matches("input, textarea")) el.classList.remove("shy"); });

    // notice small things
    document.addEventListener("copy", () => say("taking notes? I'm flattered.", 2600));
    let awaySince = 0;
    const title = document.title;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        awaySince = performance.now();
        document.title = "Lys misses you · Alystria";
      } else {
        document.title = title;
        if (performance.now() - awaySince > 5000) {
          if (sleeping) wake();
          else say(pick(["oh! you're back.", "welcome back. I kept your seat warm.", "there you are."]), 2800, true);
        }
      }
    });

    // remarks when hovering things Lys has opinions about
    if (finePointer) {
      const heardAt = new WeakMap();
      for (const t of $$("[data-hover-say]")) {
        let timer = 0;
        t.addEventListener("pointerenter", () => {
          timer = setTimeout(() => {
            const now = performance.now();
            if (mode === "drag" || sleeping || now - (heardAt.get(t) || -1e9) < 20000 || now - lastSpoke < 2500) return;
            if (say(t.dataset.hoverSay, 3000)) heardAt.set(t, now);
          }, 450);
        });
        t.addEventListener("pointerleave", () => clearTimeout(timer));
      }
    }

    // a remark the first time each section reaches the middle of the screen
    const heard = new Set();
    const sayObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || heard.has(e.target)) continue;
        heard.add(e.target);
        if (mode !== "drag" && !sleeping && performance.now() - lastSpoke > 4000) say(e.target.dataset.say, 3000);
      }
    }, { rootMargin: "-40% 0px -40% 0px" });
    $$("[data-say]").forEach((s) => sayObserver.observe(s));

    Motion.onChange(() => { dropped = null; wakeLoop(); });

    // arrive from below the fold
    measurePerches();
    const h0 = home();
    x = h0.x; y = h0.y + 140;
    wakeLoop();
    setTimeout(() => {
      el.classList.add("ready");
      say(visits > 1 ? `you came back! that's visit #${visits}. I remembered.`
        : finePointer ? "hi! I'm Lys. welcome to Alystria." : "hi! I'm Lys. you can drag me around.", 4200, true);
    }, 900);
    setTimeout(hidePsst, 16000);

    return {
      hop() { if (mode === "float" && !Motion.still) vy -= 7; setHappy(1400); wake(); },
    };
  })();

  /* ── Game scene: a companion by the fire ── */
  {
    const stage = $(".stage-game");
    const sub = $("#gameSub");
    const who = $("b", sub), text = $("span", sub);
    const SCRIPT = [
      ["YOU", "Think they'll follow us?"],
      ["MIRA", "Let them. I've been wanting a rematch."],
      ["MIRA", "You went left when I said right, by the way."],
      ["YOU", "…I was flanking."],
      ["MIRA", "Sure you were."],
      ["MIRA", "Nice sword. Where'd you find it?"],
      ["YOU", "A chest."],
      ["MIRA", "Mm-hm. A chest that belonged to someone."],
    ];
    let i = 0, active = false, visible = false, timer = 0;
    function next() {
      if (!active) return;
      const [speaker, line] = SCRIPT[i++ % SCRIPT.length];
      who.textContent = speaker;
      let n = 0;
      (function type() {
        text.textContent = line.slice(0, ++n);
        timer = n < line.length ? setTimeout(type, 32) : setTimeout(next, 2300);
      })();
    }
    function update() {
      const on = visible && !Motion.still;
      stage.classList.toggle("paused", !visible);
      if (on === active) return;
      active = on;
      clearTimeout(timer);
      if (on) next();
      else if (!text.textContent) { who.textContent = SCRIPT[1][0]; text.textContent = SCRIPT[1][1]; }
    }
    whenVisible(stage, (v) => { visible = v; update(); });
    Motion.onChange(update);
    update();
  }

  /* ── Chess scene: a coach with opinions ── */
  {
    const boardEl = $("#board");
    const stage = boardEl.closest(".stage");
    const says = $("#coachSays");
    const face = $(".coach-face");
    const TEXT = "︎"; // render glyphs as text, never emoji
    const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
    const START = [
      "rnbqkbnr", "pppppppp", "........", "........",
      "........", "........", "PPPPPPPP", "RNBQKBNR",
    ];
    const MOVES = [
      ["e2", "e4", "e4. Bold. The centre is yours."],
      ["e7", "e5", "They match you. Fair enough."],
      ["g1", "f3", "Knight out, eyeing e5."],
      ["b8", "c6", "Defended. How polite."],
      ["f1", "c4", "Bishop on c4. Staring at f7."],
      ["g8", "f6", "Two Knights. Brave of them."],
      ["f3", "g5", "Ooh. Going after f7 already?"],
      ["d7", "d5", "Good reply. They hit back."],
      ["e4", "d5", "Take it. Free pawn, for now."],
      ["f6", "d5", "Hm. That knight looks loose…"],
      ["g5", "f7", "The Fried Liver! I'm so proud."],
    ];
    const idx = (sq) => (8 - Number(sq[1])) * 8 + (sq.charCodeAt(0) - 97);
    const squares = [];
    let state = [];

    for (let i = 0; i < 64; i++) {
      const d = document.createElement("div");
      d.className = "sq" + (((i >> 3) + (i & 7)) % 2 ? " d" : "");
      boardEl.appendChild(d);
      squares.push(d);
    }

    function paint(i) {
      const c = state[i];
      squares[i].textContent = "";
      if (c === ".") return null;
      const s = document.createElement("span");
      s.className = c === c.toUpperCase() ? "w" : "b";
      s.textContent = GLYPH[c.toLowerCase()] + TEXT;
      squares[i].appendChild(s);
      return s;
    }

    function reset() {
      state = START.join("").split("");
      squares.forEach((sq, i) => { sq.classList.remove("hl"); paint(i); });
    }

    function move(a, b) {
      state[b] = state[a];
      state[a] = ".";
      paint(a);
      const piece = paint(b);
      squares.forEach((sq) => sq.classList.remove("hl"));
      squares[a].classList.add("hl");
      squares[b].classList.add("hl");
      if (!piece || Motion.still) return;
      // slide from the old square: each square is 100% of the piece's own box
      const dx = (a & 7) - (b & 7), dy = (a >> 3) - (b >> 3);
      piece.style.transform = `translate(${dx * 100}%, ${dy * 100}%)`;
      piece.classList.add("moving");
      piece.getBoundingClientRect();
      requestAnimationFrame(() => (piece.style.transform = ""));
    }

    let m = 0, active = false, visible = false, timer = 0;
    function step() {
      if (!active) return;
      if (m === MOVES.length) {
        timer = setTimeout(() => {
          reset();
          m = 0;
          says.textContent = "Again? I'll act surprised.";
          timer = setTimeout(step, 2400);
        }, 3600);
        return;
      }
      const [from, to, comment] = MOVES[m++];
      move(idx(from), idx(to));
      says.textContent = comment;
      face.classList.remove("nod");
      void face.offsetWidth;
      face.classList.add("nod");
      timer = setTimeout(step, 2500);
    }
    function update() {
      const on = visible && !Motion.still;
      stage.classList.toggle("paused", !visible);
      if (on === active) return;
      active = on;
      clearTimeout(timer);
      if (on) timer = setTimeout(step, 900);
    }

    reset();
    whenVisible(boardEl, (v) => { visible = v; update(); });
    Motion.onChange(update);
  }

  /* ── Desktop scene: pause the walk while off screen ── */
  whenVisible($(".stage-desk"), (v) => $(".stage-desk").classList.toggle("paused", !v));

  /* ── Chat with Lys (scripted, and honest about it) ── */
  {
    const log = $("#log");
    const form = $("#sayForm");
    const input = $("#sayInput");
    const a = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
    const REPLIES = [
      [/\bwho\b|your name|what are you\b/, "I'm Lys, the little character who lives on this page. Alystria makes characters like me, only much, much smarter."],
      [/\b(free|cost|costs|price|pay|paid|money)\b/, `Almost everything is released for free, and the code is open. If you'd like to help keep it that way, there's a ${a(LINKS.patreon, "Patreon")}.`],
      [/\b(watch|video|videos|youtube|demo|demos)\b/, `The demos and devlogs live on ${a(LINKS.youtube, "YouTube")}. My favourite is the one with the chess coaches.`],
      [/\b(code|github|open ?source|source|repo|repos)\b/, `It's all on ${a(LINKS.github, "GitHub")}. Read it, fork it, build your own characters.`],
      [/\b(discord|community|server|chat with)\b/, `Come hang out on ${a(LINKS.discord, "Discord")}. Bring snacks.`],
      [/\b(patreon|support|donate)\b/, `That's very kind. ${a(LINKS.patreon, "Patreon")} is the place. Watching and sharing helps a lot too.`],
      [/\b(local|locally|offline|privacy|private|internet)\b/, "A lot of it can run entirely on your own PC. No account, no key, no internet."],
      [/\bchess\b/, `${a(LINKS.chess, "Chessbuddy")} is a chess game you can talk through. The coaches explain the why behind every move.`],
      [/\b(pet|pets|desktop)\b/, "The desktop pets walk your taskbar, climb your windows and chase your cursor. I'm their cousin."],
      [/\b(game|games|mod|mods|companion|companions|npc|npcs)\b/, "The game mods let you talk to characters by voice or text. They travel with you, fight beside you and comment on your loot. A bit like me, but braver."],
      [/what (do|does) (you|alystria|they) (do|make|build)|\b(make|makes|making|build|builds|projects?)\b/, "Companions for games you already play, chess coaches you can talk to, and tiny creatures that live on your desktop. They listen, answer out loud and remember you."],
      [/\b(throw|thrown|dizzy|grab)\b/, "You can, you know. Just grab me and let go. I'll only complain a little."],
      [/\b(cute|love|adorable|sweet)\b/, "stop it. (don't stop.)"],
      [/\b(thanks|thank you|thx|ty)\b/, "anytime ✦"],
      [/\b(bye|goodbye|cya|see you)\b/, "bye! come back soon. I'll remember."],
      [/\b(hi|hello|hey|hiya|yo|sup)\b/, "hi!! ✦ ask me what Alystria makes, or whether it's free."],
    ];
    const FALLBACK = [
      "I'm only a tiny scripted character, so that one went right over my horn. Try asking what Alystria makes?",
      "hmm, I don't know that one. The real characters would, though.",
      "I'm better at being thrown than at answering that. Ask me about the games, the chess or the pets?",
    ];

    function add(from, html, typing = false) {
      const li = document.createElement("li");
      li.className = "msg from-" + from + (typing ? " typing" : "");
      if (typing) {
        li.setAttribute("aria-hidden", "true");
        li.innerHTML = "<span></span><span></span><span></span>";
      } else {
        const who = document.createElement("span");
        who.className = "sr";
        who.textContent = from === "you" ? "You: " : "Lys: ";
        const body = document.createElement("span");
        if (from === "you") body.textContent = html;
        else body.innerHTML = html;
        li.append(who, body);
      }
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
      return li;
    }

    function reply(q) {
      const s = q.toLowerCase();
      for (const [re, r] of REPLIES) if (re.test(s)) return r;
      return pick(FALLBACK);
    }

    // messages wait their turn instead of being dropped
    const queue = [];
    let busy = false;
    function send(q) {
      q = q.trim();
      if (!q) return;
      queue.push(q);
      if (!busy) drain();
    }
    function drain() {
      const q = queue.shift();
      if (q === undefined) { busy = false; return; }
      busy = true;
      add("you", q);
      const typing = add("lys", "", true);
      setTimeout(() => {
        typing.remove();
        add("lys", reply(q));
        Lys.hop();
        drain();
      }, rand(650, 1150));
    }

    add("lys", "hey. ask me anything. (well. a few things.)");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      send(input.value);
      input.value = "";
    });
    $$("#chips button").forEach((b) => b.addEventListener("click", () => send(b.textContent)));
  }
})();
