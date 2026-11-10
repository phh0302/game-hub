/* Neon Snake cho Game Hub – dùng Game Hub SDK v1 (gameStart / gameOver) */
(function () {
  "use strict";

  var N = 20; // lưới 20 x 20
  var FOOD_POINTS = 10;
  var BEST_KEY = "gh-snake-best";

  var TEXT = {
    vi: {
      score: "Điểm",
      best: "Cao nhất",
      startTitle: "Rắn săn mồi",
      startText: "Nhấn phím mũi tên / WASD hoặc vuốt để bắt đầu.",
      play: "Chơi",
      pausedTitle: "Tạm dừng",
      pausedText: "Nhấn phím bất kỳ hoặc chạm để chơi tiếp.",
      overTitle: "Rắn đã va chạm!",
      overText: function (s) {
        return "Bạn đạt " + s.toLocaleString("vi-VN") + " điểm.";
      },
      again: "Chơi lại",
      saveNote: "Kết nối ví trên Game Hub để lưu điểm và lên bảng xếp hạng.",
    },
    en: {
      score: "Score",
      best: "Best",
      startTitle: "Neon Snake",
      startText: "Press arrow keys / WASD or swipe to start.",
      play: "Play",
      pausedTitle: "Paused",
      pausedText: "Press any key or tap to continue.",
      overTitle: "Crashed!",
      overText: function (s) {
        return "You scored " + s.toLocaleString("en-US") + " points.";
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

  // phase: ready (chờ thao tác đầu tiên) · playing · paused · over
  var s = { phase: "ready", snake: [], dir: { x: 1, y: 0 }, queue: [], food: null, score: 0, best: 0, tickMs: 140, acc: 0, last: 0, eaten: 0 };

  function reset() {
    var mid = Math.floor(N / 2);
    s.phase = "ready";
    s.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    s.dir = { x: 1, y: 0 };
    s.queue = [];
    s.score = 0;
    s.eaten = 0;
    s.tickMs = 140;
    s.acc = 0;
    placeFood();
    updateScore();
    draw(0);
  }

  function placeFood() {
    var free = [];
    for (var y = 0; y < N; y++)
      for (var x = 0; x < N; x++) {
        if (!s.snake.some(function (p) { return p.x === x && p.y === y; })) free.push({ x: x, y: y });
      }
    s.food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function updateScore() {
    els.score.textContent = s.score.toLocaleString();
    els.best.textContent = s.best.toLocaleString();
  }

  // ───── Vòng lặp ─────
  function step() {
    if (s.queue.length) {
      var next = s.queue.shift();
      // Không cho quay đầu 180°
      if (next.x !== -s.dir.x || next.y !== -s.dir.y) s.dir = next;
    }
    var head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    var willEat = s.food && head.x === s.food.x && head.y === s.food.y;
    var body = willEat ? s.snake : s.snake.slice(0, -1); // đuôi sẽ dời đi nếu không ăn
    var hitWall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
    var hitSelf = body.some(function (p) { return p.x === head.x && p.y === head.y; });
    if (hitWall || hitSelf) return gameOver();

    s.snake.unshift(head);
    if (willEat) {
      s.score += FOOD_POINTS;
      s.eaten += 1;
      s.tickMs = Math.max(70, 140 - s.eaten * 3); // nhanh dần
      if (s.score > s.best) {
        s.best = s.score;
        storageSet(BEST_KEY, String(s.best));
      }
      updateScore();
      placeFood();
      if (!s.food) return gameOver(); // lấp kín bàn
    } else {
      s.snake.pop();
    }
  }

  function loop(now) {
    if (s.phase !== "playing") return;
    var dt = Math.min(250, now - (s.last || now));
    s.last = now;
    s.acc += dt;
    while (s.acc >= s.tickMs && s.phase === "playing") {
      s.acc -= s.tickMs;
      step();
    }
    draw(now);
    if (s.phase === "playing") requestAnimationFrame(loop);
  }

  function begin() {
    if (s.phase === "over") reset();
    if (s.phase !== "ready" && s.phase !== "over") return;
    s.phase = "playing";
    hideOverlay();
    hideResult();
    if (hub) hub.gameStart();
    s.last = 0;
    requestAnimationFrame(loop);
  }

  function pause() {
    if (s.phase !== "playing") return;
    s.phase = "paused";
    showOverlay(t.pausedTitle, t.pausedText, null);
  }

  function resume() {
    if (s.phase !== "paused") return;
    s.phase = "playing";
    hideOverlay();
    s.last = 0;
    requestAnimationFrame(loop);
  }

  function gameOver() {
    s.phase = "over";
    draw(performance.now());
    showOverlay(t.overTitle, t.overText(s.score), t.again);
    if (hub) hub.gameOver(s.score);
  }

  // ───── Vẽ ─────
  function draw(now) {
    var size = canvas.width;
    var c = size / N;
    ctx.fillStyle = "#0b0b18";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(42,42,69,0.55)";
    ctx.lineWidth = 1;
    for (var i = 1; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(i * c + 0.5, 0);
      ctx.lineTo(i * c + 0.5, size);
      ctx.moveTo(0, i * c + 0.5);
      ctx.lineTo(size, i * c + 0.5);
      ctx.stroke();
    }
    if (s.food) {
      var pulse = 0.75 + 0.25 * Math.sin((now || 0) / 180);
      ctx.shadowColor = "#ff3ec8";
      ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = "#ff3ec8";
      ctx.beginPath();
      ctx.arc((s.food.x + 0.5) * c, (s.food.y + 0.5) * c, c * 0.32 * pulse + c * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = "#22e3ff";
    ctx.shadowBlur = 10;
    for (var k = s.snake.length - 1; k >= 0; k--) {
      var p = s.snake[k];
      var ratio = 1 - k / Math.max(s.snake.length, 1);
      ctx.fillStyle = k === 0 ? "#b6ff3b" : "rgba(34,227," + Math.round(160 + 95 * ratio) + "," + (0.55 + 0.45 * ratio) + ")";
      var pad = k === 0 ? 1 : 2;
      roundRect(p.x * c + pad, p.y * c + pad, c - pad * 2, c - pad * 2, c * 0.25);
    }
    ctx.shadowBlur = 0;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }

  // Canvas sắc nét trên màn hình độ phân giải cao
  function resize() {
    var cssSize = Math.floor(els.stage.clientWidth);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.floor((cssSize * dpr) / N) * N;
    canvas.width = px;
    canvas.height = px;
    draw(performance.now());
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
    if (s.phase === "paused") showOverlay(t.pausedTitle, t.pausedText, null);
  }
  function applyHubData(data) {
    applyText(data.locale);
    els.saveNote.classList.toggle("hidden", data.standalone || data.canSubmitScore);
  }

  // ───── Điều khiển ─────
  var DIRS = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
  };

  function turn(dir) {
    if (s.phase === "paused") return resume();
    var lastDir = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (dir.x === lastDir.x && dir.y === lastDir.y) return;
    if (s.phase === "playing" && s.queue.length < 3) s.queue.push(dir);
    if (s.phase === "ready" || s.phase === "over") {
      if (s.phase === "over") reset();
      // Hướng đầu tiên không được ngược thân rắn
      if (!(dir.x === -s.dir.x && dir.y === -s.dir.y)) s.dir = dir;
      begin();
    }
  }

  document.addEventListener("keydown", function (e) {
    var dir = DIRS[e.key] || DIRS[e.key && e.key.toLowerCase()];
    if (dir) {
      e.preventDefault();
      turn(dir);
    } else if (e.key === " " || e.key === "Escape" || e.key === "p") {
      e.preventDefault();
      if (s.phase === "playing") pause();
      else if (s.phase === "paused") resume();
    }
  });

  var start = null;
  els.stage.addEventListener("pointerdown", function (e) {
    start = { x: e.clientX, y: e.clientY };
    window.focus();
  });
  els.stage.addEventListener("pointerup", function (e) {
    if (!start) return;
    var dx = e.clientX - start.x;
    var dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
      if (s.phase === "paused") resume();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? DIRS.ArrowRight : DIRS.ArrowLeft);
    else turn(dy > 0 ? DIRS.ArrowDown : DIRS.ArrowUp);
  });
  els.stage.addEventListener("touchmove", function (e) {
    e.preventDefault(); // không cuộn trang khi vuốt
  }, { passive: false });

  els.play.addEventListener("click", function (e) {
    e.stopPropagation();
    if (s.phase === "paused") resume();
    else begin();
  });
  els.play.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
  });
  els.play.addEventListener("pointerup", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause();
  });

  // ───── Khởi động ─────
  s.best = Number(storageGet(BEST_KEY)) || 0;
  window.addEventListener("resize", resize);
  reset();
  resize();

  if (hub) {
    hub.init().then(applyHubData);
    hub.on("init", applyHubData);
    hub.on("scoreResult", showResult);
    hub.on("pause", pause);
  }
})();
