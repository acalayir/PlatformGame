(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const hudLevel = document.getElementById("hud-level");
  const hudLives = document.getElementById("hud-lives");
  const hudCoins = document.getElementById("hud-coins");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const overlayBtn = document.getElementById("overlay-btn");
  const muteBtn = document.getElementById("btn-mute");

  const TILE = 48;
  const GRAVITY = 2200;
  const MOVE_ACCEL = 3200;
  const MAX_RUN = 280;
  const JUMP_V = -680;
  const FRICTION = 0.82;
  const COYOTE_MS = 90;
  const JUMP_BUFFER_MS = 100;

  const keys = new Set();
  const touch = { left: false, right: false, jump: false, jumpPressed: false };

  let audioCtx = null;
  let muted = false;
  let totalCoins = 0;

  const state = {
    mode: "title", // title | play | clear | dead | win
    levelIndex: 0,
    lives: 3,
    coins: 0,
    camX: 0,
    time: 0,
    deathTimer: 0,
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: 28,
    h: 34,
    onGround: false,
    facing: 1,
    coyote: 0,
    jumpBuf: 0,
    squash: 1,
    stretch: 1,
    invuln: 0,
    alive: true,
  };

  let level = null;
  let particles = [];
  let sparks = [];

  // Level format: platforms {x,y,w,h,move?}, spikes, enemies, coins, flag, spawn, width
  // Coordinates in tiles (TILE px), converted on load.
  const LEVELS = [
    {
      name: "Sahil",
      width: 28,
      spawn: [2, 8],
      platforms: [
        [0, 10, 8, 2],
        [10, 10, 4, 2],
        [16, 9, 3, 1],
        [21, 8, 7, 4],
      ],
      spikes: [[14, 10, 2]],
      enemies: [],
      movers: [],
      coins: [[5, 8], [11, 8], [17, 7], [23, 6]],
      flag: [25, 6],
    },
    {
      name: "Köprüler",
      width: 32,
      spawn: [1, 8],
      platforms: [
        [0, 10, 5, 2],
        [7, 9, 3, 1],
        [12, 8, 3, 1],
        [17, 7, 2, 1],
        [21, 9, 3, 1],
        [26, 8, 6, 4],
      ],
      spikes: [[5, 10, 2], [15, 10, 2], [24, 10, 2]],
      enemies: [[9, 8], [22, 8]],
      movers: [],
      coins: [[3, 8], [8, 7], [13, 6], [18, 5], [27, 6]],
      flag: [29, 6],
    },
    {
      name: "Salıncak",
      width: 34,
      spawn: [1, 7],
      platforms: [
        [0, 9, 4, 3],
        [8, 10, 3, 2],
        [18, 10, 3, 2],
        [28, 8, 6, 4],
      ],
      spikes: [[4, 10, 4], [11, 10, 7], [21, 10, 7]],
      enemies: [[9, 9]],
      movers: [
        { x: 5, y: 7, w: 2, h: 0.5, ax: 5, ay: 7, bx: 14, by: 5, speed: 70 },
        { x: 16, y: 6, w: 2, h: 0.5, ax: 16, ay: 6, bx: 24, by: 7, speed: 80 },
      ],
      coins: [[2, 7], [6, 5], [12, 4], [20, 5], [30, 6]],
      flag: [31, 6],
    },
    {
      name: "Dikenler",
      width: 36,
      spawn: [1, 8],
      platforms: [
        [0, 10, 4, 2],
        [5, 8, 2, 1],
        [8, 6, 2, 1],
        [12, 8, 3, 1],
        [17, 10, 4, 2],
        [23, 8, 2, 1],
        [27, 6, 2, 1],
        [31, 8, 5, 4],
      ],
      spikes: [
        [4, 10, 1],
        [7, 10, 5],
        [15, 10, 2],
        [21, 10, 2],
        [25, 10, 6],
      ],
      enemies: [[13, 7], [18, 9], [32, 7]],
      movers: [
        { x: 20, y: 5, w: 2, h: 0.5, ax: 20, ay: 5, bx: 20, by: 8, speed: 60 },
      ],
      coins: [[6, 6], [9, 4], [13, 6], [19, 8], [24, 6], [28, 4], [33, 6]],
      flag: [34, 6],
    },
    {
      name: "Zirve",
      width: 40,
      spawn: [1, 9],
      platforms: [
        [0, 11, 3, 2],
        [5, 10, 2, 1],
        [9, 8, 2, 1],
        [14, 10, 3, 1],
        [20, 8, 2, 1],
        [25, 6, 2, 1],
        [30, 8, 2, 1],
        [34, 7, 6, 5],
      ],
      spikes: [
        [3, 11, 2],
        [7, 11, 2],
        [11, 11, 3],
        [17, 11, 3],
        [22, 11, 3],
        [27, 11, 3],
        [32, 11, 2],
      ],
      enemies: [[15, 9], [21, 7], [31, 7], [36, 6]],
      movers: [
        { x: 11, y: 6, w: 2, h: 0.5, ax: 11, ay: 6, bx: 17, by: 4, speed: 90 },
        { x: 23, y: 4, w: 2, h: 0.5, ax: 23, ay: 4, bx: 28, by: 7, speed: 85 },
      ],
      coins: [
        [2, 9],
        [6, 8],
        [10, 6],
        [15, 8],
        [21, 6],
        [26, 4],
        [31, 6],
        [36, 5],
      ],
      flag: [38, 5],
    },
  ];

  function t(n) {
    return n * TILE;
  }

  function loadLevel(index) {
    const raw = LEVELS[index];
    const platforms = raw.platforms.map(([x, y, w, h]) => ({
      x: t(x),
      y: t(y),
      w: t(w),
      h: t(h),
      kind: "solid",
    }));
    const movers = (raw.movers || []).map((m) => ({
      x: t(m.x),
      y: t(m.y),
      w: t(m.w),
      h: t(m.h),
      ax: t(m.ax),
      ay: t(m.ay),
      bx: t(m.bx),
      by: t(m.by),
      speed: m.speed,
      t: 0,
      dir: 1,
      vx: 0,
      vy: 0,
      kind: "mover",
    }));
    const spikes = (raw.spikes || []).map(([x, y, w]) => ({
      x: t(x),
      y: t(y) + TILE * 0.55,
      w: t(w),
      h: TILE * 0.45,
    }));
    const enemies = (raw.enemies || []).map(([x, y]) => {
      const h = 28;
      return {
        x: t(x),
        y: t(y) - h,
        w: 30,
        h,
        vx: 70 * (Math.random() > 0.5 ? 1 : -1),
        alive: true,
      };
    });
    const coins = (raw.coins || []).map(([x, y]) => ({
      x: t(x) + TILE * 0.25,
      y: t(y) + TILE * 0.2,
      w: 20,
      h: 20,
      taken: false,
      bob: Math.random() * Math.PI * 2,
    }));
    const flag = {
      x: t(raw.flag[0]),
      y: t(raw.flag[1]),
      w: 20,
      h: TILE * 1.6,
    };
    level = {
      name: raw.name,
      width: t(raw.width),
      height: H,
      platforms,
      movers,
      spikes,
      enemies,
      coins,
      flag,
      spawn: { x: t(raw.spawn[0]), y: t(raw.spawn[1]) },
    };
    resetPlayer();
    particles = [];
    sparks = [];
    state.camX = 0;
    updateHud();
  }

  function resetPlayer() {
    player.x = level.spawn.x;
    // Place feet on the nearest platform under the spawn X.
    let best = null;
    for (const p of [...level.platforms, ...level.movers]) {
      if (player.x + player.w > p.x + 4 && player.x < p.x + p.w - 4) {
        if (best === null || p.y < best.y) best = p;
      }
    }
    player.y = best ? best.y - player.h : level.spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = !!best;
    player.facing = 1;
    player.coyote = COYOTE_MS / 1000;
    player.jumpBuf = 0;
    player.squash = 1;
    player.stretch = 1;
    player.invuln = 0.6;
    player.alive = true;
  }

  function updateHud() {
    hudLevel.textContent = `Seviye ${state.levelIndex + 1}/${LEVELS.length}`;
    hudLives.textContent = `Can ${"★".repeat(Math.max(0, state.lives))}${"☆".repeat(Math.max(0, 3 - state.lives))}`;
    hudCoins.textContent = `◆ ${state.coins}`;
  }

  function showOverlay(title, msg, btn) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlayBtn.textContent = btn;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function beep(freq, dur, type, gain) {
    if (muted || !audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.value = gain ?? 0.04;
      o.connect(g);
      g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now);
      o.stop(now + dur + 0.02);
    } catch (_) {}
  }

  function sfx(kind) {
    ensureAudio();
    if (kind === "jump") beep(420, 0.08, "triangle", 0.05);
    if (kind === "land") beep(180, 0.05, "sine", 0.03);
    if (kind === "coin") {
      beep(880, 0.06, "square", 0.04);
      setTimeout(() => beep(1175, 0.08, "square", 0.035), 40);
    }
    if (kind === "hurt") beep(140, 0.2, "sawtooth", 0.05);
    if (kind === "flag") {
      beep(523, 0.1, "triangle", 0.05);
      setTimeout(() => beep(659, 0.1, "triangle", 0.05), 80);
      setTimeout(() => beep(784, 0.16, "triangle", 0.05), 160);
    }
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rects() {
    return [...level.platforms, ...level.movers];
  }

  function resolveSolid(px, py, pw, ph, vx, vy) {
    let x = px;
    let y = py;
    let nx = vx;
    let ny = vy;
    let grounded = false;
    let ride = null;

    // Horizontal
    x += vx;
    for (const p of rects()) {
      if (x < p.x + p.w && x + pw > p.x && y < p.y + p.h && y + ph > p.y) {
        if (vx > 0) x = p.x - pw;
        else if (vx < 0) x = p.x + p.w;
        nx = 0;
      }
    }

    // Vertical
    y += vy;
    for (const p of rects()) {
      if (x < p.x + p.w && x + pw > p.x && y < p.y + p.h && y + ph > p.y) {
        if (vy > 0) {
          y = p.y - ph;
          grounded = true;
          if (p.kind === "mover") ride = p;
        } else if (vy < 0) {
          y = p.y + p.h;
        }
        ny = 0;
      }
    }
    return { x, y, vx: nx, vy: ny, grounded, ride };
  }

  function spawnDust(x, y) {
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 40,
        life: 0.35 + Math.random() * 0.2,
        max: 0.55,
        r: 2 + Math.random() * 3,
        color: "rgba(243,247,242,0.7)",
      });
    }
  }

  function spawnSparkles(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 120;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        color: Math.random() > 0.5 ? "#f0a45d" : "#7ec8a3",
      });
    }
  }

  function wantLeft() {
    return keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || touch.left;
  }
  function wantRight() {
    return keys.has("ArrowRight") || keys.has("d") || keys.has("D") || touch.right;
  }
  function wantJumpDown() {
    return (
      keys.has(" ") ||
      keys.has("ArrowUp") ||
      keys.has("w") ||
      keys.has("W") ||
      touch.jumpPressed ||
      touch.jump
    );
  }

  function killPlayer() {
    if (!player.alive || player.invuln > 0) return;
    player.alive = false;
    state.lives -= 1;
    state.mode = "dead";
    state.deathTimer = 0.85;
    sfx("hurt");
    spawnDust(player.x + player.w / 2, player.y + player.h);
    updateHud();
  }

  function updateMovers(dt) {
    for (const m of level.movers) {
      const dx = m.bx - m.ax;
      const dy = m.by - m.ay;
      const len = Math.hypot(dx, dy) || 1;
      m.t += (m.speed * m.dir * dt) / len;
      if (m.t > 1) {
        m.t = 1;
        m.dir = -1;
      }
      if (m.t < 0) {
        m.t = 0;
        m.dir = 1;
      }
      const nx = m.ax + dx * m.t;
      const ny = m.ay + dy * m.t;
      m.vx = (nx - m.x) / dt;
      m.vy = (ny - m.y) / dt;
      m.x = nx;
      m.y = ny;
    }
  }

  function updateEnemies(dt) {
    for (const e of level.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt;
      // Turn at edges / walls
      const feet = { x: e.x + (e.vx > 0 ? e.w + 2 : -2), y: e.y + e.h + 2, w: 4, h: 4 };
      let support = false;
      let wall = false;
      for (const p of rects()) {
        if (aabb(feet, p)) support = true;
        const ahead = {
          x: e.vx > 0 ? e.x + e.w : e.x - 2,
          y: e.y + 4,
          w: 4,
          h: e.h - 8,
        };
        if (aabb(ahead, p)) wall = true;
      }
      if (!support || wall || e.x < 0 || e.x + e.w > level.width) e.vx *= -1;

      // Stomp
      if (
        player.alive &&
        aabb(player, e) &&
        player.vy > 0 &&
        player.y + player.h - e.y < 18
      ) {
        e.alive = false;
        player.vy = JUMP_V * 0.55;
        player.squash = 0.7;
        player.stretch = 1.25;
        sfx("jump");
        spawnDust(e.x + e.w / 2, e.y + e.h);
        continue;
      }
      if (player.alive && aabb(player, e)) killPlayer();
    }
  }

  function updatePlayer(dt) {
    if (!player.alive) return;

    if (player.invuln > 0) player.invuln -= dt;

    const left = wantLeft();
    const right = wantRight();
    if (left && !right) {
      player.vx -= MOVE_ACCEL * dt;
      player.facing = -1;
    } else if (right && !left) {
      player.vx += MOVE_ACCEL * dt;
      player.facing = 1;
    } else {
      player.vx *= Math.pow(FRICTION, dt * 60);
    }
    player.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, player.vx));

    // Jump buffer / coyote
    if (touch.jumpPressed || keys.has("JumpPulse")) {
      player.jumpBuf = JUMP_BUFFER_MS / 1000;
    }
    // Detect fresh jump presses from keyboard edges via jumpBuf set in keydown
    if (player.onGround) player.coyote = COYOTE_MS / 1000;
    else player.coyote = Math.max(0, player.coyote - dt);
    player.jumpBuf = Math.max(0, player.jumpBuf - dt);

    if (player.jumpBuf > 0 && player.coyote > 0) {
      player.vy = JUMP_V;
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuf = 0;
      player.squash = 0.65;
      player.stretch = 1.35;
      sfx("jump");
    }

    // Variable jump height
    const holdingJump =
      keys.has(" ") ||
      keys.has("ArrowUp") ||
      keys.has("w") ||
      keys.has("W") ||
      touch.jump;
    if (!holdingJump && player.vy < -180) player.vy *= 0.55;

    player.vy += GRAVITY * dt;
    const wasGrounded = player.onGround;
    const res = resolveSolid(
      player.x,
      player.y,
      player.w,
      player.h,
      player.vx * dt,
      player.vy * dt
    );
    player.x = res.x;
    player.y = res.y;
    if (res.vx === 0) player.vx = 0;
    if (res.vy === 0) player.vy = 0;

    player.onGround = res.grounded;
    if (res.ride) {
      player.x += res.ride.vx * dt;
      player.y += res.ride.vy * dt;
    }

    if (player.onGround && !wasGrounded) {
      player.squash = 1.25;
      player.stretch = 0.75;
      sfx("land");
      spawnDust(player.x + player.w / 2, player.y + player.h);
    }

    // Squash recover
    player.squash += (1 - player.squash) * Math.min(1, dt * 12);
    player.stretch += (1 - player.stretch) * Math.min(1, dt * 12);

    // Bounds / fall death
    if (player.y > H + 80) killPlayer();

    // Spikes
    for (const s of level.spikes) {
      if (aabb(player, s)) killPlayer();
    }

    // Coins
    for (const c of level.coins) {
      if (c.taken) continue;
      c.bob += dt * 4;
      if (aabb(player, c)) {
        c.taken = true;
        state.coins += 1;
        totalCoins += 1;
        sfx("coin");
        spawnSparkles(c.x + 10, c.y + 10);
        updateHud();
      }
    }

    // Flag
    const flagHit = {
      x: level.flag.x,
      y: level.flag.y,
      w: 28,
      h: level.flag.h,
    };
    if (aabb(player, flagHit)) {
      sfx("flag");
      spawnSparkles(level.flag.x + 10, level.flag.y + 20);
      if (state.levelIndex >= LEVELS.length - 1) {
        state.mode = "win";
        showOverlay(
          "Tebrikler!",
          `Tüm ${LEVELS.length} seviyeyi bitirdin. Toplam ◆ ${state.coins}`,
          "Tekrar"
        );
      } else {
        state.mode = "clear";
        showOverlay(
          `Seviye ${state.levelIndex + 1} tamam!`,
          `${LEVELS[state.levelIndex].name} geçildi. Hazır mısın?`,
          "Sonraki seviye"
        );
      }
    }

    touch.jumpPressed = false;
    keys.delete("JumpPulse");
  }

  function updateParticles(dt) {
    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      return p.life > 0;
    });
    sparks = sparks.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 180 * dt;
      return s.life > 0;
    });
  }

  function update(dt) {
    state.time += dt;
    if (state.mode === "play") {
      updateMovers(dt);
      updatePlayer(dt);
      updateEnemies(dt);
      updateParticles(dt);
      const target = player.x + player.w / 2 - W * 0.4;
      state.camX += (target - state.camX) * Math.min(1, dt * 6);
      state.camX = Math.max(0, Math.min(level.width - W, state.camX));
    } else if (state.mode === "dead") {
      updateParticles(dt);
      state.deathTimer -= dt;
      if (state.deathTimer <= 0) {
        if (state.lives <= 0) {
          state.mode = "title";
          showOverlay("Oyun bitti", "Canların bitti. Bir daha dene!", "Tekrar");
        } else {
          resetPlayer();
          state.mode = "play";
          updateHud();
        }
      }
    }
  }

  // --- Drawing ---
  function paintSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1e5c62");
    g.addColorStop(0.4, "#2f7d74");
    g.addColorStop(0.72, "#d98a55");
    g.addColorStop(1, "#e9a46c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soft sun
    const sx = W * 0.78 - state.camX * 0.05;
    const sy = H * 0.22;
    const rg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 120);
    rg.addColorStop(0, "rgba(255,220,140,0.85)");
    rg.addColorStop(1, "rgba(255,220,140,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(sx, sy, 120, 0, Math.PI * 2);
    ctx.fill();

    // Distant hills (parallax)
    ctx.fillStyle = "rgba(20, 55, 58, 0.45)";
    drawHills(state.camX * 0.15, H * 0.62, 180, 40);
    ctx.fillStyle = "rgba(18, 48, 52, 0.55)";
    drawHills(state.camX * 0.28, H * 0.7, 140, 28);
  }

  function drawHills(offset, baseY, amp, step) {
    ctx.beginPath();
    ctx.moveTo(-40, H);
    for (let x = -40; x <= W + 40; x += step) {
      const y = baseY + Math.sin((x + offset) * 0.01) * amp * 0.35 + Math.sin((x + offset) * 0.021) * amp * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlatform(p, moving) {
    const x = p.x - state.camX;
    const y = p.y;
    if (x + p.w < -20 || x > W + 20) return;

    ctx.fillStyle = moving ? "#c97b3a" : "#3d8f6e";
    roundRect(x, y, p.w, p.h, 8);
    ctx.fill();

    // Top lip
    ctx.fillStyle = moving ? "#e9a35a" : "#7ec8a3";
    roundRect(x + 2, y + 2, p.w - 4, 10, 5);
    ctx.fill();

    // Speckles
    ctx.fillStyle = moving ? "rgba(80,40,10,0.15)" : "rgba(20,60,40,0.18)";
    for (let i = 0; i < p.w / 28; i++) {
      const sx = x + 12 + i * 28 + ((i * 17) % 7);
      const sy = y + 18 + ((i * 13) % 10);
      if (sy < y + p.h - 8) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawSpikes(s) {
    const x = s.x - state.camX;
    if (x + s.w < -10 || x > W + 10) return;
    const count = Math.max(1, Math.round(s.w / 16));
    const tw = s.w / count;
    ctx.fillStyle = "#264653";
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * tw, s.y + s.h);
      ctx.lineTo(x + i * tw + tw / 2, s.y);
      ctx.lineTo(x + (i + 1) * tw, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#3a6a78";
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * tw + tw * 0.25, s.y + s.h);
      ctx.lineTo(x + i * tw + tw / 2, s.y + 4);
      ctx.lineTo(x + i * tw + tw * 0.55, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCoin(c) {
    if (c.taken) return;
    const x = c.x - state.camX;
    const y = c.y + Math.sin(c.bob) * 4;
    if (x < -20 || x > W + 20) return;
    ctx.save();
    ctx.translate(x + 10, y + 10);
    ctx.rotate(Math.sin(c.bob * 0.5) * 0.2);
    ctx.fillStyle = "#f0a45d";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe0a8";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlag() {
    const x = level.flag.x - state.camX;
    const y = level.flag.y;
    if (x < -40 || x > W + 40) return;
    ctx.strokeStyle = "#f3f7f2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + level.flag.h);
    ctx.lineTo(x + 4, y);
    ctx.stroke();
    const wave = Math.sin(state.time * 5) * 3;
    ctx.fillStyle = "#e85d4c";
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 34 + wave, y + 12);
    ctx.lineTo(x + 6, y + 24);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemy(e) {
    if (!e.alive) return;
    const x = e.x - state.camX;
    if (x < -40 || x > W + 40) return;
    const bob = Math.sin(state.time * 8 + e.x) * 2;
    ctx.fillStyle = "#5c2a3a";
    roundRect(x, e.y + bob, e.w, e.h, 8);
    ctx.fill();
    ctx.fillStyle = "#e85d4c";
    ctx.beginPath();
    ctx.arc(x + 10, e.y + 12 + bob, 3.5, 0, Math.PI * 2);
    ctx.arc(x + 20, e.y + 12 + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b2e28";
    ctx.beginPath();
    ctx.arc(x + 10 + (e.vx > 0 ? 1 : -1), e.y + 12 + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 20 + (e.vx > 0 ? 1 : -1), e.y + 12 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    if (!player.alive && state.mode === "dead") {
      // fade puff
      ctx.globalAlpha = Math.max(0, state.deathTimer / 0.85);
    }
    const blink = player.invuln > 0 && Math.floor(state.time * 16) % 2 === 0;
    if (blink) {
      ctx.globalAlpha = 0.45;
    }

    const cx = player.x - state.camX + player.w / 2;
    const cy = player.y + player.h / 2;
    const pw = player.w * player.stretch;
    const ph = player.h * player.squash;

    ctx.save();
    ctx.translate(cx, cy + (player.h - ph) / 2);
    ctx.scale(player.facing, 1);

    // Body
    ctx.fillStyle = "#e85d4c";
    roundRect(-pw / 2, -ph / 2, pw, ph, 10);
    ctx.fill();

    // Belly
    ctx.fillStyle = "#f3b29f";
    roundRect(-pw * 0.28, -ph * 0.05, pw * 0.55, ph * 0.42, 8);
    ctx.fill();

    // Eye
    ctx.fillStyle = "#f3f7f2";
    ctx.beginPath();
    ctx.ellipse(pw * 0.12, -ph * 0.22, 5.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b2e28";
    ctx.beginPath();
    ctx.arc(pw * 0.18, -ph * 0.22, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Feet
    ctx.fillStyle = "#c44536";
    roundRect(-pw * 0.42, ph * 0.32, pw * 0.32, ph * 0.2, 4);
    roundRect(pw * 0.05, ph * 0.32, pw * 0.32, ph * 0.2, 4);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - state.camX, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - state.camX - 2, s.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    paintSky();
    if (!level) return;

    for (const p of level.platforms) drawPlatform(p, false);
    for (const m of level.movers) drawPlatform(m, true);
    for (const s of level.spikes) drawSpikes(s);
    for (const c of level.coins) drawCoin(c);
    drawFlag();
    for (const e of level.enemies) drawEnemy(e);
    if (player.alive || state.mode === "dead") drawPlayer();
    drawParticles();
  }

  // --- Input ---
  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "A", "d", "D", "w", "W"].includes(e.key)) {
      e.preventDefault();
    }
    const was = keys.has(e.key);
    keys.add(e.key);
    if (!was && (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W")) {
      keys.add("JumpPulse");
      player.jumpBuf = JUMP_BUFFER_MS / 1000;
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key);
  });

  function bindTouchButton(btn, dir) {
    const set = (v) => {
      if (dir === "left") touch.left = v;
      if (dir === "right") touch.right = v;
      if (dir === "jump") {
        if (v && !touch.jump) {
          touch.jumpPressed = true;
          player.jumpBuf = JUMP_BUFFER_MS / 1000;
        }
        touch.jump = v;
      }
      btn.classList.toggle("active", v);
    };
    const on = (e) => {
      e.preventDefault();
      if (e.pointerId != null && btn.setPointerCapture) {
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      ensureAudio();
      set(true);
    };
    const off = (e) => {
      e.preventDefault();
      set(false);
    };
    // Capture keeps hold working if the finger/cursor drifts; skip pointerleave.
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("lostpointercapture", off);
    btn.addEventListener("touchstart", on, { passive: false });
    btn.addEventListener("touchend", off, { passive: false });
    btn.addEventListener("touchcancel", off, { passive: false });
    btn.addEventListener("mousedown", on);
    btn.addEventListener("mouseup", off);
  }

  document.querySelectorAll("#touch button").forEach((btn) => {
    bindTouchButton(btn, btn.dataset.dir);
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.classList.toggle("muted", muted);
    muteBtn.textContent = muted ? "Sessiz" : "Ses";
    if (!muted) ensureAudio();
  });

  overlayBtn.addEventListener("click", () => {
    ensureAudio();
    if (state.mode === "title" || (state.mode === "win" && overlayBtn.textContent === "Tekrar")) {
      state.levelIndex = 0;
      state.lives = 3;
      state.coins = 0;
      loadLevel(0);
      state.mode = "play";
      hideOverlay();
      updateHud();
      return;
    }
    if (state.mode === "clear") {
      state.levelIndex += 1;
      loadLevel(state.levelIndex);
      state.mode = "play";
      hideOverlay();
      return;
    }
    if (state.mode === "dead" || overlayBtn.textContent === "Tekrar") {
      state.levelIndex = 0;
      state.lives = 3;
      state.coins = 0;
      loadLevel(0);
      state.mode = "play";
      hideOverlay();
      updateHud();
    }
  });

  // Loop
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(0.033, dt);
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // Boot
  loadLevel(0);
  state.mode = "title";
  showOverlay("Macera başlıyor", "Kısa seviyeler, büyük zıplamalar. Bayrağa ulaş!", "Başla");
  requestAnimationFrame(frame);
})();
