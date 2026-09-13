/* <sanctuary-stage> — a three.js sanctuary: stone ambo, opening Lectionary,
   candles, dust. Page content comes in as plain descriptors via setPages();
   textures are drawn to canvas lazily and kept in a small LRU.
   Classic script (no modules) so it can be loaded next to a global THREE. */
(function () {
  if (window.__sanctuaryStage) return;
  window.__sanctuaryStage = true;

  var PW = 0.455, PH = 0.60;          // half-spread page size, world units
  var TW = 880, TH = 1180;            // page texture size
  var BLOCK = 0.052;                  // full page-stack thickness
  var FLIP_MS = 940;
  var LEAF_SEG = 26;

  var GOLD = "#c8a24e", GOLD_LT = "#e8cd8e";
  var LIT = { violet: "#6d4a9c", white: "#e3c473", green: "#3e8a5d", red: "#a93c3c", rose: "#cf87a4" };

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- canvas helpers ---------- */

  function cv(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  var CAN_LS = (function () {
    try { var c = cv(4, 4).getContext("2d"); c.letterSpacing = "2px"; return c.letterSpacing === "2px"; }
    catch (e) { return false; }
  })();

  // Draws tracked-out text. The per-glyph path must force left alignment:
  // callers often leave textAlign at "center", which would centre every letter
  // on its own cursor position and space the run unevenly.
  function tracked(ctx, text, x, y, sp, align) {
    var s = String(text), prev = ctx.textAlign, w, cx, i;
    if (CAN_LS) {
      ctx.letterSpacing = sp + "px";
      w = ctx.measureText(s).width - sp;
      cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
      ctx.textAlign = "left";
      ctx.fillText(s, cx, y);
      ctx.letterSpacing = "0px";
      ctx.textAlign = prev;
      return w;
    }
    var chars = s.split("");
    w = 0;
    for (i = 0; i < chars.length; i++) w += ctx.measureText(chars[i]).width + sp;
    w -= sp;
    cx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.textAlign = "left";
    for (i = 0; i < chars.length; i++) { ctx.fillText(chars[i], cx, y); cx += ctx.measureText(chars[i]).width + sp; }
    ctx.textAlign = prev;
    return w;
  }

  function wrap(ctx, text, x, y, maxW, lh, align) {
    var words = String(text).split(/\s+/), line = "", cy = y, i;
    for (i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, align === "center" ? x : x, cy); line = words[i]; cy += lh;
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, cy); cy += lh; }
    return cy;
  }

  function parchment(ctx, side) {
    ctx.fillStyle = "#f3e9d2"; ctx.fillRect(0, 0, TW, TH);
    // fibres
    ctx.save();
    for (var i = 0; i < 520; i++) {
      var x = Math.random() * TW, y = Math.random() * TH, l = 2 + Math.random() * 16;
      ctx.strokeStyle = Math.random() > 0.5 ? "rgba(120,96,52,0.045)" : "rgba(255,252,240,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (Math.random() - 0.5) * 3); ctx.stroke();
    }
    ctx.restore();
    // age vignette
    var g = ctx.createRadialGradient(TW / 2, TH / 2, TH * 0.22, TW / 2, TH / 2, TH * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(112,84,38,0.13)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
    // gutter shadow on the spine edge
    var sx = side === "left" ? TW : 0;
    var gg = ctx.createLinearGradient(sx, 0, side === "left" ? TW - 150 : 150, 0);
    gg.addColorStop(0, "rgba(60,40,16,0.30)"); gg.addColorStop(1, "rgba(60,40,16,0)");
    ctx.fillStyle = gg; ctx.fillRect(0, 0, TW, TH);
  }

  function frame(ctx) {
    ctx.strokeStyle = "rgba(160,126,58,0.75)"; ctx.lineWidth = 2.5;
    ctx.strokeRect(52, 58, TW - 104, TH - 116);
    ctx.strokeStyle = "rgba(160,126,58,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(64, 70, TW - 128, TH - 140);
  }

  function rule(ctx, x1, x2, y) {
    var g = ctx.createLinearGradient(x1, 0, x2, 0);
    g.addColorStop(0, "rgba(160,126,58,0)"); g.addColorStop(0.5, "rgba(160,126,58,0.85)"); g.addColorStop(1, "rgba(160,126,58,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  }

  function folio(ctx, p) {
    if (!p.folio) return;
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(94,74,40,0.6)";
    ctx.font = "300 22px Cinzel, Georgia, serif";
    tracked(ctx, p.folio, TW / 2, TH - 86, 3, "center");
  }

  function running(ctx, text) {
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(120,96,52,0.62)";
    ctx.font = "300 24px Cinzel, Georgia, serif";
    tracked(ctx, String(text).toUpperCase(), TW / 2, 122, 3.8, "center");
    rule(ctx, TW * 0.2, TW * 0.8, 146);
  }

  function drawCover(ctx) {
    var g = ctx.createLinearGradient(0, 0, TW, TH);
    g.addColorStop(0, "#2a1330"); g.addColorStop(0.5, "#3d1b3c"); g.addColorStop(1, "#1c0f22");
    ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
    // leather grain
    for (var i = 0; i < 2400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,240,220,0.022)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(Math.random() * TW, Math.random() * TH, 2 + Math.random() * 5, 1.6);
    }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.strokeRect(56, 62, TW - 112, TH - 124);
    ctx.strokeStyle = "rgba(200,162,78,0.5)"; ctx.lineWidth = 1.6; ctx.strokeRect(76, 82, TW - 152, TH - 164);
    // corner studs
    [[92, 98], [TW - 92, 98], [92, TH - 98], [TW - 92, TH - 98]].forEach(function (p) {
      var rg = ctx.createRadialGradient(p[0] - 3, p[1] - 3, 1, p[0], p[1], 13);
      rg.addColorStop(0, GOLD_LT); rg.addColorStop(1, "#7d6128");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p[0], p[1], 13, 0, 6.2832); ctx.fill();
    });
    // medallion
    ctx.strokeStyle = "rgba(200,162,78,0.8)"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(TW / 2, TH * 0.40, 168, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = "rgba(200,162,78,0.35)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(TW / 2, TH * 0.40, 152, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = "rgba(200,162,78,0.9)";
    ctx.fillRect(TW / 2 - 7, TH * 0.40 - 92, 14, 184);
    ctx.fillRect(TW / 2 - 56, TH * 0.40 - 40, 112, 14);

    ctx.textAlign = "center"; ctx.fillStyle = GOLD_LT;
    ctx.font = "400 74px Cinzel, Georgia, serif";
    tracked(ctx, "LECTIONARY", TW / 2, TH * 0.74, 5, "center");
    ctx.fillStyle = "rgba(200,162,78,0.72)";
    ctx.font = "300 26px Cinzel, Georgia, serif";
    tracked(ctx, "SUNDAYS & SOLEMNITIES", TW / 2, TH * 0.80, 6, "center");
    tracked(ctx, "OF THE ROMAN RITE", TW / 2, TH * 0.835, 6, "center");
  }

  function drawFlyleaf(ctx) {
    parchment(ctx, "left"); frame(ctx);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(160,126,58,0.9)";
    ctx.fillRect(TW / 2 - 4, TH * 0.42 - 60, 8, 120);
    ctx.fillRect(TW / 2 - 34, TH * 0.42 - 26, 68, 8);
    ctx.fillStyle = "rgba(94,74,40,0.85)";
    ctx.font = "italic 40px 'Sorts Mill Goudy', Georgia, serif";
    ctx.fillText("Verbum Domini", TW / 2, TH * 0.60);
    ctx.font = "300 21px Cinzel, Georgia, serif";
    ctx.fillStyle = "rgba(120,96,52,0.6)";
    tracked(ctx, "DEO GRATIAS", TW / 2, TH * 0.655, 5, "center");
  }

  function drawTitle(ctx, p) {
    parchment(ctx, p.side); frame(ctx);
    var accent = LIT[p.colorKey] || GOLD;
    ctx.fillStyle = accent; ctx.globalAlpha = 0.85;
    ctx.fillRect(TW / 2 - 130, 150, 260, 7); ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(120,96,52,0.75)"; ctx.font = "300 26px Cinzel, Georgia, serif";
    tracked(ctx, String(p.season || "").toUpperCase(), TW / 2, 214, 6, "center");

    ctx.fillStyle = "#2b2313"; ctx.font = "400 74px 'Sorts Mill Goudy', Georgia, serif";
    var y = wrap(ctx, p.name, TW / 2, 330, TW - 200, 88, "center");

    rule(ctx, TW * 0.2, TW * 0.8, y + 40);
    ctx.fillStyle = "rgba(94,74,40,0.9)"; ctx.font = "300 32px Cinzel, Georgia, serif";
    tracked(ctx, p.date, TW / 2, y + 112, 1.8, "center");

    if (p.rank) {
      ctx.fillStyle = "rgba(160,126,58,0.95)"; ctx.font = "300 25px Cinzel, Georgia, serif";
      tracked(ctx, String(p.rank).toUpperCase(), TW / 2, y + 170, 7, "center");
    }

    var cy = TH - 300;
    var rg = ctx.createRadialGradient(TW / 2 - 8, cy - 8, 2, TW / 2, cy, 34);
    rg.addColorStop(0, "#ffffff"); rg.addColorStop(0.25, accent); rg.addColorStop(1, accent);
    ctx.globalAlpha = 0.92; ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(TW / 2, cy, 34, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(160,126,58,0.9)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(TW / 2, cy, 34, 0, 6.2832); ctx.stroke();

    ctx.fillStyle = "rgba(94,74,40,0.85)"; ctx.font = "300 27px Cinzel, Georgia, serif";
    tracked(ctx, String(p.colorLabel).toUpperCase(), TW / 2, cy + 84, 5, "center");
    ctx.fillStyle = "rgba(160,126,58,0.95)"; ctx.font = "300 26px Cinzel, Georgia, serif";
    tracked(ctx, "SUNDAY CYCLE " + p.cycle, TW / 2, cy + 132, 6, "center");
    folio(ctx, p);
  }

  function drawReadings(ctx, p) {
    parchment(ctx, p.side); frame(ctx);
    if (p.running) running(ctx, p.running);
    var x = 104, maxW = TW - 208, y = 300;

    (p.items || []).forEach(function (it, idx) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(160,126,58,0.95)"; ctx.font = "300 30px Cinzel, Georgia, serif";
      tracked(ctx, it.label.toUpperCase(), x, y, 7, "left");
      y += 26;
      var ruleY = y;
      rule(ctx, x, x + maxW * 0.66, ruleY);
      y += 84;

      if (p.initial && idx === 0) {
        // Anchored below the rule, not above it — otherwise the rule runs
        // straight through the illuminated initial and the passage beside it.
        var box = 176, ac = LIT[p.accent] || "#6d4a9c", top = ruleY + 36;
        var lg = ctx.createLinearGradient(x, top, x + box, top + box);
        lg.addColorStop(0, ac); lg.addColorStop(1, "rgba(40,24,52,0.92)");
        ctx.fillStyle = lg; ctx.fillRect(x, top, box, box);
        ctx.strokeStyle = GOLD; ctx.lineWidth = 3.5; ctx.strokeRect(x, top, box, box);
        ctx.strokeStyle = "rgba(232,205,142,0.45)"; ctx.lineWidth = 1.2;
        ctx.strokeRect(x + 11, top + 11, box - 22, box - 22);
        ctx.textAlign = "center"; ctx.fillStyle = GOLD_LT;
        ctx.font = "400 128px Cinzel, Georgia, serif";
        ctx.fillText(p.initial, x + box / 2, top + box / 2 + 46);
        ctx.textAlign = "left";
        ctx.fillStyle = "#2b2313"; ctx.font = "400 76px 'Sorts Mill Goudy', Georgia, serif";
        var end = wrap(ctx, it.text, x + box + 40, top + 78, maxW - box - 40, 94, "left");
        y = Math.max(end, top + box) + 60;
      } else {
        ctx.fillStyle = "#2b2313"; ctx.font = "400 82px 'Sorts Mill Goudy', Georgia, serif";
        y = wrap(ctx, it.text, x, y, maxW, 100, "left") + 120;
      }
    });
    folio(ctx, p);
  }

  function drawPage(p) {
    var c = cv(TW, TH), ctx = c.getContext("2d");
    ctx.textBaseline = "alphabetic";
    if (!p) { parchment(ctx, "right"); return c; }
    if (p.kind === "cover") drawCover(ctx);
    else if (p.kind === "flyleaf") drawFlyleaf(ctx);
    else if (p.kind === "title") drawTitle(ctx, p);
    else drawReadings(ctx, p);
    return c;
  }

  /* ---------- procedural material textures ---------- */

  function stoneTex(base, veinAlpha, size) {
    var c = cv(size, size), ctx = c.getContext("2d");
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    for (var i = 0; i < size * 26; i++) {
      var g = Math.random();
      ctx.fillStyle = g > 0.5 ? "rgba(255,255,255," + (0.02 + g * 0.03) + ")" : "rgba(0,0,0,0.05)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    for (var v = 0; v < 26; v++) {
      ctx.strokeStyle = "rgba(0,0,0," + veinAlpha + ")"; ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      var x = Math.random() * size, y = Math.random() * size;
      ctx.moveTo(x, y);
      for (var s = 0; s < 6; s++) { x += (Math.random() - 0.5) * size * 0.3; y += (Math.random() - 0.5) * size * 0.3; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return c;
  }

  function floorTex() {
    var s = 512, c = cv(s, s), ctx = c.getContext("2d");
    ctx.drawImage(stoneTex("#241d31", 0.16, s), 0, 0);
    ctx.strokeStyle = "rgba(8,5,14,0.85)"; ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(8,5,14,0.5)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2); ctx.stroke();
    return c;
  }

  function clothTex(hex) {
    var s = 512, c = cv(s, s), ctx = c.getContext("2d");
    ctx.fillStyle = hex; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "rgba(0,0,0,0.30)"; ctx.fillRect(0, 0, s, s);
    for (var i = 0; i < 2000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 1.5);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (var d = -s; d < s * 2; d += 26) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d - s, s); ctx.stroke(); }
    ctx.strokeStyle = "rgba(200,162,78,0.85)"; ctx.lineWidth = 8;
    ctx.strokeRect(22, 10, s - 44, s - 20);
    ctx.fillStyle = "rgba(216,180,102,0.92)";
    ctx.fillRect(s / 2 - 13, s * 0.30, 26, 190);
    ctx.fillRect(s / 2 - 66, s * 0.42, 132, 26);
    return c;
  }

  function glowSprite(hex) {
    var s = 128, c = cv(s, s), ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, hex); g.addColorStop(0.25, "rgba(255,196,110,0.42)"); g.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return c;
  }

  /* ---------- component ---------- */

  var MOODS = {
    Candlelight: { amb: 0x241c36, ambI: 0.34, key: 0xffd8ab, keyI: 1.18, fill: 0x5b45a0, fillI: 0.22, candle: 1.9, tint: 0.26, bg: 0x0a0812 },
    Vespers: { amb: 0x1b2140, ambI: 0.30, key: 0x9fb8ff, keyI: 0.50, fill: 0x7a58c0, fillI: 0.48, candle: 2.5, tint: 0.55, bg: 0x080912 },
    "Feast Day": { amb: 0x352c4a, ambI: 0.62, key: 0xfff0d2, keyI: 1.35, fill: 0xffc98a, fillI: 0.45, candle: 1.2, tint: 0.30, bg: 0x120d1c }
  };

  var Stage = function () { };

  class SanctuaryStage extends HTMLElement {
    connectedCallback() {
      if (this._booted) return;
      this._booted = true;
      if (!this.style.display) this.style.display = "block";
      if (!this.style.position) this.style.position = "relative";
      if (!this.style.width) this.style.width = "100%";
      if (!this.style.height) this.style.height = "100%";
      this._pages = [];
      this._spread = -1;
      this._flip = null;
      this._mood = this.getAttribute("mood") || "Candlelight";
      this._accent = "#6d4a9c";
      this._cache = new Map();
      this._pointer = { x: 0, y: 0 };
      this._fontsReady = false;
      this._orb = { theta: 0, phi: 0, zoom: 1 };
      this._orbT = { theta: 0, phi: 0, zoom: 1 };
      this._waitForThree(0);
    }

    disconnectedCallback() {
      this._dead = true;
      if (this._ro) this._ro.disconnect();
      if (this._onVis) document.removeEventListener("visibilitychange", this._onVis);
      if (this._renderer) this._renderer.dispose();
    }

    _waitForThree(n) {
      if (this._dead) return;
      if (window.THREE) { try { this._build(); } catch (e) { console.error(e); this._fail(); } return; }
      if (n > 120) { this._fail(); return; }
      setTimeout(this._waitForThree.bind(this, n + 1), 60);
    }

    _fail() {
      this.dispatchEvent(new CustomEvent("stage-failed", { bubbles: true, composed: true }));
    }

    /* ---- scene ---- */

    _build() {
      var self = this;
      var w = this.clientWidth || 640, h = this.clientHeight || 720;
      var mood = MOODS[this._mood] || MOODS.Candlelight;

      var renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(mood.bg, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.cursor = "pointer";
      this.appendChild(renderer.domElement);
      this._renderer = renderer;

      var scene = new THREE.Scene();
      scene.fog = new THREE.Fog(mood.bg, 3.4, 11.5);
      this._scene = scene;

      var camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 60);
      this._camera = camera;
      this._camPose = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
      this._camFrom = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
      this._camTo = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
      this._camT = 1;

      /* lights */
      var amb = new THREE.AmbientLight(mood.amb, mood.ambI); scene.add(amb);
      var key = new THREE.DirectionalLight(mood.key, mood.keyI);
      key.position.set(-2.6, 4.6, 2.8);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2;
      key.shadow.camera.top = 4.2; key.shadow.camera.bottom = -1.6;
      key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
      key.shadow.bias = -0.0012;
      key.shadow.radius = 2.4;
      scene.add(key);
      var fill = new THREE.DirectionalLight(mood.fill, mood.fillI);
      fill.position.set(3.2, 2.2, -2.4); scene.add(fill);
      var tint = new THREE.SpotLight(0x6d4a9c, mood.tint, 12, 0.7, 0.85, 1.2);
      tint.position.set(0.2, 5.2, -1.6); tint.target.position.set(0, 1.3, 0);
      scene.add(tint); scene.add(tint.target);
      var desk = new THREE.PointLight(0xffd6a0, 0.55, 3.4, 2);
      desk.position.set(0, 2.05, 0.75); scene.add(desk);
      this._deskLight = desk;
      this._lights = { amb: amb, key: key, fill: fill, tint: tint };

      /* floor + wall */
      var ft = new THREE.CanvasTexture(floorTex());
      ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(9, 9);
      if (THREE.sRGBEncoding !== undefined) ft.encoding = THREE.sRGBEncoding;
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ map: ft, roughness: 0.72, metalness: 0.04 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

      var wt = new THREE.CanvasTexture(stoneTex("#13101f", 0.24, 256));
      wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(7, 5);
      var wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 14),
        new THREE.MeshStandardMaterial({ map: wt, color: 0x6a6478, roughness: 0.96 }));
      wall.position.set(0, 7, -6.2); scene.add(wall);

      this._buildAmbo(scene);
      this._buildBook(scene);
      this._buildCandles(scene);
      this._buildDust(scene);

      this._setPose("closed", true);
      this._applyProg();

      /* interaction: drag to orbit, wheel to zoom, click to turn */
      this._ray = new THREE.Raycaster();
      var el = renderer.domElement;
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", function (e) {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        self._drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
        el.style.cursor = "grabbing";
      });
      el.addEventListener("pointermove", function (e) {
        var d = self._drag;
        if (!d) return;
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        d.moved = true;
        self._orbT.theta -= dx * 0.0062;
        self._orbT.phi -= dy * 0.0052;
        // Azimuth is free — walk right around the ambo. Pitch stops short of
        // the pole, where the camera's up vector goes parallel to the view
        // direction and the roll flips the whole scene over.
        if (self._orbT.theta > Math.PI) self._orbT.theta -= 2 * Math.PI;
        if (self._orbT.theta < -Math.PI) self._orbT.theta += 2 * Math.PI;
        self._orbT.phi = Math.max(-0.42, Math.min(0.88, self._orbT.phi));
        d.x = e.clientX; d.y = e.clientY;
      });
      el.addEventListener("pointerup", function (e) {
        var d = self._drag;
        self._drag = null;
        el.style.cursor = "grab";
        if (d && !d.moved && performance.now() - d.t < 450) self._onClick(e);
      });
      el.addEventListener("pointercancel", function () { self._drag = null; el.style.cursor = "grab"; });
      el.addEventListener("wheel", function (e) {
        e.preventDefault();
        self._orbT.zoom = Math.max(0.5, Math.min(2.4, self._orbT.zoom * (1 + e.deltaY * 0.0011)));
      }, { passive: false });
      el.addEventListener("dblclick", function () { self.resetView(); });
      el.style.cursor = "grab";

      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this);
      this._onVis = function () { if (!document.hidden && self._flip) self._endFlip(); };
      document.addEventListener("visibilitychange", this._onVis);
      this._clock = new THREE.Clock();
      this._loop();

      // Pages are only drawn once the display faces are available, so a page
      // is never painted in a fallback font and silently redrawn later.
      var ready = function () {
        if (self._fontsReady) return;
        self._fontsReady = true;
        self._cache.forEach(function (v) { v.tex.dispose(); });
        self._cache.clear();
        self._refreshFaces();
        self._prewarm();
      };
      if (document.fonts && document.fonts.load) {
        Promise.all([
          document.fonts.load("400 60px 'Sorts Mill Goudy'"),
          document.fonts.load("italic 40px 'Sorts Mill Goudy'"),
          document.fonts.load("400 40px Cinzel"),
          document.fonts.load("300 30px Cinzel")
        ]).then(ready).catch(ready);
        setTimeout(ready, 4000);
      } else ready();

      // Deferred: when the script is loaded up front the element can finish
      // building before the host has attached its listener.
      setTimeout(function () {
        if (!self._dead) self.dispatchEvent(new CustomEvent("stage-ready", { bubbles: true, composed: true, detail: { stage: self } }));
      }, 0);
    }

    resetView() { this._orbT.theta = 0; this._orbT.phi = 0; this._orbT.zoom = 1; }

    _buildAmbo(scene) {
      var g = new THREE.Group();
      var light = new THREE.MeshStandardMaterial({
        map: (function () { var t = new THREE.CanvasTexture(stoneTex("#6f6480", 0.13, 256)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; })(),
        color: 0x8b8196, roughness: 0.88, metalness: 0.02
      });
      var dark = new THREE.MeshStandardMaterial({ color: 0x3d3549, roughness: 0.9 });
      var gold = new THREE.MeshStandardMaterial({ color: 0xc79f4e, roughness: 0.32, metalness: 0.85 });

      function box(w, h, d, y, z, mat) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || light);
        m.position.set(0, y, z || 0); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
      }
      box(1.28, 0.11, 0.92, 0.055);
      box(1.06, 0.09, 0.76, 0.155);
      box(0.90, 0.045, 0.62, 0.222, 0, dark);

      var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.40, 0.90, 8), light);
      shaft.position.set(0, 0.695, 0); shaft.rotation.y = Math.PI / 8;
      shaft.castShadow = true; shaft.receiveShadow = true; g.add(shaft);

      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.355, 0.03, 8), gold);
      band.position.set(0, 1.125, 0); band.rotation.y = Math.PI / 8; g.add(band);

      box(0.86, 0.05, 0.62, 1.168, 0, dark);
      box(1.06, 0.075, 0.76, 1.23);

      // reading desk, tilted toward the reader
      var desk = new THREE.Group();
      var top = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.055, 0.76), light);
      top.castShadow = true; top.receiveShadow = true; desk.add(top);
      var lip = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.042, 0.04), gold);
      lip.position.set(0, 0.04, 0.38); desk.add(lip);
      desk.position.set(0, 1.303, 0.012);
      // Far edge high, near edge low: the page's head is at -z, so up the
      // page must be up the slant. The lip then sits at the foot of the
      // slope, where it actually stops the book from sliding.
      desk.rotation.x = 0.225;
      g.add(desk);
      this._desk = desk;

      // frontal (antependium) in the liturgical colour
      var cg = new THREE.PlaneGeometry(0.56, 0.62, 18, 4);
      var pos = cg.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i);
        pos.setZ(i, Math.cos(x / 0.28 * 1.35) * 0.035 - 0.035);
      }
      cg.computeVertexNormals();
      this._clothMap = new THREE.CanvasTexture(clothTex("#6d4a9c"));
      if (THREE.sRGBEncoding !== undefined) this._clothMap.encoding = THREE.sRGBEncoding;
      var cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({
        map: this._clothMap, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide
      }));
      // Hung on the far face of the ambo; turned so the cross reads outward.
      cloth.position.set(0, 0.80, -0.375); cloth.rotation.y = Math.PI;
      cloth.castShadow = true; g.add(cloth);
      this._cloth = cloth;

      scene.add(g);
      this._ambo = g;
    }

    _buildBook(scene) {
      var root = new THREE.Group();
      this._desk.add(root);
      root.position.set(-PW / 2, 0.038, -0.01);
      this._book = root;

      var paper = new THREE.MeshStandardMaterial({ color: 0xf1e6ce, roughness: 0.94 });
      var edge = new THREE.MeshStandardMaterial({ color: 0xd9c58c, roughness: 0.55, metalness: 0.35 });
      var leather = new THREE.MeshStandardMaterial({ color: 0x2e1533, roughness: 0.72, metalness: 0.06 });

      // cover boards
      var bw = PW + 0.022, bd = PH + 0.022;
      this._boards = [];
      [-1, 1].forEach(function (s) {
        var b = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.018, bd), leather);
        b.position.set(s * (bw / 2), 0.009, 0);
        b.castShadow = true; b.receiveShadow = true; root.add(b);
        this._boards.push(b);
      }, this);
      var spine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, bd), leather);
      spine.position.set(0, 0.028, 0); root.add(spine);

      // page stacks (thickness animates as you leaf through)
      var stackMats = [edge, edge, paper, edge, edge, edge];
      this._stacks = [];
      [-1, 1].forEach(function (s) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(PW, 1, PH), stackMats);
        m.position.set(s * (PW / 2), 0, 0);
        m.castShadow = true; m.receiveShadow = true; root.add(m);
        this._stacks.push(m);
      }, this);

      // static page faces
      this._faces = {};
      this._faces.left = this._pageMesh(-1, false);
      this._faces.right = this._pageMesh(1, false);
      root.add(this._faces.left, this._faces.right);

      // flipping leaf: front (normal up) + back (mirrored uv, BackSide)
      var leaf = new THREE.Group(); root.add(leaf);
      this._leaf = leaf;
      this._faces.leafFront = this._pageMesh(1, false, LEAF_SEG);
      this._faces.leafBack = this._pageMesh(1, true, LEAF_SEG);
      this._faces.leafFront.castShadow = true;
      leaf.add(this._faces.leafFront, this._faces.leafBack);
      leaf.visible = false;

      this._boards[0].visible = false;
      this._stacks[0].visible = false;
    }

    _pageMesh(sign, mirrored, seg) {
      var geo = new THREE.PlaneGeometry(PW, PH, seg || 1, 1);
      if (mirrored) {
        var uv = geo.attributes.uv;
        for (var i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
      }
      geo.rotateX(-Math.PI / 2);
      geo.translate(sign * PW / 2, 0, 0);
      var mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.93, metalness: 0.0,
        side: mirrored ? THREE.BackSide : THREE.FrontSide
      });
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = false; m.receiveShadow = true;
      m._base = geo.attributes.position.array.slice(0);
      // column index per vertex, so the bend solver can address the page by
      // its position along the spine-to-edge axis.
      var n = seg || 1, cols = new Uint8Array(m._base.length / 3);
      for (var v = 0; v < cols.length; v++) {
        cols[v] = Math.round(Math.abs(m._base[v * 3]) / PW * n);
      }
      m._cols = cols; m._segs = n;
      return m;
    }

    _buildCandles(scene) {
      this._candles = [];
      var brass = new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.35, metalness: 0.9 });
      var wax = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.6, emissive: 0x4a3410, emissiveIntensity: 0.5 });
      var self = this;
      [-1.12, 1.12].forEach(function (x) {
        var g = new THREE.Group();
        var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.06, 12), brass);
        foot.position.y = 0.03; foot.castShadow = true; g.add(foot);
        var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.86, 10), brass);
        stem.position.y = 0.49; stem.castShadow = true; g.add(stem);
        var knop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), brass);
        knop.position.y = 0.55; g.add(knop);
        var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.05, 12), brass);
        cup.position.y = 0.945; g.add(cup);
        var candle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.34, 12), wax);
        candle.position.y = 1.13; candle.castShadow = true; g.add(candle);

        var flame = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe6a8 }));
        flame.position.y = 1.325; flame.scale.set(1, 1.9, 1); g.add(flame);

        var halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(glowSprite("rgba(255,236,190,0.95)")),
          blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
        }));
        halo.scale.set(0.46, 0.46, 1); halo.position.y = 1.33; g.add(halo);

        var pl = new THREE.PointLight(0xffbe72, 1.5, 4.2, 2);
        pl.position.set(0, 1.33, 0); g.add(pl);

        g.position.set(x, 0, 0.34);
        scene.add(g);
        self._candles.push({ group: g, light: pl, halo: halo, flame: flame, phase: Math.random() * 9 });
      });
    }

    _buildDust(scene) {
      var n = 420, pos = new Float32Array(n * 3);
      this._dustSeed = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 5.4;
        pos[i * 3 + 1] = Math.random() * 3.4 + 0.15;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
        this._dustSeed[i * 3] = Math.random() * 9;
        this._dustSeed[i * 3 + 1] = 0.006 + Math.random() * 0.016;
        this._dustSeed[i * 3 + 2] = Math.random() * 9;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      var spr = new THREE.CanvasTexture(glowSprite("rgba(255,238,200,0.9)"));
      var mat = new THREE.PointsMaterial({
        size: 0.02, map: spr, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      this._dust = new THREE.Points(geo, mat);
      scene.add(this._dust);
    }

    /* ---- pages ---- */

    setPages(pages) {
      this._pages = pages || [];
      this._cache.forEach(function (v) { v.tex.dispose(); });
      this._cache.clear();
      this._spread = -1;
      this._flip = null;
      if (this._leaf) this._leaf.visible = false;
      this._refreshFaces();
      this._setPose("closed");
      this._applyProg(true);
    }

    setAccent(hex) {
      this._accent = hex || "#6d4a9c";
      if (this._clothMap) {
        var c = clothTex(this._accent);
        this._clothMap.image = c; this._clothMap.needsUpdate = true;
      }
      if (this._lights) this._lights.tint.color = new THREE.Color(this._accent);
    }

    setMood(name) {
      if (!MOODS[name] || !this._lights) { this._mood = name; return; }
      this._mood = name;
      var m = MOODS[name];
      this._lights.amb.color = new THREE.Color(m.amb); this._lights.amb.intensity = m.ambI;
      this._lights.key.color = new THREE.Color(m.key); this._lights.key.intensity = m.keyI;
      this._lights.fill.color = new THREE.Color(m.fill); this._lights.fill.intensity = m.fillI;
      this._lights.tint.intensity = m.tint;
      this._candles.forEach(function (c) { c.light.intensity = m.candle; });
      this._renderer.setClearColor(m.bg, 1);
      this._scene.fog.color = new THREE.Color(m.bg);
    }

    get spread() { return this._spread; }
    get spreadCount() { return Math.max(1, Math.ceil(this._pages.length / 2)); }

    _descriptor(i) {
      if (i === -2) return { kind: "cover" };
      if (i === -1) return { kind: "flyleaf" };
      return this._pages[i] || null;
    }

    _texture(i) {
      if (i === null || i === undefined) return null;
      if (!this._fontsReady) return null;
      var key = String(i);
      if (this._cache.has(key)) { var hit = this._cache.get(key); this._cache.delete(key); this._cache.set(key, hit); return hit.tex; }
      var tex = new THREE.CanvasTexture(drawPage(this._descriptor(i)));
      if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = this._renderer ? this._renderer.capabilities.getMaxAnisotropy() : 1;
      this._cache.set(key, { tex: tex });
      if (this._cache.size > 16) {
        var it = this._cache.keys();
        while (this._cache.size > 16) {
          var k = it.next().value;
          if (k === key) continue;
          var v = this._cache.get(k); v.tex.dispose(); this._cache.delete(k);
        }
      }
      return tex;
    }

    // Which page indices a spread shows. -1 = closed (cover facing up).
    // Page 2s sits on the left, 2s+1 on the right, so a Sunday's title page
    // always lands on the left and the reader never opens onto the tail of
    // the previous week.
    _spreadPages(s) {
      if (s < 0) return { left: null, right: -2 };
      return { left: 2 * s, right: 2 * s + 1 };
    }

    _setFace(name, index) {
      var mesh = this._faces[name];
      if (index === null || index === undefined) { mesh.visible = false; return; }
      var tex = this._texture(index);
      mesh.visible = !!tex;
      mesh.material.map = tex;
      mesh.material.needsUpdate = true;
    }

    _refreshFaces() {
      var p = this._spreadPages(this._spread);
      this._setFace("left", p.left);
      this._setFace("right", p.right);
      this._boards[0].visible = p.left !== null;
      this._stacks[0].visible = p.left !== null;
    }

    _progOf(spread) {
      return spread < 0 ? 0 : Math.min(1, (spread + 1) / (this.spreadCount + 1));
    }

    // Stack thickness is a continuous value eased in the render loop, so
    // leafing through never snaps the block from one height to another.
    _applyProg(instant) {
      var target = this._progOf(this._spread);
      if (instant || this._prog == null) this._prog = target;
      this._layout(this._prog);
      return target;
    }

    _layout(prog) {
      var lh = 0.004 + BLOCK * prog, rh = 0.004 + BLOCK * (1 - prog);
      this._stacks[0].scale.y = lh; this._stacks[0].position.y = 0.018 + lh / 2;
      this._stacks[1].scale.y = rh; this._stacks[1].position.y = 0.018 + rh / 2;
      this._faces.left.position.y = 0.018 + lh + 0.0012;
      this._faces.right.position.y = 0.018 + rh + 0.0012;
      this._leaf.position.y = 0.018 + Math.max(lh, rh) + 0.0022;
    }

    /* ---- navigation ---- */

    goTo(target, instant) {
      if (!this._pages.length && target >= 0) return;
      var max = this.spreadCount - 1;
      target = Math.max(-1, Math.min(max, target));
      if (target === this._spread) return;
      if (this._flip) this._endFlip();
      if (instant) {
        this._spread = target; this._refreshFaces(); this._applyProg(true);
        this._setPose(target < 0 ? "closed" : "open");
        this._emit();
        return;
      }
      this._beginFlip(this._spread, target);
    }

    turn(dir) {
      if (this._flip) return false;
      var t = this._spread + (dir > 0 ? 1 : -1);
      if (t > this.spreadCount - 1) return false;
      if (t < -1) return false;
      this.goTo(t);
      return true;
    }

    close() { this.goTo(-1); }

    _beginFlip(from, to) {
      var dir = to > from ? 1 : -1;
      var a = this._spreadPages(from), b = this._spreadPages(to);
      var leafFront = dir > 0 ? a.right : b.right;
      var leafBack = dir > 0 ? b.left : a.left;
      this._setFace("leafFront", leafFront);
      this._setFace("leafBack", leafBack);
      this._setFace("left", dir > 0 ? a.left : b.left);
      this._setFace("right", dir > 0 ? b.right : a.right);
      this._boards[0].visible = (dir > 0 ? a.left : b.left) !== null || to >= 0;
      this._stacks[0].visible = this._boards[0].visible;

      this._spread = to;
      this._leaf.visible = true;
      this._leaf.rotation.z = 0;
      this._flip = {
        dir: dir, t: 0, start: performance.now(),
        p0: this._progOf(from), p1: this._progOf(to)
      };
      this._bendLeaf(dir > 0 ? 0 : Math.PI, 0);
      this._setPose(to < 0 ? "closed" : "open");
      this._emit();
    }

    _emit() {
      this.dispatchEvent(new CustomEvent("spread-change", {
        bubbles: true, composed: true,
        detail: { spread: this._spread, day: this._spread < 0 ? -1 : Math.floor(this._spread / 2) }
      }));
    }

    _stepFlip(now) {
      var f = this._flip;
      if (!f) return;
      var t = Math.min(1, (now - f.start) / FLIP_MS), e = ease(t);
      var ang = f.dir > 0 ? e * Math.PI : (1 - e) * Math.PI;
      // Curl peaks mid-turn and vanishes at both ends, so the leaf leaves and
      // meets the block flat instead of arriving as a stiff board. The clamp
      // keeps the far edge from bending past flat, which would sink the page
      // through the block it is landing on.
      var amp = Math.min(Math.sin(t * Math.PI) * 1.12, (Math.PI - ang) * 0.88, ang * 0.95 + 0.62);
      this._bendLeaf(ang, amp);

      // Block thickness is driven straight off the turn, and the leaf's pivot
      // travels from the stack it lifts off to the stack it settles onto — the
      // two can differ by most of the block, so riding either one alone drops
      // the page onto a lower surface the moment the leaf is swapped out.
      this._prog = f.p0 + (f.p1 - f.p0) * e;
      this._layout(this._prog);
      var lh = 0.004 + BLOCK * this._prog, rh = 0.004 + BLOCK * (1 - this._prog);
      var depart = f.dir > 0 ? rh : lh, arrive = f.dir > 0 ? lh : rh;
      this._leaf.position.y = 0.018 + depart + (arrive - depart) * e + 0.0014;

      if (t >= 1) this._endFlip();
    }

    // Bends the leaf as inextensible paper: the sheet is clamped at the spine
    // and its tangent angle varies along its length, integrated so arc length
    // (and therefore the page's size) is preserved at every frame.
    _bendLeaf(ang, amp) {
      var n = LEAF_SEG, ds = PW / n;
      if (!this._bx) { this._bx = new Float32Array(n + 1); this._by = new Float32Array(n + 1); }
      var xs = this._bx, ys = this._by;
      xs[0] = 0; ys[0] = 0;
      for (var i = 1; i <= n; i++) {
        var phi = ang + amp * Math.sin(Math.PI * (i - 0.5) / n);
        xs[i] = xs[i - 1] + ds * Math.cos(phi);
        ys[i] = ys[i - 1] + ds * Math.sin(phi);
      }
      var faces = [this._faces.leafFront, this._faces.leafBack];
      for (var k = 0; k < 2; k++) {
        var m = faces[k], p = m.geometry.attributes.position, cols = m._cols;
        for (var v = 0; v < p.count; v++) {
          var c = cols[v];
          p.setX(v, xs[c]); p.setY(v, ys[c]);
        }
        p.needsUpdate = true;
        m.geometry.computeVertexNormals();
      }
    }

    _endFlip() {
      this._flip = null;
      this._refreshFaces();
      this._leaf.visible = false;
      this._prewarm();
    }

    // Draw the neighbouring spreads while idle so a turn never has to
    // rasterise a page mid-animation.
    _prewarm() {
      var self = this;
      if (this._warmId) clearTimeout(this._warmId);
      this._warmId = setTimeout(function () {
        if (self._dead || self._flip || !self._fontsReady) return;
        [self._spread + 1, self._spread - 1].forEach(function (s) {
          if (s < -1 || s > self.spreadCount - 1) return;
          var p = self._spreadPages(s);
          self._texture(p.left); self._texture(p.right);
        });
      }, 260);
    }

    /* ---- camera ---- */

    _setPose(kind, instant) {
      var open = kind === "open";
      var pos = open ? new THREE.Vector3(0, 2.72, 1.28) : new THREE.Vector3(0, 2.58, 2.95);
      var tgt = open ? new THREE.Vector3(0, 1.37, 0.03) : new THREE.Vector3(0, 1.22, 0);
      if (instant) {
        this._camPose.pos.copy(pos); this._camPose.tgt.copy(tgt); this._camT = 1;
      } else {
        if (this._camTo.pos.distanceTo(pos) < 0.001 && this._camT >= 1) return;
        this._camFrom.pos.copy(this._camPose.pos); this._camFrom.tgt.copy(this._camPose.tgt);
        this._camT = 0;
      }
      this._camTo.pos.copy(pos); this._camTo.tgt.copy(tgt);
    }

    _onClick(e) {
      if (!this._pages.length) return;
      var r = this._renderer.domElement.getBoundingClientRect();
      var nd = new THREE.Vector2(
        (e.clientX - r.left) / r.width * 2 - 1,
        -((e.clientY - r.top) / r.height * 2 - 1)
      );
      this._ray.setFromCamera(nd, this._camera);
      var targets = [this._faces.left, this._faces.right, this._boards[1], this._stacks[1]];
      if (this._boards[0].visible) targets.push(this._boards[0], this._stacks[0]);
      var hits = this._ray.intersectObjects(targets, false);
      if (!hits.length) return;
      var local = this._book.worldToLocal(hits[0].point.clone());
      this.turn(local.x >= 0 ? 1 : -1);
    }

    _resize() {
      var w = this.clientWidth, h = this.clientHeight;
      if (!w || !h || !this._renderer) return;
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(w, h);
    }

    _loop() {
      if (this._dead) return;
      requestAnimationFrame(this._loop.bind(this));
      var now = performance.now(), t = this._clock.getElapsedTime();

      if (this._flip) {
        // If rAF was throttled (hidden tab, heavy frame) the turn would hang
        // mid-air; snap it home instead of leaving the leaf stranded.
        if (now - this._flip.start > FLIP_MS * 2.5) this._endFlip();
        else this._stepFlip(now);
      }

      if (this._camT < 1) {
        this._camT = Math.min(1, this._camT + 1 / 78);
        var e = ease(this._camT);
        this._camPose.pos.lerpVectors(this._camFrom.pos, this._camTo.pos, e);
        this._camPose.tgt.lerpVectors(this._camFrom.tgt, this._camTo.tgt, e);
      }
      var bx = this._spread < 0 ? -PW / 2 : 0;
      this._book.position.x += (bx - this._book.position.x) * 0.08;

      var pt = this._progOf(this._spread);
      if (this._prog == null) this._prog = pt;
      if (!this._flip && Math.abs(pt - this._prog) > 0.0002) {
        this._prog += (pt - this._prog) * 0.075;
        this._layout(this._prog);
      }

      // base pose in spherical terms, then the user's orbit on top of it
      var o = this._orb, ot = this._orbT;
      var dth = ot.theta - o.theta;
      if (dth > Math.PI) dth -= 2 * Math.PI;
      if (dth < -Math.PI) dth += 2 * Math.PI;
      o.theta += dth * 0.12;
      o.phi += (ot.phi - o.phi) * 0.12;
      o.zoom += (ot.zoom - o.zoom) * 0.12;

      var base = this._camPose;
      var vx = base.pos.x - base.tgt.x, vy = base.pos.y - base.tgt.y, vz = base.pos.z - base.tgt.z;
      var rad = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      var theta = Math.atan2(vx, vz) + o.theta;
      var phi = Math.acos(Math.max(-1, Math.min(1, vy / rad))) + o.phi;
      phi = Math.max(0.34, Math.min(1.62, phi));
      rad = Math.max(0.58, Math.min(7, rad * o.zoom)) + Math.cos(t * 0.31) * 0.012;
      var sp = Math.sin(phi);
      this._camera.position.set(
        base.tgt.x + rad * sp * Math.sin(theta),
        base.tgt.y + rad * Math.cos(phi),
        base.tgt.z + rad * sp * Math.cos(theta)
      );
      this._camera.lookAt(base.tgt);

      this._candles.forEach(function (c) {
        var f = 0.78 + Math.sin(t * 9.3 + c.phase) * 0.11 + Math.sin(t * 21.7 + c.phase * 2) * 0.07;
        c.light.intensity = (MOODS[this._mood] || MOODS.Candlelight).candle * f;
        c.halo.scale.set(0.44 * (0.9 + f * 0.16), 0.44 * (0.9 + f * 0.16), 1);
        c.flame.scale.set(1, 1.75 + f * 0.35, 1);
      }, this);

      var p = this._dust.geometry.attributes.position, s = this._dustSeed;
      for (var i = 0; i < p.count; i++) {
        var y = p.getY(i) + s[i * 3 + 1] * 0.012;
        if (y > 3.7) y = 0.1;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.4 + s[i * 3]) * 0.0009);
      }
      p.needsUpdate = true;

      this._renderer.render(this._scene, this._camera);
    }
  }

  customElements.define("sanctuary-stage", SanctuaryStage);
})();
