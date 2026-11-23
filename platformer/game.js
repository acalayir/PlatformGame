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
  const langBtn = document.getElementById("btn-lang");
  const overlayLangBtn = document.getElementById("overlay-lang");
  const langPanel = document.getElementById("lang-panel");
  const langList = document.getElementById("lang-list");
  const langTitle = document.getElementById("lang-title");
  const langClose = document.getElementById("lang-close");
  const I18N = window.ZIPLA_I18N;

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
    mode: "title", // title | play | clear | dead | win | gameover
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
  let leaves = [];
  let clouds = [];
  let echoTrail = [];
  let sandBits = [];

  const ECHO_WINDOW = 0.42;
  const STORAGE_SHIMMER = "zipla-ada-shimmers-v1";
  const STORAGE_SKIN = "zipla-ada-skin-v1";
  const SKIN_PALETTE = [
    { body: "#e85d4c", belly: "#f3b29f", feet: "#c44536", trail: "rgba(232,93,76,0.35)" },
    { body: "#2a9d8f", belly: "#a8e6cf", feet: "#1b6b63", trail: "rgba(42,157,143,0.4)" },
    { body: "#e9c46a", belly: "#fff3c4", feet: "#c9a227", trail: "rgba(233,196,106,0.4)" },
    { body: "#457b9d", belly: "#a8dadc", feet: "#1d3557", trail: "rgba(69,123,157,0.4)" },
    { body: "#f4a261", belly: "#ffe8d1", feet: "#e76f51", trail: "rgba(244,162,97,0.4)" },
    { body: "#2d6a4f", belly: "#95d5b2", feet: "#1b4332", trail: "rgba(45,106,79,0.35)" },
    { body: "#00bbf9", belly: "#caf0f8", feet: "#0077b6", trail: "rgba(0,187,249,0.35)" },
    { body: "#ef476f", belly: "#ffd6e0", feet: "#b5173a", trail: "rgba(239,71,111,0.35)" },
  ];

  const meta = {
    shake: 0,
    shakeMag: 0,
    echo: null, // {x,y,timer,boostX,boostY}
    echoFlash: 0,
    windForce: 0,
    windCue: 0,
    windWasIn: false,
    polaroid: null, // {t, max, name, lang, skip}
    coinMagnet: false,
    boss: null,
    shimmersFound: loadShimmers(),
    skinIndex: loadSkin(),
    toast: null, // {text, t}
    fallSpeedPeak: 0,
  };

  function loadShimmers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SHIMMER) || "{}") || {};
    } catch (_) {
      return {};
    }
  }
  function saveShimmers() {
    try {
      localStorage.setItem(STORAGE_SHIMMER, JSON.stringify(meta.shimmersFound));
    } catch (_) {}
  }
  function loadSkin() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_SKIN) || "0", 10);
      return Number.isFinite(n) ? Math.max(0, Math.min(SKIN_PALETTE.length - 1, n)) : 0;
    } catch (_) {
      return 0;
    }
  }
  function saveSkin(i) {
    meta.skinIndex = i;
    try {
      localStorage.setItem(STORAGE_SKIN, String(i));
    } catch (_) {}
  }
  function skin() {
    return SKIN_PALETTE[meta.skinIndex] || SKIN_PALETTE[0];
  }
  function showToast(text) {
    meta.toast = { text, t: 2.2 };
  }
  function initClouds() {
    clouds = [];
    for (let i = 0; i < 7; i++) {
      clouds.push({
        x: Math.random() * 1400,
        y: 40 + Math.random() * 160,
        w: 70 + Math.random() * 90,
        speed: 8 + Math.random() * 18,
        a: 0.12 + Math.random() * 0.14,
      });
    }
  }
  initClouds();

  // Level format: platforms [x,y,w,h], spikes [x,y,w], enemies [x,y],
  // movers {x,y,w,h,ax,ay,bx,by,speed}, coins, flag, spawn, width (tiles).
  const LEVELS = [
    {
      name: "Sahil",
      width: 26,
      spawn: [2, 8],
      platforms: [
        [0, 10, 8, 2],
        [10, 10, 4, 2],
        [16, 9, 3, 1],
        [21, 8, 5, 4],
      ],
      spikes: [[14, 10, 2]],
      enemies: [],
      movers: [],
      coins: [[5, 8], [11, 8], [17, 7], [23, 6]],
      shimmers: [[7, 6], [19, 5]],
      flag: [24, 6],
    },
    {
      name: "Adımlar",
      width: 28,
      spawn: [1, 9],
      platforms: [
        [0, 10, 4, 2],
        [5, 9, 3, 1],
        [9, 8, 3, 1],
        [13, 7, 3, 1],
        [17, 8, 3, 1],
        [22, 7, 6, 5],
      ],
      spikes: [[4, 10, 1], [12, 10, 1]],
      enemies: [],
      movers: [],
      coins: [[2, 8], [6, 7], [10, 6], [14, 5], [18, 6], [24, 5]],
      shimmers: [[8, 5], [20, 4]],
      flag: [25, 5],
    },
    {
      name: "Köprüler",
      width: 30,
      spawn: [1, 8],
      platforms: [
        [0, 10, 5, 2],
        [7, 9, 3, 1],
        [12, 8, 3, 1],
        [17, 7, 2, 1],
        [21, 9, 3, 1],
        [25, 8, 5, 4],
      ],
      spikes: [[5, 10, 2], [15, 10, 2], [24, 10, 1]],
      enemies: [[9, 8], [22, 8]],
      movers: [],
      coins: [[3, 8], [8, 7], [13, 6], [18, 5], [26, 6]],
      shimmers: [[4, 5], [19, 3], [26, 4]],
      flag: [28, 6],
    },
    {
      name: "Dikenlik",
      width: 30,
      spawn: [1, 8],
      platforms: [
        [0, 10, 4, 2],
        [6, 9, 2, 1],
        [10, 8, 2, 1],
        [14, 9, 3, 1],
        [19, 8, 2, 1],
        [23, 7, 7, 5],
      ],
      spikes: [[4, 10, 2], [8, 10, 2], [12, 10, 2], [17, 10, 2], [21, 10, 2]],
      enemies: [[15, 8]],
      movers: [],
      coins: [[2, 8], [7, 7], [11, 6], [15, 7], [20, 6], [25, 5]],
      flag: [27, 5],
    },
    {
      name: "Salıncak",
      width: 32,
      spawn: [1, 7],
      platforms: [
        [0, 9, 4, 3],
        [8, 10, 3, 2],
        [18, 10, 3, 2],
        [26, 8, 6, 4],
      ],
      spikes: [[4, 10, 4], [11, 10, 7], [21, 10, 5]],
      enemies: [[9, 9]],
      movers: [
        { x: 5, y: 7, w: 2, h: 0.5, ax: 5, ay: 7, bx: 14, by: 5, speed: 70 },
        { x: 16, y: 6, w: 2, h: 0.5, ax: 16, ay: 6, bx: 22, by: 7, speed: 80 },
      ],
      coins: [[2, 7], [6, 5], [12, 4], [20, 5], [28, 6]],
      wind: [{ x: 10, y: 2, w: 10, h: 8, force: 140 }],
      shimmers: [[3, 5], [15, 3], [27, 4]],
      flag: [29, 6],
    },
    {
      name: "Devriye",
      width: 32,
      spawn: [1, 8],
      platforms: [
        [0, 10, 5, 2],
        [7, 9, 4, 1],
        [13, 8, 4, 1],
        [19, 9, 3, 1],
        [24, 8, 8, 4],
      ],
      spikes: [[5, 10, 2], [11, 10, 2], [17, 10, 2], [22, 10, 2]],
      enemies: [[8, 8], [14, 7], [20, 8], [26, 7]],
      movers: [],
      coins: [[3, 8], [9, 7], [15, 6], [21, 7], [27, 6]],
      flag: [29, 6],
    },
    {
      name: "Asansör",
      width: 30,
      spawn: [1, 9],
      platforms: [
        [0, 10, 4, 2],
        [12, 10, 3, 2],
        [24, 7, 6, 5],
      ],
      spikes: [[4, 10, 8], [15, 10, 9]],
      enemies: [[13, 9]],
      movers: [
        { x: 5, y: 8, w: 2, h: 0.5, ax: 5, ay: 8, bx: 5, by: 4, speed: 65 },
        { x: 17, y: 5, w: 2, h: 0.5, ax: 17, ay: 5, bx: 17, by: 9, speed: 70 },
      ],
      coins: [[2, 8], [5, 3], [13, 8], [17, 4], [26, 5]],
      wind: [{ x: 6, y: 2, w: 8, h: 8, force: -120 }],
      shimmers: [[6, 2], [18, 2], [25, 3]],
      flag: [27, 5],
    },
    {
      name: "Uçurum",
      width: 34,
      spawn: [1, 8],
      platforms: [
        [0, 10, 3, 2],
        [5, 9, 2, 1],
        [9, 8, 2, 1],
        [14, 9, 2, 1],
        [18, 7, 2, 1],
        [23, 8, 2, 1],
        [28, 7, 6, 5],
      ],
      spikes: [[3, 10, 2], [7, 10, 2], [11, 10, 3], [16, 10, 2], [20, 10, 3], [25, 10, 3]],
      enemies: [[15, 8], [24, 7]],
      movers: [],
      coins: [[2, 8], [6, 7], [10, 6], [15, 7], [19, 5], [24, 6], [30, 5]],
      shimmers: [[7, 5], [19, 3], [29, 3]],
      flag: [31, 5],
    },
    {
      name: "Çift Yol",
      width: 34,
      spawn: [1, 8],
      platforms: [
        [0, 10, 4, 2],
        [6, 8, 3, 1],
        [6, 5, 3, 1],
        [12, 9, 3, 1],
        [12, 6, 3, 1],
        [18, 8, 3, 1],
        [18, 5, 3, 1],
        [24, 7, 3, 1],
        [28, 8, 6, 4],
      ],
      spikes: [[4, 10, 2], [9, 10, 3], [15, 10, 3], [21, 10, 3], [27, 10, 1]],
      enemies: [[7, 7], [13, 5], [19, 7], [25, 6]],
      movers: [],
      coins: [[2, 8], [7, 3], [13, 4], [19, 3], [25, 5], [30, 6]],
      flag: [31, 6],
    },
    {
      name: "Tempo",
      width: 34,
      spawn: [1, 8],
      platforms: [
        [0, 10, 4, 2],
        [14, 10, 3, 2],
        [28, 8, 6, 4],
      ],
      spikes: [[4, 10, 10], [17, 10, 11]],
      enemies: [[15, 9]],
      movers: [
        { x: 5, y: 7, w: 2, h: 0.5, ax: 5, ay: 7, bx: 12, by: 5, speed: 110 },
        { x: 18, y: 6, w: 2, h: 0.5, ax: 18, ay: 6, bx: 25, by: 4, speed: 120 },
      ],
      coins: [[2, 8], [8, 4], [15, 8], [21, 3], [30, 6]],
      wind: [{ x: 6, y: 2, w: 12, h: 8, force: 160 }],
      shimmers: [[3, 5], [16, 5], [29, 4]],
      flag: [31, 6],
    },
    {
      name: "Labirent",
      width: 36,
      spawn: [1, 9],
      platforms: [
        [0, 10, 3, 2],
        [4, 8, 2, 1],
        [7, 6, 2, 1],
        [10, 8, 2, 1],
        [13, 6, 2, 1],
        [16, 8, 2, 1],
        [19, 6, 2, 1],
        [22, 8, 2, 1],
        [25, 6, 2, 1],
        [29, 7, 7, 5],
      ],
      spikes: [
        [3, 10, 1],
        [6, 10, 1],
        [9, 10, 1],
        [12, 10, 1],
        [15, 10, 1],
        [18, 10, 1],
        [21, 10, 1],
        [24, 10, 1],
        [27, 10, 2],
      ],
      enemies: [[11, 7], [17, 7], [23, 7]],
      movers: [],
      coins: [[2, 8], [5, 6], [8, 4], [14, 4], [20, 4], [26, 4], [31, 5]],
      flag: [33, 5],
    },
    {
      name: "Fırtına",
      width: 36,
      spawn: [1, 8],
      platforms: [
        [0, 10, 3, 2],
        [8, 10, 3, 2],
        [18, 9, 3, 1],
        [30, 7, 6, 5],
      ],
      spikes: [[3, 10, 5], [11, 10, 7], [21, 10, 9]],
      enemies: [[9, 9], [19, 8], [32, 6]],
      movers: [
        { x: 4, y: 7, w: 2, h: 0.5, ax: 4, ay: 7, bx: 4, by: 4, speed: 95 },
        { x: 12, y: 6, w: 2, h: 0.5, ax: 12, ay: 6, bx: 16, by: 4, speed: 100 },
        { x: 22, y: 5, w: 2, h: 0.5, ax: 22, ay: 5, bx: 27, by: 7, speed: 105 },
      ],
      coins: [[2, 8], [4, 3], [9, 8], [14, 3], [19, 7], [24, 4], [32, 5]],
      wind: [{ x: 3, y: 1, w: 14, h: 9, force: 180 }, { x: 18, y: 1, w: 12, h: 9, force: -150 }],
      shimmers: [[5, 2], [15, 2], [25, 3], [31, 3]],
      flag: [33, 5],
    },
    {
      name: "Dar Geçit",
      width: 36,
      spawn: [1, 9],
      platforms: [
        [0, 10, 3, 2],
        [5, 9, 1.5, 1],
        [8, 7, 1.5, 1],
        [11, 9, 1.5, 1],
        [14, 7, 1.5, 1],
        [17, 5, 1.5, 1],
        [20, 7, 1.5, 1],
        [23, 9, 1.5, 1],
        [26, 7, 1.5, 1],
        [30, 8, 6, 4],
      ],
      spikes: [
        [3, 10, 2],
        [6.5, 10, 1.5],
        [9.5, 10, 1.5],
        [12.5, 10, 1.5],
        [15.5, 10, 1.5],
        [18.5, 10, 1.5],
        [21.5, 10, 1.5],
        [24.5, 10, 1.5],
        [27.5, 10, 2.5],
      ],
      enemies: [[12, 8], [21, 6], [31, 7]],
      movers: [
        { x: 16, y: 3, w: 1.5, h: 0.5, ax: 16, ay: 3, bx: 19, by: 3, speed: 80 },
      ],
      coins: [[2, 8], [6, 7], [9, 5], [15, 3], [18, 3], [24, 7], [32, 6]],
      wind: [{ x: 14, y: 1, w: 10, h: 8, force: 110 }],
      shimmers: [[7, 4], [17, 2], [28, 4]],
      flag: [33, 6],
    },
    {
      name: "Gece Devriyesi",
      width: 38,
      spawn: [1, 8],
      platforms: [
        [0, 10, 4, 2],
        [6, 9, 3, 1],
        [11, 8, 3, 1],
        [16, 9, 3, 1],
        [21, 8, 3, 1],
        [26, 7, 3, 1],
        [31, 8, 7, 4],
      ],
      spikes: [[4, 10, 2], [9, 10, 2], [14, 10, 2], [19, 10, 2], [24, 10, 2], [29, 10, 2]],
      enemies: [[7, 8], [12, 7], [17, 8], [22, 7], [27, 6], [33, 7]],
      movers: [],
      coins: [[2, 8], [7, 7], [12, 6], [17, 7], [22, 6], [27, 5], [33, 6]],
      flag: [35, 6],
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
        { x: 11, y: 6, w: 2, h: 0.5, ax: 11, ay: 6, bx: 17, by: 4, speed: 95 },
        { x: 23, y: 4, w: 2, h: 0.5, ax: 23, ay: 4, bx: 28, by: 7, speed: 90 },
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
      wind: [{ x: 8, y: 1, w: 16, h: 10, force: 130 }],
      shimmers: [[6, 6], [16, 5], [26, 2], [35, 3]],
      flag: [38, 5],
    },
    {
      name: "Yengeç Ada",
      width: 28,
      spawn: [2, 9],
      platforms: [
        [0, 11, 6, 2],
        [8, 11, 12, 2],
        [22, 11, 6, 2],
        [1, 8, 3, 0.6],
        [24, 8, 3, 0.6],
        [11, 6, 6, 0.6],
      ],
      spikes: [],
      enemies: [],
      movers: [],
      coins: [[2, 6], [13, 4], [25, 6]],
      shimmers: [[1, 6], [14, 3], [26, 6]],
      wind: [{ x: 6, y: 2, w: 16, h: 8, force: 70 }],
      boss: true,
      flag: [25, 9],
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
    const savedSh = meta.shimmersFound[String(index)] || [];
    const shimmers = (raw.shimmers || []).map(([x, y], i) => ({
      x: t(x) + TILE * 0.2,
      y: t(y) + TILE * 0.15,
      w: 18,
      h: 18,
      taken: savedSh.includes(i),
      bob: Math.random() * Math.PI * 2,
    }));
    const winds = (raw.wind || []).map((w) => ({
      x: t(w.x),
      y: t(w.y),
      w: t(w.w),
      h: t(w.h),
      force: w.force,
    }));
    const flag = {
      x: t(raw.flag[0]),
      y: t(raw.flag[1]),
      w: 20,
      h: TILE * 1.6,
      hidden: !!raw.boss,
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
      shimmers,
      winds,
      flag,
      isBoss: !!raw.boss,
      spawn: { x: t(raw.spawn[0]), y: t(raw.spawn[1]) },
    };
    meta.echo = null;
    echoTrail = [];
    sandBits = [];
    leaves = [];
    meta.windForce = 0;
    meta.windWasIn = false;
    meta.fallSpeedPeak = 0;
    meta.boss = raw.boss
      ? {
          hp: 3,
          maxHp: 3,
          x: t(12),
          y: t(8.2),
          w: t(4),
          h: t(2.6),
          phase: "idle",
          timer: 1.2,
          telegraph: 0,
          facing: -1,
          hitFlash: 0,
          vuln: false,
          slamX: 0,
        }
      : null;
    for (let i = 0; i < 14; i++) {
      leaves.push({
        x: Math.random() * level.width,
        y: Math.random() * H * 0.7,
        vx: 20 + Math.random() * 40,
        vy: -10 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 3,
        r: 4 + Math.random() * 5,
      });
    }
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
    meta.fallSpeedPeak = 0;
    meta.echo = null;
    echoTrail = [];
  }

  function tr(key, vars) {
    return I18N ? I18N.t(key, vars) : key;
  }

  function currentLangMeta() {
    if (!I18N) return { code: "en", flag: "🌐" };
    return I18N.LANGS.find((l) => l.code === I18N.getLang()) || I18N.LANGS[0];
  }

  function updateHud() {
    hudLevel.textContent = `${tr("level")} ${state.levelIndex + 1}/${LEVELS.length}`;
    hudLives.textContent = `${tr("lives")} ${"★".repeat(Math.max(0, state.lives))}${"☆".repeat(Math.max(0, 3 - state.lives))}`;
    let shimmerBit = "";
    if (level && level.shimmers && level.shimmers.length) {
      const got = level.shimmers.filter((s) => s.taken).length;
      shimmerBit = `  ✦ ${got}/${level.shimmers.length}`;
    }
    hudCoins.textContent = `◆ ${state.coins}${shimmerBit}`;
    const windEl = document.getElementById("hud-wind");
    if (windEl) {
      if (meta.windForce !== 0) {
        windEl.classList.remove("hidden");
        const arrow = meta.windForce > 0 ? "→" : "←";
        windEl.textContent = `${arrow} ${tr("windWarn")}`;
      } else {
        windEl.classList.add("hidden");
      }
    }
  }

  function updateChrome() {
    const meta = currentLangMeta();
    langBtn.textContent = `${meta.flag} ${meta.code.toUpperCase()}`;
    langBtn.setAttribute("aria-label", tr("language"));
    langBtn.title = tr("language");
    muteBtn.textContent = muted ? tr("mute") : tr("sound");
    muteBtn.setAttribute("aria-label", muted ? tr("mute") : tr("sound"));
    overlayLangBtn.textContent = `🌐 ${tr("language")}`;
    langTitle.textContent = tr("language");
    langClose.textContent = tr("closeLang");
    updateHud();
    if (!overlay.classList.contains("hidden")) {
      refreshOverlayForMode();
    }
    buildLangList();
  }

  function refreshOverlayForMode() {
    if (state.mode === "title") {
      showOverlay(tr("titleHeadline"), tr("titleMsg"), tr("start"));
    } else if (state.mode === "clear") {
      showOverlay(
        tr("levelClear", { n: state.levelIndex + 1 }),
        tr("levelPassed", { name: LEVELS[state.levelIndex].name }),
        tr("nextLevel")
      );
    } else if (state.mode === "win") {
      showOverlay(
        tr("winTitle"),
        tr("winMsg", { count: LEVELS.length, coins: state.coins }),
        tr("retry")
      );
    } else if (state.mode === "gameover") {
      showOverlay(tr("gameOver"), tr("gameOverMsg"), tr("retry"));
    }
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

  function buildLangList() {
    if (!I18N || !langList) return;
    langList.innerHTML = "";
    const active = I18N.getLang();
    for (const lang of I18N.LANGS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", lang.code === active ? "true" : "false");
      if (lang.code === active) btn.classList.add("active");
      btn.innerHTML = `<span>${lang.flag}</span><span>${lang.name}</span><span class="code">${lang.code}</span>`;
      btn.addEventListener("click", () => {
        I18N.setLang(lang.code);
        closeLangPanel();
        updateChrome();
      });
      langList.appendChild(btn);
    }
  }

  function openLangPanel() {
    buildLangList();
    langPanel.classList.remove("hidden");
    langPanel.setAttribute("aria-hidden", "false");
  }

  function closeLangPanel() {
    langPanel.classList.add("hidden");
    langPanel.setAttribute("aria-hidden", "true");
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
    if (kind === "echo") {
      beep(640, 0.05, "sine", 0.04);
      setTimeout(() => beep(880, 0.09, "triangle", 0.045), 35);
    }
    if (kind === "wind") {
      beep(220, 0.18, "sine", 0.025);
      setTimeout(() => beep(180, 0.22, "triangle", 0.02), 60);
    }
    if (kind === "shimmer") {
      beep(990, 0.05, "sine", 0.04);
      setTimeout(() => beep(1320, 0.1, "triangle", 0.04), 50);
      setTimeout(() => beep(1760, 0.12, "sine", 0.03), 110);
    }
    if (kind === "boss") {
      beep(90, 0.18, "sawtooth", 0.05);
      setTimeout(() => beep(70, 0.22, "sine", 0.04), 90);
    }
    if (kind === "polaroid") {
      beep(700, 0.04, "square", 0.03);
      setTimeout(() => beep(300, 0.08, "sine", 0.035), 40);
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
    state.deathTimer = 1.05;
    sfx("hurt");
    spawnSandDeath(player.x + player.w / 2, player.y + player.h / 2);
    meta.echo = null;
    echoTrail = [];
    updateHud();
  }

  function spawnSandDeath(x, y) {
    sandBits = [];
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 140;
      sandBits.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life: 0.55 + Math.random() * 0.5,
        max: 1.05,
        r: 1.5 + Math.random() * 3.5,
        color: Math.random() > 0.4 ? "#e9c46a" : "#d4a373",
      });
    }
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 50,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        r: 2 + Math.random() * 3,
        color: "rgba(233,196,106,0.75)",
      });
    }
  }

  function spawnEcho(x, y, boostX, boostY) {
    meta.echo = {
      x,
      y,
      timer: ECHO_WINDOW,
      boostX: boostX || 0,
      boostY: boostY || JUMP_V * 0.72,
    };
    meta.echoFlash = 0.25;
    echoTrail = [];
    for (let i = 0; i < 5; i++) {
      echoTrail.push({
        x: x + player.w / 2,
        y: y + player.h / 2,
        life: ECHO_WINDOW - i * 0.05,
        max: ECHO_WINDOW,
        a: 0.35 - i * 0.05,
      });
    }
  }

  function tryEchoJump() {
    if (!meta.echo || meta.echo.timer <= 0) return false;
    const e = meta.echo;
    player.x = e.x;
    player.y = e.y;
    player.vx = e.boostX;
    player.vy = e.boostY;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuf = 0;
    player.squash = 0.7;
    player.stretch = 1.3;
    meta.echo = null;
    meta.echoFlash = 0.35;
    sfx("echo");
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: player.x + player.w / 2 + (Math.random() - 0.5) * 30,
        y: player.y + player.h / 2 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        life: 0.3 + Math.random() * 0.2,
        max: 0.5,
        r: 3 + Math.random() * 3,
        color: skin().trail,
      });
    }
    return true;
  }

  function addShake(mag) {
    meta.shakeMag = Math.max(meta.shakeMag, mag);
    meta.shake = Math.max(meta.shake, 0.22);
  }

  function beginPolaroid() {
    meta.polaroid = {
      t: 0,
      max: 2.6,
      name: level.name,
      lang: (I18N && I18N.getLang()) || "en",
      skip: false,
    };
    state.mode = "polaroid";
    sfx("polaroid");
  }

  function finishPolaroidToOverlay() {
    meta.polaroid = null;
    if (state.levelIndex >= LEVELS.length - 1) {
      state.mode = "win";
      showOverlay(
        tr("winTitle"),
        tr("winMsg", { count: LEVELS.length, coins: state.coins }),
        tr("retry")
      );
    } else {
      state.mode = "clear";
      showOverlay(
        tr("levelClear", { n: state.levelIndex + 1 }),
        tr("levelPassed", { name: LEVELS[state.levelIndex].name }),
        tr("nextLevel")
      );
    }
  }

  function collectShimmer(s) {
    s.taken = true;
    sfx("shimmer");
    spawnSparkles(s.x + 9, s.y + 9);
    showToast(tr("shimmerGot"));
    const key = String(state.levelIndex);
    const prev = meta.shimmersFound[key] || [];
    const idx = level.shimmers.indexOf(s);
    if (!prev.includes(idx)) {
      prev.push(idx);
      meta.shimmersFound[key] = prev;
      saveShimmers();
    }
    const all = level.shimmers.every((sh) => sh.taken);
    if (all) {
      const next = Math.min(SKIN_PALETTE.length - 1, meta.skinIndex + 1);
      if (next !== meta.skinIndex) {
        saveSkin(next);
        showToast(tr("shimmerAll"));
      } else {
        showToast(tr("skinHint"));
      }
    }
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
    if (meta.echo) {
      meta.echo.timer -= dt;
      if (meta.echo.timer <= 0) meta.echo = null;
    }
    if (meta.echoFlash > 0) meta.echoFlash -= dt;

    // Ada Rüzgarı
    let wind = 0;
    for (const z of level.winds || []) {
      if (aabb(player, z)) wind += z.force;
    }
    meta.windForce = wind;
    if (wind !== 0 && !meta.windWasIn) {
      sfx("wind");
      meta.windCue = 0.8;
    }
    meta.windWasIn = wind !== 0;
    if (meta.windCue > 0) meta.windCue -= dt;

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
    player.vx += wind * dt;
    const windCap = MAX_RUN + Math.min(90, Math.abs(wind) * 0.35);
    player.vx = Math.max(-windCap, Math.min(windCap, player.vx));

    if (touch.jumpPressed || keys.has("JumpPulse")) {
      player.jumpBuf = JUMP_BUFFER_MS / 1000;
    }
    if (player.onGround) player.coyote = COYOTE_MS / 1000;
    else player.coyote = Math.max(0, player.coyote - dt);
    player.jumpBuf = Math.max(0, player.jumpBuf - dt);

    const jumpPressed = player.jumpBuf > 0;
    if (jumpPressed && player.coyote > 0) {
      const ox = player.x;
      const oy = player.y;
      // Perfect-land echo still live → boosted hop (skill timing)
      const landEcho = meta.echo && meta.echo.timer > 0;
      player.vy = landEcho ? JUMP_V * 1.12 : JUMP_V;
      if (landEcho) {
        player.vx += Math.sign(meta.echo.boostX || player.facing) * 90;
        meta.echo = null;
        meta.echoFlash = 0.3;
        sfx("echo");
      } else {
        sfx("jump");
      }
      player.onGround = false;
      player.coyote = 0;
      player.jumpBuf = 0;
      player.squash = 0.65;
      player.stretch = 1.35;
      spawnEcho(ox, oy, player.facing * 160, JUMP_V * 0.78);
    } else if (jumpPressed && meta.echo && meta.echo.timer > 0) {
      // Air Echo Jump — blink along the zaman yankısı
      player.jumpBuf = 0;
      tryEchoJump();
    }

    const holdingJump =
      keys.has(" ") ||
      keys.has("ArrowUp") ||
      keys.has("w") ||
      keys.has("W") ||
      touch.jump;
    if (!holdingJump && player.vy < -180) player.vy *= 0.55;

    player.vy += GRAVITY * dt;
    if (player.vy > meta.fallSpeedPeak) meta.fallSpeedPeak = player.vy;

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
      const impact = meta.fallSpeedPeak;
      if (impact > 520) {
        addShake(Math.min(10, (impact - 520) / 80));
      }
      // Perfect landing window → echo trail for skill expression
      if (impact > 380 && impact < 980) {
        spawnEcho(
          player.x,
          player.y - 28,
          player.facing * 200,
          JUMP_V * 0.85
        );
      }
      meta.fallSpeedPeak = 0;
    }

    player.squash += (1 - player.squash) * Math.min(1, dt * 12);
    player.stretch += (1 - player.stretch) * Math.min(1, dt * 12);

    // Soft afterimage trail while echo lives / airborne
    if (meta.echo || (!player.onGround && Math.random() < 0.35)) {
      echoTrail.push({
        x: player.x + player.w / 2,
        y: player.y + player.h / 2,
        life: 0.28,
        max: 0.28,
        a: 0.28,
      });
      if (echoTrail.length > 12) echoTrail.shift();
    }
    echoTrail = echoTrail.filter((e) => {
      e.life -= dt;
      return e.life > 0;
    });

    if (player.y > H + 80) killPlayer();

    for (const s of level.spikes) {
      if (aabb(player, s)) killPlayer();
    }

    // Coin magnet near flag
    const flagCx = level.flag.x + 10;
    const flagCy = level.flag.y + 20;
    const nearFlag =
      !level.flag.hidden &&
      Math.hypot(player.x + player.w / 2 - flagCx, player.y + player.h / 2 - flagCy) < 160;

    for (const c of level.coins) {
      if (c.taken) continue;
      c.bob += dt * 4;
      if (nearFlag) {
        const dx = player.x + player.w / 2 - (c.x + 10);
        const dy = player.y + player.h / 2 - (c.y + 10);
        const d = Math.hypot(dx, dy) || 1;
        if (d < 200) {
          c.x += (dx / d) * 220 * dt;
          c.y += (dy / d) * 220 * dt;
        }
      }
      if (aabb(player, c)) {
        c.taken = true;
        state.coins += 1;
        totalCoins += 1;
        sfx("coin");
        spawnSparkles(c.x + 10, c.y + 10);
        updateHud();
      }
    }

    for (const s of level.shimmers || []) {
      if (s.taken) continue;
      s.bob += dt * 5;
      if (aabb(player, s)) collectShimmer(s);
    }

    if (!level.flag.hidden) {
      const flagHit = {
        x: level.flag.x,
        y: level.flag.y,
        w: 28,
        h: level.flag.h,
      };
      if (aabb(player, flagHit)) {
        sfx("flag");
        spawnSparkles(level.flag.x + 10, level.flag.y + 20);
        beginPolaroid();
      }
    }

    touch.jumpPressed = false;
    keys.delete("JumpPulse");
    // Refresh wind glyph without thrashing other HUD text every frame
    const windEl = document.getElementById("hud-wind");
    if (windEl) {
      if (meta.windForce !== 0) {
        windEl.classList.remove("hidden");
        const arrow = meta.windForce > 0 ? "→" : "←";
        windEl.textContent = `${arrow} ${tr("windWarn")}`;
      } else if (!windEl.classList.contains("hidden")) {
        windEl.classList.add("hidden");
      }
    }
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
    sandBits = sandBits.filter((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
      s.vx *= 0.98;
      return s.life > 0;
    });
    for (const L of leaves) {
      const wf = meta.windForce || 40;
      L.vx += wf * 0.35 * dt;
      L.x += L.vx * dt;
      L.y += (L.vy + Math.sin(state.time * 2 + L.x * 0.01) * 12) * dt;
      L.rot += L.spin * dt;
      if (L.x < -40) L.x = level.width + 20;
      if (L.x > level.width + 40) L.x = -20;
      if (L.y < -20) L.y = H * 0.6;
      if (L.y > H + 20) L.y = 20;
      L.vx *= 0.99;
    }
    for (const c of clouds) {
      c.x += c.speed * dt * (1 + Math.sign(meta.windForce || 1) * 0.15);
      if (c.x > 1600) c.x = -120;
    }
    if (meta.shake > 0) {
      meta.shake -= dt;
      if (meta.shake <= 0) meta.shakeMag = 0;
    }
    if (meta.toast) {
      meta.toast.t -= dt;
      if (meta.toast.t <= 0) meta.toast = null;
    }
  }

  function updateBoss(dt) {
    const b = meta.boss;
    if (!b || b.hp <= 0) return;
    if (b.hitFlash > 0) b.hitFlash -= dt;
    b.timer -= dt;

    if (b.phase === "idle") {
      b.vuln = false;
      if (b.timer <= 0) {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
          b.phase = "tele_slam";
          b.timer = 0.85;
          b.slamX = player.x + player.w / 2;
          sfx("boss");
        } else if (roll === 1) {
          b.phase = "tele_charge";
          b.timer = 0.75;
          b.facing = player.x + player.w / 2 < b.x + b.w / 2 ? -1 : 1;
          sfx("boss");
        } else {
          b.phase = "tele_wave";
          b.timer = 0.9;
          sfx("boss");
        }
      }
    } else if (b.phase === "tele_slam") {
      if (b.timer <= 0) {
        b.phase = "slam";
        b.timer = 0.35;
        addShake(7);
        // claw hit box near slamX
        if (
          player.alive &&
          Math.abs(player.x + player.w / 2 - b.slamX) < 55 &&
          player.y + player.h > b.y + 10
        ) {
          killPlayer();
        }
      }
    } else if (b.phase === "slam") {
      if (b.timer <= 0) {
        b.phase = "vuln";
        b.timer = 1.1;
        b.vuln = true;
      }
    } else if (b.phase === "tele_charge") {
      if (b.timer <= 0) {
        b.phase = "charge";
        b.timer = 0.55;
      }
    } else if (b.phase === "charge") {
      b.x += b.facing * 420 * dt;
      b.x = Math.max(t(6), Math.min(level.width - b.w - t(2), b.x));
      if (player.alive && aabb(player, b) && player.vy <= 0) killPlayer();
      if (b.timer <= 0) {
        b.phase = "vuln";
        b.timer = 1.0;
        b.vuln = true;
      }
    } else if (b.phase === "tele_wave") {
      if (b.timer <= 0) {
        b.phase = "wave";
        b.timer = 0.5;
        addShake(5);
        // sand wave along ground
        if (
          player.alive &&
          player.onGround &&
          player.x + player.w > b.x - 40 &&
          player.x < b.x + b.w + 40
        ) {
          killPlayer();
        }
      }
    } else if (b.phase === "wave") {
      if (b.timer <= 0) {
        b.phase = "vuln";
        b.timer = 1.15;
        b.vuln = true;
      }
    } else if (b.phase === "vuln") {
      b.vuln = true;
      // Stomp weak spot (top of shell)
      if (
        player.alive &&
        player.vy > 80 &&
        player.x + player.w > b.x + 20 &&
        player.x < b.x + b.w - 20 &&
        player.y + player.h > b.y &&
        player.y + player.h < b.y + 36
      ) {
        b.hp -= 1;
        b.hitFlash = 0.4;
        b.vuln = false;
        player.vy = JUMP_V * 0.6;
        sfx("jump");
        spawnSparkles(b.x + b.w / 2, b.y);
        addShake(6);
        if (b.hp <= 0) {
          b.phase = "dead";
          level.flag.hidden = false;
          showToast(tr("bossClear"));
          spawnSparkles(b.x + b.w / 2, b.y + 20);
          spawnSparkles(b.x + b.w / 2, b.y + 40);
        } else {
          b.phase = "idle";
          b.timer = 1.0;
        }
      }
      if (b.timer <= 0 && b.hp > 0) {
        b.phase = "idle";
        b.timer = 0.7;
        b.vuln = false;
      }
    }

    // Body contact during non-vuln (not during charge which has own check)
    if (
      player.alive &&
      b.hp > 0 &&
      !b.vuln &&
      b.phase !== "charge" &&
      b.phase !== "tele_charge" &&
      b.phase !== "tele_slam" &&
      aabb(player, { x: b.x + 10, y: b.y + 30, w: b.w - 20, h: b.h - 30 })
    ) {
      killPlayer();
    }
  }

  function update(dt) {
    state.time += dt;
    if (state.mode === "play") {
      updateMovers(dt);
      updatePlayer(dt);
      updateEnemies(dt);
      updateBoss(dt);
      updateParticles(dt);
      const target = player.x + player.w / 2 - W * 0.4;
      state.camX += (target - state.camX) * Math.min(1, dt * 6);
      state.camX = Math.max(0, Math.min(level.width - W, state.camX));
    } else if (state.mode === "dead") {
      updateParticles(dt);
      state.deathTimer -= dt;
      if (state.deathTimer <= 0) {
        if (state.lives <= 0) {
          state.mode = "gameover";
          showOverlay(tr("gameOver"), tr("gameOverMsg"), tr("retry"));
        } else {
          resetPlayer();
          state.mode = "play";
          updateHud();
        }
      }
    } else if (state.mode === "polaroid") {
      updateParticles(dt);
      if (meta.polaroid) {
        meta.polaroid.t += dt;
        if (meta.polaroid.skip || meta.polaroid.t >= meta.polaroid.max) {
          finishPolaroidToOverlay();
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

    // Parallax clouds
    for (const c of clouds) {
      const cx = c.x - state.camX * 0.08;
      ctx.globalAlpha = c.a;
      ctx.fillStyle = "#f3f7f2";
      ctx.beginPath();
      ctx.ellipse(cx, c.y, c.w * 0.5, c.w * 0.18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - c.w * 0.22, c.y + 6, c.w * 0.28, c.w * 0.14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + c.w * 0.2, c.y + 4, c.w * 0.32, c.w * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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
    if (level.flag.hidden) return;
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

  function drawWindZones() {
    for (const z of level.winds || []) {
      const x = z.x - state.camX;
      if (x + z.w < -20 || x > W + 20) continue;
      ctx.fillStyle = "rgba(243,247,242,0.04)";
      ctx.fillRect(x, z.y, z.w, z.h);
      ctx.strokeStyle = "rgba(243,247,242,0.18)";
      ctx.setLineDash([6, 8]);
      ctx.strokeRect(x + 2, z.y + 2, z.w - 4, z.h - 4);
      ctx.setLineDash([]);
      const dir = z.force >= 0 ? 1 : -1;
      ctx.fillStyle = "rgba(243,247,242,0.35)";
      ctx.font = "700 18px Fredoka, sans-serif";
      for (let i = 0; i < 4; i++) {
        const px = x + ((state.time * 60 * dir + i * 40) % z.w + z.w) % z.w;
        const py = z.y + 20 + i * ((z.h - 40) / 3);
        ctx.fillText(dir > 0 ? "›" : "‹", px, py);
      }
    }
  }

  function drawShimmer(s) {
    if (s.taken) return;
    const x = s.x - state.camX;
    const y = s.y + Math.sin(s.bob) * 5;
    if (x < -20 || x > W + 20) return;
    const pulse = 0.55 + Math.sin(s.bob * 2) * 0.25;
    ctx.save();
    ctx.translate(x + 9, y + 9);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#ffe8a3";
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const r = i % 2 === 0 ? 9 : 4;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff8e7";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEchoTrail() {
    const sk = skin();
    for (const e of echoTrail) {
      ctx.globalAlpha = Math.max(0, (e.life / e.max) * (e.a || 0.25));
      ctx.fillStyle = sk.trail;
      roundRect(e.x - state.camX - 10, e.y - 12, 20, 24, 8);
      ctx.fill();
    }
    if (meta.echo && meta.echo.timer > 0) {
      const e = meta.echo;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(state.time * 18);
      ctx.strokeStyle = sk.body;
      ctx.lineWidth = 2;
      roundRect(e.x - state.camX, e.y, player.w, player.h, 10);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = sk.body;
      roundRect(e.x - state.camX + 4, e.y + 4, player.w - 8, player.h - 8, 8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves() {
    for (const L of leaves) {
      const x = L.x - state.camX;
      if (x < -30 || x > W + 30) continue;
      ctx.save();
      ctx.translate(x, L.y);
      ctx.rotate(L.rot);
      ctx.fillStyle = "rgba(126,200,163,0.75)";
      ctx.beginPath();
      ctx.ellipse(0, 0, L.r, L.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBoss() {
    const b = meta.boss;
    if (!b || b.hp <= 0) return;
    const x = b.x - state.camX;
    const y = b.y;
    const flash = b.hitFlash > 0 && Math.floor(state.time * 20) % 2 === 0;

    // Telegraph markers
    if (b.phase === "tele_slam" || b.phase === "slam") {
      const sx = b.slamX - state.camX;
      ctx.fillStyle = "rgba(232,93,76,0.25)";
      ctx.fillRect(sx - 50, H - 80, 100, 40);
      ctx.strokeStyle = "rgba(232,93,76,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 50, b.y + b.h - 10, 100, 16);
    }
    if (b.phase === "tele_charge") {
      ctx.fillStyle = "rgba(240,164,93,0.3)";
      ctx.fillRect(x - 8, y + 20, b.w + 16, 18);
    }
    if (b.phase === "tele_wave" || b.phase === "wave") {
      ctx.fillStyle = "rgba(233,196,106,0.35)";
      ctx.fillRect(x - 50, b.y + b.h - 8, b.w + 100, 14);
    }

    ctx.save();
    if (flash) ctx.globalAlpha = 0.5;
    // Body / shell
    ctx.fillStyle = b.vuln ? "#e9c46a" : "#c44536";
    roundRect(x + 16, y + 18, b.w - 32, b.h - 18, 16);
    ctx.fill();
    ctx.fillStyle = b.vuln ? "#f4e1a1" : "#8b2e22";
    roundRect(x + 28, y + 8, b.w - 56, 28, 12);
    ctx.fill();
    // Claws
    ctx.fillStyle = "#a33b2e";
    const clawBob = Math.sin(state.time * 4) * 4;
    roundRect(x - 10, y + 28 + clawBob, 36, 22, 8);
    roundRect(x + b.w - 26, y + 28 - clawBob, 36, 22, 8);
    ctx.fill();
    // Eyes
    ctx.fillStyle = "#f3f7f2";
    ctx.beginPath();
    ctx.arc(x + b.w * 0.35, y + 36, 7, 0, Math.PI * 2);
    ctx.arc(x + b.w * 0.65, y + 36, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b2e28";
    const look = b.facing * 2;
    ctx.beginPath();
    ctx.arc(x + b.w * 0.35 + look, y + 36, 3, 0, Math.PI * 2);
    ctx.arc(x + b.w * 0.65 + look, y + 36, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // HP pips
    for (let i = 0; i < b.maxHp; i++) {
      ctx.fillStyle = i < b.hp ? "#e85d4c" : "rgba(255,255,255,0.2)";
      roundRect(x + 30 + i * 28, y - 18, 22, 10, 4);
      ctx.fill();
    }
    if (b.vuln) {
      ctx.fillStyle = "rgba(243,247,242,0.85)";
      ctx.font = "700 13px Nunito, sans-serif";
      ctx.fillText("▼", x + b.w / 2 - 6, y);
    }
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
      // dissolve into sand — fade body quickly
      ctx.globalAlpha = Math.max(0, Math.min(1, (state.deathTimer - 0.35) / 0.5));
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

    const sk = skin();
    // Body
    ctx.fillStyle = sk.body;
    roundRect(-pw / 2, -ph / 2, pw, ph, 10);
    ctx.fill();

    // Belly
    ctx.fillStyle = sk.belly;
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
    ctx.fillStyle = sk.feet;
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
    for (const s of sandBits) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x - state.camX, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawToast() {
    if (!meta.toast) return;
    const a = Math.min(1, meta.toast.t * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(14,42,47,0.72)";
    const tw = Math.min(420, 40 + meta.toast.text.length * 8);
    roundRect(W / 2 - tw / 2, 64, tw, 36, 12);
    ctx.fill();
    ctx.fillStyle = "#f3f7f2";
    ctx.font = "700 15px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(meta.toast.text, W / 2, 88);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  function drawPolaroid() {
    const p = meta.polaroid;
    if (!p) return;
    const k = Math.min(1, p.t / 0.35);
    const drop = (1 - k) * -80;
    const rot = (1 - k) * -0.12;
    ctx.fillStyle = `rgba(8,24,28,${0.35 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2 + drop);
    ctx.rotate(rot);
    ctx.fillStyle = "#f7f1e3";
    roundRect(-150, -120, 300, 260, 6);
    ctx.fill();
    ctx.fillStyle = "#1a4a42";
    ctx.fillRect(-130, -100, 260, 170);
    // Mini scene snapshot: player + flag
    ctx.save();
    ctx.beginPath();
    ctx.rect(-130, -100, 260, 170);
    ctx.clip();
    ctx.translate(-player.x + state.camX - W / 2 + 0, -40);
    // simplified: redraw player/flag locally
    ctx.restore();
    // Draw silhouettes inside frame
    ctx.fillStyle = skin().body;
    roundRect(-20, -20, 28, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#e85d4c";
    ctx.fillRect(40, -40, 6, 70);
    ctx.beginPath();
    ctx.moveTo(46, -40);
    ctx.lineTo(78, -28);
    ctx.lineTo(46, -16);
    ctx.fill();
    ctx.fillStyle = "#1b2e28";
    ctx.font = "700 16px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, 0, 95);
    ctx.font = "600 12px Nunito, sans-serif";
    ctx.fillStyle = "rgba(27,46,40,0.7)";
    ctx.fillText(`${p.lang.toUpperCase()} · Zıpla Ada`, 0, 116);
    ctx.restore();
    if (p.t > 0.5) {
      ctx.globalAlpha = Math.min(1, (p.t - 0.5) * 2);
      ctx.fillStyle = "rgba(243,247,242,0.9)";
      ctx.font = "700 14px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr("polaroidTap"), W / 2, H - 36);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.save();
    if (meta.shake > 0 && meta.shakeMag > 0) {
      const m = meta.shakeMag * (meta.shake / 0.22);
      ctx.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
    }
    paintSky();
    if (!level) {
      ctx.restore();
      return;
    }

    drawWindZones();
    drawLeaves();
    for (const p of level.platforms) drawPlatform(p, false);
    for (const m of level.movers) drawPlatform(m, true);
    for (const s of level.spikes) drawSpikes(s);
    for (const c of level.coins) drawCoin(c);
    for (const s of level.shimmers || []) drawShimmer(s);
    drawFlag();
    drawBoss();
    for (const e of level.enemies) drawEnemy(e);
    drawEchoTrail();
    if (player.alive || state.mode === "dead" || state.mode === "polaroid") drawPlayer();
    drawParticles();
    drawToast();
    if (meta.echo && meta.echo.timer > 0 && state.mode === "play") {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#f3f7f2";
      ctx.font = "700 13px Nunito, sans-serif";
      ctx.fillText(tr("echoHint"), 16, H - 18);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (state.mode === "polaroid") drawPolaroid();
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
    muteBtn.textContent = muted ? tr("mute") : tr("sound");
    muteBtn.setAttribute("aria-label", muted ? tr("mute") : tr("sound"));
    if (!muted) ensureAudio();
  });

  langBtn.addEventListener("click", () => openLangPanel());
  overlayLangBtn.addEventListener("click", () => openLangPanel());
  langClose.addEventListener("click", () => closeLangPanel());
  langPanel.addEventListener("click", (e) => {
    if (e.target === langPanel) closeLangPanel();
  });

  function skipPolaroid() {
    if (state.mode === "polaroid" && meta.polaroid) meta.polaroid.skip = true;
  }

  overlayBtn.addEventListener("click", () => {
    ensureAudio();
    if (state.mode === "polaroid") {
      skipPolaroid();
      return;
    }
    if (state.mode === "title" || state.mode === "win" || state.mode === "gameover") {
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
    }
  });

  window.addEventListener("pointerdown", (e) => {
    if (state.mode === "polaroid") {
      // Don't steal language/mute clicks
      if (e.target && e.target.closest && e.target.closest("#top-actions, #lang-panel")) return;
      skipPolaroid();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (state.mode === "polaroid" && (e.key === " " || e.key === "Enter" || e.key === "Escape")) {
      skipPolaroid();
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
  updateChrome();
  showOverlay(tr("titleHeadline"), tr("titleMsg"), tr("start"));
  requestAnimationFrame(frame);
})();
