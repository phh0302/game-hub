/* Neon Flap cho Game Hub – dùng Game Hub SDK v1 (gameStart / gameOver) */
(function () {
  "use strict";

  // Kích thước logic (vẽ được scale theo màn hình)
  var W = 360;
  var H = 540;
  var GROUND = 40;
  var GRAVITY = 1500;
  var FLAP = -430;
  var MAX_FALL = 720;
  var SPEED = 150;
  var PIPE_W = 62;
  var SPACING = 215;
  var BIRD_X = 96;
  var BIRD_R = 13;
  var STEP = 1 / 120; // bước vật lý cố định → chạy giống nhau trên mọi máy
  var BEST_KEY = "gh-flap-best";

  var TEXT = {
    vi: {
      score: "Điểm",
      best: "Cao nhất",
      startTitle: "Neon Flap",
      startText: "Nhấn Space, phím ↑ hoặc chạm để bay lên. Né các cột!",
      play: "Chơi",
      overTitle: "Rơi rồi!",
      overText: function (n) {
        return "Bạn vượt qua " + n.toLocaleString("vi-VN") + " cột.";
      },
      again: "Chơi lại",
      saveNote: "Kết nối ví trên Game Hub để lưu điểm và lên bảng xếp hạng.",
    },
    en: {
      score: "Score",
      best: "Best",
      startTitle: "Neon Flap",
      startText: "Press Space, ↑ or tap to fly. Dodge the pillars!",
      play: "Play",
      overTitle: "Down you go!",
      overText: function (n) {
        return "You passed " + n.toLocaleString("en-US") + " pillars.";
      },
      again: "Play again",
      saveNote: "Connect your wallet on Game Hub to save scores and join the leaderboard.",
    },
  };
  var t = TEXT.vi;
  var hub = window.GameHub;

  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");
  var els = {
    stage: document.getElementById("stage"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    overlay: document.getElementById("overlay"),
    title: document.getElementById("overlay-title"),
    text: document.getElementById("overlay-text"),
    play: document.getElementById("play"),
    result: document.getElementById("result"),
    saveNote: document.getElementById("save-note"),
  };

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* iframe sandbox có thể chặn localStorage */
    }
  }

  // phase: ready · playing · dying (đang rơi sau va chạm) · over
  var s = { phase: "ready", y: H / 2, vy: 0, pipes: [], score: 0, best: 0, acc: 0, last: 0, groundX: 0, overAt: 0 };

  function reset() {
    s.phase = "ready";
    s.y = H / 2 - 40;
    s.vy = 0;
    s.pipes = [];
    s.score = 0;
    s.acc = 0;
    spawnPipe(W + 60);
    spawnPipe(W + 60 + SPACING);
    spawnPipe(W + 60 + SPACING * 2);
    updateScore();
  }

  function gapSize() {
    // Khe hẹp dần theo điểm: 150 → 118
    return Math.max(118, 150 - s.score * 1.2);
  }

  function spawnPipe(x) {
    var gap = gapSize();
    var margin = 50;
    var top = margin + Math.random() * (H - GROUND - gap - margin * 2);
    s.pipes.push({ x: x, top: top, gap: gap, passed: false });
  }

  function updateScore() {
    els.score.textContent = s.score.toLocaleString();
    els.best.textContent = s.best.toLocaleString();
  }

  function flap() {
    if (s.phase === "over") {
      // Chờ 0,4 giây sau khi thua để không bấm nhầm sang ván mới
      if (performance.now() - s.overAt < 400) return;
      reset();
    }
    if (s.phase === "ready") {
      s.phase = "playing";
      hideOverlay();
      hideResult();
      if (hub) hub.gameStart();
    }
    if (s.phase === "playing") s.vy = FLAP;
  }

  function physics(dt) {
    if (s.phase === "ready") {
      s.y = H / 2 - 40 + Math.sin(performance.now() / 300) * 8;
      s.groundX = (s.groundX - SPEED * dt) % 24;
      return;
    }
    s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * dt);
    s.y += s.vy * dt;

    if (s.phase === "playing") {
      s.groundX = (s.groundX - SPEED * dt) % 24;
      for (var i = 0; i < s.pipes.length; i++) {
        var p = s.pipes[i];
        p.x -= SPEED * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.passed = true;
          s.score += 1;
          if (s.score > s.best) {
            s.best = s.score;
            storageSet(BEST_KEY, String(s.best));
          }
          updateScore();
        }
        if (collides(p)) return crash();
      }
      if (s.pipes.length && s.pipes[0].x < -PIPE_W) {
        s.pipes.shift();
        spawnPipe(s.pipes[s.pipes.length - 1].x + SPACING);
      }
      if (s.y - BIRD_R < 0) {
        s.y = BIRD_R;
        s.vy = 0;
      }
    }

    if (s.y + BIRD_R >= H - GROUND) {
      s.y = H - GROUND - BIRD_R;
      if (s.phase === "playing") crash();
      if (s.phase === "dying") finish();
    }
  }

  function collides(p) {
    if (BIRD_X + BIRD_R <= p.x || BIRD_X - BIRD_R >= p.x + PIPE_W) return false;
    // Hình tròn so với 2 hình chữ nhật (cột trên + cột dưới)
    return circleRect(p.x, 0, PIPE_W, p.top) || circleRect(p.x, p.top + p.gap, PIPE_W, H - GROUND - p.top - p.gap);
  }

  function circleRect(rx, ry, rw, rh) {
    var cx = Math.max(rx, Math.min(BIRD_X, rx + rw));
    var cy = Math.max(ry, Math.min(s.y, ry + rh));
    var dx = BIRD_X - cx;
    var dy = s.y - cy;
    return dx * dx + dy * dy < (BIRD_R - 2) * (BIRD_R - 2); // trừ hao 2px cho dễ chịu
  }

  function crash() {
    s.phase = "dying";
    s.vy = Math.max(s.vy, 120);
  }

  function finish() {
    s.phase = "over";
    s.overAt = performance.now();
    showOverlay(t.overTitle, t.overText(s.score), t.again);
    if (hub) hub.gameOver(s.score);
  }

  function loop(now) {
    var dt = Math.min(0.1, (now - (s.last || now)) / 1000);
    s.last = now;
    if (!paused) {
      s.acc += dt;
      while (s.acc >= STEP) {
        s.acc -= STEP;
        physics(STEP);
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ───── Vẽ ─────
  function draw() {
    var k = canvas.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b0b1c");
    sky.addColorStop(1, "#160d2a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sao lấp lánh nền (cố định theo vị trí)
    ctx.fillStyle = "rgba(236,235,255,0.35)";
    for (var i = 0; i < 28; i++) {
      var sx = (i * 97 + 13) % W;
      var sy = (i * 53 + 29) % (H - GROUND - 40);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Cột
    for (var j = 0; j < s.pipes.length; j++) {
      var p = s.pipes[j];
      pillar(p.x, 0, PIPE_W, p.top, "#22e3ff");
      pillar(p.x, p.top + p.gap, PIPE_W, H - GROUND - p.top - p.gap, "#ff3ec8");
    }

    // Mặt đất
    ctx.fillStyle = "#11111f";
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = "#2a2a45";
    for (var gx = s.groundX; gx < W; gx += 24) ctx.fillRect(gx, H - GROUND + 8, 12, 3);
    ctx.fillStyle = "#b6ff3b";
    ctx.fillRect(0, H - GROUND, W, 2);

    // Chim
    var angle = Math.max(-0.5, Math.min(1.2, s.vy / 600));
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(angle);
    ctx.shadowColor = "#b6ff3b";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#b6ff3b";
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#07070f";
    ctx.beginPath();
    ctx.arc(5, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff3ec8";
    ctx.beginPath();
    ctx.moveTo(BIRD_R - 2, 1);
    ctx.lineTo(BIRD_R + 7, 4);
    ctx.lineTo(BIRD_R - 2, 7);
    ctx.fill();
    ctx.restore();

    // Điểm giữa màn khi đang chơi
    if (s.phase === "playing" || s.phase === "dying") {
      ctx.fillStyle = "rgba(236,235,255,0.9)";
      ctx.font = "800 44px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2, 72);
    }
  }

  function pillar(x, y, w, h, color) {
    if (h <= 0) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(17,17,31,0.95)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(els.stage.clientWidth * dpr);
    canvas.height = Math.round((canvas.width * H) / W);
  }

  // ───── Tạm dừng khi hub yêu cầu / chuyển tab ─────
  var paused = false;
  function pause() {
    if (s.phase === "playing") paused = true;
  }
  function resume() {
    paused = false;
  }

  // ───── Overlay / kết quả ─────
  function showOverlay(title, text, button) {
    els.title.textContent = title;
    els.text.textContent = text;
    els.play.classList.toggle("hidden", !button);
    if (button) els.play.textContent = button;
    els.overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    els.overlay.classList.add("hidden");
  }
  function showResult(data) {
    if (!data || !data.message) return;
    els.result.textContent = data.message;
    els.result.classList.remove("hidden", "ok", "err");
    els.result.classList.add(data.saved ? "ok" : "err");
  }
  function hideResult() {
    els.result.classList.add("hidden");
  }

  function applyText(locale) {
    t = TEXT[locale] || TEXT.en;
    document.documentElement.lang = locale === "vi" ? "vi" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (typeof t[key] === "string") el.textContent = t[key];
    });
    if (s.phase === "over") showOverlay(t.overTitle, t.overText(s.score), t.again);
  }
  function applyHubData(data) {
    applyText(data.locale);
    els.saveNote.classList.toggle("hidden", data.standalone || data.canSubmitScore);
  }

  // ───── Điều khiển ─────
  function input(e) {
    if (e) e.preventDefault();
    if (paused) return resume();
    flap();
  }

  document.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "Enter") input(e);
  });
  els.stage.addEventListener("pointerdown", function (e) {
    window.focus();
    input(e);
  });
  els.stage.addEventListener("touchmove", function (e) {
    e.preventDefault();
  }, { passive: false });
  els.play.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
    input(e);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause();
  });

  // ───── Khởi động ─────
  s.best = Number(storageGet(BEST_KEY)) || 0;
  window.addEventListener("resize", resize);
  reset();
  resize();
  requestAnimationFrame(loop);

  if (hub) {
    hub.init().then(applyHubData);
    hub.on("init", applyHubData);
    hub.on("scoreResult", showResult);
    hub.on("pause", pause);
    hub.on("resume", resume);
  }
})();
