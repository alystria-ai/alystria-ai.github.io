/* Alystria · a small page with a resident character */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;

  const LINKS = {
    youtube: "https://www.youtube.com/@AlystriaAI",
    patreon: "https://www.patreon.com/cw/AlystriaAI",
    github: "https://github.com/alystria-ai",
    chess: "https://chessbuddy.live",
  };

  // Calls `fn(visible)` whenever `el` scrolls in or out of view.
  function whenVisible(el, fn, threshold = 0.15) {
    new IntersectionObserver(([e]) => fn(e.isIntersecting), { threshold }).observe(el);
  }

  $("#year").textContent = new Date().getFullYear();

  /* ── Stars ─────────────────────────────── */
  {
    const field = $("#stars");
    const count = innerWidth < 700 ? 50 : 110;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const s = document.createElement("i");
      s.style.left = rand(0, 100) + "%";
      s.style.top = rand(0, 85) + "%";
      s.style.setProperty("--d", rand(2.5, 7).toFixed(2) + "s");
      s.style.setProperty("--delay", rand(-7, 0).toFixed(2) + "s");
      if (Math.random() < 0.15) s.style.width = s.style.height = "3px";
      frag.appendChild(s);
    }
    field.appendChild(frag);
  }

  /* ── The mane: iridescent strands that flow and part around the cursor ── */
  {
    const canvas = $("#mane");
    const ctx = canvas.getContext("2d");
    const PALETTE = [[111, 231, 255], [106, 168, 255], [167, 123, 255], [255, 122, 217]];
    const strands = [];
    const mouse = { x: -9999, y: -9999, pull: 0 };
    let w = 0, h = 0, running = false, raf = 0;

    const colorAt = (t) => {
      t = ((t % 1) + 1) % 1;
      const f = t * PALETTE.length;
      const a = PALETTE[Math.floor(f)];
      const b = PALETTE[(Math.floor(f) + 1) % PALETTE.length];
      const k = f - Math.floor(f);
      return a.map((v, i) => Math.round(v + (b[i] - v) * k));
    };

    const N = innerWidth < 700 ? 18 : 30;
    for (let i = 0; i < N; i++) {
      strands.push({
        t: i / (N - 1),
        amp: rand(18, 54),
        freq: rand(0.0016, 0.0032),
        speed: rand(0.00022, 0.0005),
        phase: rand(0, Math.PI * 2),
        width: rand(0.7, 2.6),
        alpha: rand(0.3, 0.75),
      });
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      mouse.pull += ((mouse.x > -999 ? 1 : 0) - mouse.pull) * 0.05;
      const step = w < 700 ? 18 : 12;
      const spread = h * 0.24;
      const hue = now * 0.00003;

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
        const g = ctx.createLinearGradient(0, 0, w, 0);
        const c0 = colorAt(s.t * 0.6 + hue), c1 = colorAt(s.t * 0.6 + hue + 0.33), c2 = colorAt(s.t * 0.6 + hue + 0.66);
        g.addColorStop(0, `rgba(${c0},0)`);
        g.addColorStop(0.3, `rgba(${c0},${s.alpha * 0.45})`);
        g.addColorStop(0.65, `rgba(${c1},${s.alpha})`);
        g.addColorStop(1, `rgba(${c2},${s.alpha * 0.8})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = s.width;
        ctx.stroke();
        if (si % 2 === 0) {
          ctx.lineWidth = s.width * 10;
          ctx.globalAlpha = 0.06;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      if (running) raf = requestAnimationFrame(frame);
    }

    function setRunning(on) {
      on = on && !reduceMotion && !document.hidden;
      if (on === running) return;
      running = on;
      if (on) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    }

    resize();
    frame(performance.now()); // a still frame, also the reduced-motion view
    addEventListener("resize", () => { resize(); if (!running) frame(performance.now()); });
    addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
    let heroVisible = true;
    whenVisible(canvas, (v) => { heroVisible = v; setRunning(v); }, 0);
    document.addEventListener("visibilitychange", () => setRunning(heroVisible));
  }

  /* ── Lys: follows you, perches on headings, sleeps, can be thrown ── */
  const Lys = (() => {
    const el = $("#lys");
    const bubble = $("#bubble");
    const eyes = $(".eyes", el);
    const psst = $("#psst");
    const perches = $$("[data-perch]");

    let x = innerWidth - 80, y = innerHeight - 90, vx = 0, vy = 0;
    let mode = "float"; // float | drag | thrown
    let rot = 0, squash = 0, spin = 0;
    let dropped = null; // reduced motion: where Lys was put down
    let hardThrow = false;
    let sleeping = false, dizzyUntil = 0;
    let lastInput = performance.now();
    const pointer = { x: -1, y: -1, t: -1e9 };
    let lastTick = performance.now();
    let bubbleUntil = 0, lastSpoke = 0, lastLine = "";

    // Lys remembers you (only in this browser)
    let visits = 1;
    try {
      visits = (parseInt(localStorage.getItem("alystria.visits"), 10) || 0) + 1;
      localStorage.setItem("alystria.visits", String(visits));
    } catch (_) { /* storage blocked: Lys forgets, that's fine */ }

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

    function say(text, ms = 3400, force = false) {
      const now = performance.now();
      if (!force && now < bubbleUntil) return;
      bubble.textContent = text;
      bubble.classList.add("show");
      bubbleUntil = now + ms;
      lastSpoke = now;
      lastLine = text;
      setHappy();
    }

    let happyTimer = 0;
    function setHappy() {
      el.classList.add("happy");
      clearTimeout(happyTimer);
      happyTimer = setTimeout(() => el.classList.remove("happy"), 1400);
    }

    function talk() {
      let line;
      do line = pick(LINES.click); while (line === lastLine);
      say(line, 3400, true);
      if (mode === "float") vy -= 5; // a little hop
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
    }

    function home() {
      return { x: innerWidth - (innerWidth < 600 ? 52 : 80), y: innerHeight - (innerWidth < 600 ? 60 : 90) };
    }

    function perchTarget() {
      const mid = innerHeight / 2;
      let best = null, bestD = Infinity;
      for (const p of perches) {
        const r = p.getBoundingClientRect();
        if (r.top < 90 || r.bottom > innerHeight - 40) continue;
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (!best) return null;
      // sit at the end of the heading; with no room beside it, wait in the corner instead
      if (best.right + 60 < innerWidth) return { x: best.right + 44, y: best.top + best.height * 0.3 };
      return null;
    }

    function target(now) {
      if (reduceMotion) return dropped || home();
      const near = Math.hypot(pointer.x - x, pointer.y - y) < 110;
      if (near && now - pointer.t < 4000) return { x, y }; // let people come close enough to pick Lys up
      if (finePointer && now - pointer.t < 2600) {
        const side = pointer.x > innerWidth * 0.62 ? -1 : 1;
        return { x: pointer.x + side * 78, y: pointer.y - 58 };
      }
      return perchTarget() || home();
    }

    function tick(now) {
      const dt = clamp((now - lastTick) / 16.67, 0.2, 3);
      lastTick = now;
      const floor = innerHeight - 40;

      if (mode === "float") {
        const t = target(now);
        t.x = clamp(t.x, 44, innerWidth - 44);
        t.y = clamp(t.y, 96, innerHeight - 44);
        if (reduceMotion) {
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
        rot += (clamp(vx * 2.2, -18, 18) - rot) * 0.15;
        spin *= 0.9;
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

      squash *= 0.85;
      const bob = mode === "float" && !reduceMotion ? Math.sin(now / 650) * (sleeping ? 2 : 4) : 0;
      const angle = mode === "thrown" ? spin : rot + spin;
      el.style.transform =
        `translate3d(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) ` +
        `scale(${(1 + squash).toFixed(3)}, ${(1 - squash).toFixed(3)})`;

      // eyes follow the cursor
      if (pointer.x >= 0 && !sleeping) {
        const dx = pointer.x - x, dy = pointer.y - y, d = Math.hypot(dx, dy) || 1;
        eyes.style.transform = `translate(${(dx / d * 3.6).toFixed(2)}px, ${(dy / d * 3).toFixed(2)}px)`;
      }

      // moods
      if (dizzyUntil && now > dizzyUntil) { dizzyUntil = 0; el.classList.remove("dizzy"); }
      if (!sleeping && mode === "float" && !dizzyUntil && now - lastInput > 28000) {
        sleeping = true;
        el.classList.add("sleeping");
        bubble.classList.remove("show");
      }

      // speech bubble rides along, staying on screen
      if (bubble.classList.contains("show")) {
        if (now > bubbleUntil) bubble.classList.remove("show");
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        const left = clamp(x - bw / 2, 12, innerWidth - bw - 12);
        const below = y - 60 - bh < 70;
        const top = below ? y + 44 : y - 58 - bh;
        bubble.classList.toggle("below", below);
        bubble.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
        bubble.style.setProperty("--tail", clamp(x - left, 18, bw - 18).toFixed(1) + "px");
      }

      requestAnimationFrame(tick);
    }

    function land(now) {
      mode = "float";
      vx = vy = 0;
      if (hardThrow) {
        dizzyUntil = now + 2400;
        el.classList.add("dizzy");
        say(pick(LINES.dizzy), 2800, true);
      } else {
        say(pick(LINES.soft), 2400, true);
      }
      hardThrow = false;
      if (reduceMotion) dropped = { x, y };
    }

    // blinking
    (function blink() {
      if (!sleeping && !dizzyUntil) {
        el.classList.add("blink");
        setTimeout(() => el.classList.remove("blink"), 130);
      }
      setTimeout(blink, rand(2200, 6000));
    })();

    // grabbing and throwing
    let down = null; // { id, ox, oy, sx, sy, moved, samples }
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
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
      }
    });
    const release = (e) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      el.classList.remove("dragging");
      if (!d.moved) { talk(); return; }
      // velocity from the last ~80ms of movement, in px per frame
      const recent = d.samples.filter((s) => e.timeStamp - s.t < 90);
      let tvx = 0, tvy = 0;
      if (recent.length > 1) {
        const a = recent[0], b = recent[recent.length - 1];
        const ms = Math.max(b.t - a.t, 8);
        tvx = ((b.x - a.x) / ms) * 16.67;
        tvy = ((b.y - a.y) / ms) * 16.67;
      }
      const speed = Math.hypot(tvx, tvy);
      vx = clamp(tvx, -45, 45);
      vy = clamp(tvy, -45, 45);
      hardThrow = speed > 16;
      if (reduceMotion) { dropped = { x, y }; mode = "float"; return; }
      mode = "thrown";
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wake(); talk(); }
    });

    // anything the visitor does keeps Lys awake
    addEventListener("pointermove", (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now();
      wake();
    }, { passive: true });
    for (const ev of ["scroll", "keydown", "touchstart"]) addEventListener(ev, wake, { passive: true });
    addEventListener("resize", () => {
      x = clamp(x, 40, innerWidth - 40);
      y = clamp(y, 60, innerHeight - 40);
    });

    // a remark the first time each section comes into view
    const heard = new Set();
    const sayObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || heard.has(e.target)) continue;
        heard.add(e.target);
        if (mode !== "drag" && !sleeping && performance.now() - lastSpoke > 4000) say(e.target.dataset.say, 3000);
      }
    }, { threshold: 0.4 });
    $$("[data-say]").forEach((s, i) => (i === 0 ? heard.add(s) : sayObserver.observe(s)));

    // arrive
    const h0 = home();
    x = h0.x; y = h0.y + 120;
    requestAnimationFrame((t) => { lastTick = t; tick(t); });
    setTimeout(() => {
      el.classList.add("ready");
      say(visits > 1 ? `you came back! that's visit #${visits}. I remembered.` : "hi! I'm Lys. welcome to Alystria.", 4200, true);
    }, 900);
    setTimeout(hidePsst, 16000);

    return { hop() { if (mode === "float") vy -= 7; setHappy(); wake(); } };
  })();

  /* ── Game scene: a companion by the fire ── */
  {
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
    let i = 0, visible = false, timer = 0;
    function next() {
      if (!visible) return;
      const [speaker, line] = SCRIPT[i++ % SCRIPT.length];
      who.textContent = speaker;
      if (reduceMotion) { text.textContent = line; timer = setTimeout(next, 3200); return; }
      let n = 0;
      (function type() {
        text.textContent = line.slice(0, ++n);
        timer = n < line.length ? setTimeout(type, 32) : setTimeout(next, 2300);
      })();
    }
    whenVisible(sub.closest(".stage"), (v) => {
      visible = v;
      clearTimeout(timer);
      if (v) next();
    });
  }

  /* ── Chess scene: a coach with opinions ── */
  {
    const boardEl = $("#board");
    const says = $("#coachSays");
    const TEXT = "︎"; // render glyphs as text, never emoji
    const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
    const START = [
      "rnbqkbnr", "pppppppp", "........", "........",
      "........", "........", "PPPPPPPP", "RNBQKBNR",
    ];
    const MOVES = [
      ["e2", "e4", "e4. Bold. The centre is yours."],
      ["e7", "e5", "They match you. Fair enough."],
      ["g1", "f3", "Knight out, already eyeing e5."],
      ["b8", "c6", "Defended. How polite."],
      ["f1", "c4", "Bishop on c4, staring at f7. Remember that square."],
      ["g8", "f6", "Two Knights. Brave of them."],
      ["f3", "g5", "Ooh. Going after f7 already?"],
      ["d7", "d5", "Good reply. They hit back in the centre."],
      ["e4", "d5", "Take it. Free pawn, for now."],
      ["f6", "d5", "Hm. That knight on d5 is a little loose…"],
      ["g5", "f7", "The Fried Liver! I'm proud of you. And slightly scared."],
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

    function paint(i, pop) {
      const c = state[i];
      squares[i].innerHTML = "";
      if (c === ".") return;
      const s = document.createElement("span");
      s.className = (c === c.toUpperCase() ? "w" : "b") + (pop ? " pop" : "");
      s.textContent = GLYPH[c.toLowerCase()] + TEXT;
      squares[i].appendChild(s);
    }

    function reset() {
      state = START.join("").split("");
      squares.forEach((sq, i) => { sq.classList.remove("hl"); paint(i); });
    }

    let m = 0, visible = false, timer = 0;
    function step() {
      if (!visible) return;
      if (m === MOVES.length) {
        timer = setTimeout(() => {
          reset();
          m = 0;
          says.textContent = "Again? I'll pretend I didn't see it coming.";
          timer = setTimeout(step, 2400);
        }, 3600);
        return;
      }
      const [from, to, comment] = MOVES[m++];
      const a = idx(from), b = idx(to);
      squares.forEach((sq) => sq.classList.remove("hl"));
      state[b] = state[a];
      state[a] = ".";
      paint(a);
      paint(b, true);
      squares[a].classList.add("hl");
      squares[b].classList.add("hl");
      says.textContent = comment;
      timer = setTimeout(step, reduceMotion ? 3400 : 2500);
    }

    reset();
    whenVisible(boardEl, (v) => {
      visible = v;
      clearTimeout(timer);
      if (v) timer = setTimeout(step, 900);
    });
  }

  /* ── Chat with Lys (scripted, honest about it) ── */
  {
    const log = $("#log");
    const form = $("#sayForm");
    const input = $("#sayInput");
    const a = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
    const REPLIES = [
      [/\bwho\b|your name|what are you/, "I'm Lys, the little character who lives on this page. Alystria makes characters like me, only much, much smarter."],
      [/\b(free|cost|price|pay|paid|money)\b/, `Almost everything is released for free, and the code is open. If you'd like to help keep it that way, there's a ${a(LINKS.patreon, "Patreon")}.`],
      [/\b(watch|video|videos|youtube|demo|demos)\b/, `The demos and devlogs live on ${a(LINKS.youtube, "YouTube")}. My favourite is the one with the chess coaches.`],
      [/\b(code|github|open ?source|source|repo)\b/, `It's all on ${a(LINKS.github, "GitHub")}. Read it, fork it, build your own characters.`],
      [/\b(patreon|support|donate)\b/, `That's very kind. ${a(LINKS.patreon, "Patreon")} is the place. Watching and sharing helps a lot too.`],
      [/\b(local|offline|privacy|private|internet)\b/, "A lot of it can run entirely on your own PC. No account, no key, no internet."],
      [/\bchess\b/, `${a(LINKS.chess, "Chessbuddy")} is a chess game you can talk through. The coaches explain the why behind every move.`],
      [/\b(pet|pets|desktop)\b/, "The desktop pets walk your taskbar, climb your windows and chase your cursor. I'm their cousin."],
      [/\b(game|games|mod|mods|companion|companions|npc|npcs)\b/, "The game mods let you talk to characters by voice or text. They travel with you, fight beside you and comment on your loot. A bit like me, but braver."],
      [/\b(make|makes|making|do|build|projects?|work)\b/, "Companions for games you already play, chess coaches you can talk to, and tiny creatures that live on your desktop. They listen, answer out loud and remember you."],
      [/\b(throw|dizzy|grab)\b/, "You can, you know. Just grab me and let go. I'll only complain a little."],
      [/\b(cute|love|adorable|sweet)\b/, "stop it. (don't stop.)"],
      [/\b(thanks|thank|ty)\b/, "anytime ✦"],
      [/\b(bye|goodbye|cya|later)\b/, "bye! come back soon. I'll remember."],
      [/\b(hi|hello|hey|hiya|yo|sup)\b/, "hi!! ✦ ask me what Alystria makes, or whether it's free."],
    ];
    const FALLBACK = [
      "I'm only a tiny scripted character, so that one went right over my horn. Try asking what Alystria makes?",
      "hmm, I don't know that one. The real characters would, though.",
      "I'm better at being thrown than at answering that. Ask me about the games, the chess or the pets?",
    ];

    function add(who, html) {
      const li = document.createElement("li");
      li.className = "msg " + who;
      if (who.startsWith("from-you")) li.textContent = html;
      else li.innerHTML = html;
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
      return li;
    }

    function reply(q) {
      const s = q.toLowerCase();
      for (const [re, r] of REPLIES) if (re.test(s)) return r;
      return pick(FALLBACK);
    }

    let busy = false;
    function send(q) {
      q = q.trim();
      if (!q || busy) return;
      busy = true;
      add("from-you", q);
      const typing = add("from-lys typing", "<span></span><span></span><span></span>");
      setTimeout(() => {
        typing.remove();
        add("from-lys", reply(q));
        Lys.hop();
        busy = false;
      }, rand(650, 1150));
    }

    add("from-lys", "hey. ask me anything. (well. a few things.)");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      send(input.value);
      input.value = "";
    });
    $$("#chips button").forEach((b) => b.addEventListener("click", () => send(b.textContent)));
  }
})();
