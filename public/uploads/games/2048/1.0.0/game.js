/* 2048 cho Game Hub – dùng Game Hub SDK v1 (gameStart / gameOver) */
(function () {
  "use strict";

  var SIZE = 4;
  var BEST_KEY = "gh-2048-best";

  var TEXT = {
    vi: {
      score: "Điểm",
      best: "Cao nhất",
      hint: "Dùng phím mũi tên hoặc vuốt để ghép ô.",
      newGame: "Ván mới",
      keepGoing: "Chơi tiếp",
      tryAgain: "Chơi lại",
      saveNote: "Kết nối ví trên Game Hub để lưu điểm và lên bảng xếp hạng.",
      winTitle: "Bạn đã đạt 2048!",
      winText: "Chơi tiếp để phá kỷ lục, hoặc bắt đầu ván mới.",
      overTitle: "Hết nước đi",
      overText: function (s) {
        return "Bạn đạt " + s.toLocaleString("vi-VN") + " điểm.";
      },
    },
    en: {
      score: "Score",
      best: "Best",
      hint: "Use arrow keys or swipe to merge tiles.",
      newGame: "New game",
      keepGoing: "Keep going",
      tryAgain: "Try again",
      saveNote: "Connect your wallet on Game Hub to save scores and join the leaderboard.",
      winTitle: "You reached 2048!",
      winText: "Keep going to beat your record, or start a new game.",
      overTitle: "Game over",
      overText: function (s) {
        return "You scored " + s.toLocaleString("en-US") + " points.";
      },
    },
  };

  var t = TEXT.vi;
  var hub = window.GameHub;

  var els = {
    grid: document.getElementById("grid"),
    board: document.getElementById("board"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayText: document.getElementById("overlay-text"),
    keepGoing: document.getElementById("keep-going"),
    tryAgain: document.getElementById("try-again"),
    newGame: document.getElementById("new-game"),
    saveNote: document.getElementById("save-note"),
    result: document.getElementById("result"),
  };

  var state = {
    grid: [],
    score: 0,
    best: 0,
    won: false,
    keepPlaying: false,
    over: false,
    roundStarted: false,
    fresh: {},
    merged: {},
  };

  // Game chạy trong iframe sandbox → localStorage có thể bị chặn
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
      /* bỏ qua */
    }
  }

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) g.push([0, 0, 0, 0]);
    return g;
  }

  function emptyCells() {
    var cells = [];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++) if (!state.grid[r][c]) cells.push([r, c]);
    return cells;
  }

  function addRandomTile() {
    var cells = emptyCells();
    if (!cells.length) return;
    var pick = cells[Math.floor(Math.random() * cells.length)];
    state.grid[pick[0]][pick[1]] = Math.random() < 0.9 ? 2 : 4;
    state.fresh[pick[0] * SIZE + pick[1]] = true;
  }

  function hasTile(value) {
    for (var r = 0; r < SIZE; r++) for (var c = 0; c < SIZE; c++) if (state.grid[r][c] >= value) return true;
    return false;
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = state.grid[r][c];
        if (c + 1 < SIZE && state.grid[r][c + 1] === v) return true;
        if (r + 1 < SIZE && state.grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  /** Vị trí các ô của hàng/cột thứ k, theo thứ tự hướng trượt */
  function line(dir, k) {
    var pos = [];
    for (var i = 0; i < SIZE; i++) {
      if (dir === "left") pos.push([k, i]);
      else if (dir === "right") pos.push([k, SIZE - 1 - i]);
      else if (dir === "up") pos.push([i, k]);
      else pos.push([SIZE - 1 - i, k]);
    }
    return pos;
  }

  /** Trượt + ghép 1 hàng về phía đầu mảng */
  function slide(values) {
    var nums = values.filter(function (v) {
      return v;
    });
    var out = [];
    var mergedAt = [];
    var gained = 0;
    for (var i = 0; i < nums.length; i++) {
      if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
        out.push(nums[i] * 2);
        mergedAt.push(out.length - 1);
        gained += nums[i] * 2;
        i++;
      } else {
        out.push(nums[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    return { values: out, gained: gained, mergedAt: mergedAt };
  }

  function move(dir) {
    if (state.over || (state.won && !state.keepPlaying)) return;

    var moved = false;
    var gained = 0;
    state.fresh = {};
    state.merged = {};

    for (var k = 0; k < SIZE; k++) {
      var pos = line(dir, k);
      var result = slide(
        pos.map(function (p) {
          return state.grid[p[0]][p[1]];
        }),
      );
      pos.forEach(function (p, i) {
        if (state.grid[p[0]][p[1]] !== result.values[i]) moved = true;
        state.grid[p[0]][p[1]] = result.values[i];
      });
      result.mergedAt.forEach(function (i) {
        state.merged[pos[i][0] * SIZE + pos[i][1]] = true;
      });
      gained += result.gained;
    }

    if (!moved) return;

    // Nước đi đầu tiên của ván → báo hub bắt đầu lượt chơi
    if (!state.roundStarted) {
      state.roundStarted = true;
      hideResult();
      if (hub) hub.gameStart();
    }

    state.score += gained;
    if (state.score > state.best) {
      state.best = state.score;
      storageSet(BEST_KEY, String(state.best));
    }

    addRandomTile();

    if (!state.won && hasTile(2048)) {
      state.won = true;
      showOverlay(t.winTitle, t.winText, true);
    } else if (!canMove()) {
      state.over = true;
      endRound();
      showOverlay(t.overTitle, t.overText(state.score), false);
    }

    render();
  }

  /** Kết thúc ván → nộp điểm cho hub (chỉ 1 lần mỗi ván) */
  function endRound() {
    if (!state.roundStarted) return;
    state.roundStarted = false;
    if (hub) hub.gameOver(state.score);
  }

  function newGame() {
    state.grid = emptyGrid();
    state.score = 0;
    state.won = false;
    state.keepPlaying = false;
    state.over = false;
    state.roundStarted = false;
    state.fresh = {};
    state.merged = {};
    addRandomTile();
    addRandomTile();
    hideOverlay();
    render();
  }

  function render() {
    var frag = document.createDocumentFragment();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = state.grid[r][c];
        var cell = document.createElement("div");
        cell.className = "cell";
        if (v) {
          var idx = r * SIZE + c;
          cell.className +=
            " tile " +
            (v > 2048 ? "vbig" : "v" + v) +
            (v >= 1024 ? " tiny" : v >= 128 ? " small" : "") +
            (state.fresh[idx] ? " new" : "") +
            (state.merged[idx] ? " merged" : "");
          cell.textContent = String(v);
        }
        frag.appendChild(cell);
      }
    }
    els.grid.replaceChildren(frag);
    els.score.textContent = state.score.toLocaleString();
    els.best.textContent = state.best.toLocaleString();
  }

  function showOverlay(title, text, canContinue) {
    els.overlayTitle.textContent = title;
    els.overlayText.textContent = text;
    els.keepGoing.classList.toggle("hidden", !canContinue);
    els.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    els.overlay.classList.add("hidden");
  }

  /** Hub báo kết quả lưu điểm (đã dịch sẵn theo ngôn ngữ người chơi) */
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
  }

  function applyHubData(data) {
    applyText(data.locale);
    els.saveNote.classList.toggle("hidden", data.standalone || data.canSubmitScore);
  }

  // ───── Điều khiển ─────
  var KEYS = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
  };

  document.addEventListener("keydown", function (e) {
    var dir = KEYS[e.key] || KEYS[e.key && e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  var start = null;
  els.board.addEventListener("pointerdown", function (e) {
    start = { x: e.clientX, y: e.clientY };
    window.focus();
  });
  els.board.addEventListener("pointerup", function (e) {
    if (!start) return;
    var dx = e.clientX - start.x;
    var dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  });

  els.newGame.addEventListener("click", function () {
    // Bỏ ván đang chơi giữa chừng → vẫn nộp điểm đã đạt
    if (state.score > 0) endRound();
    newGame();
  });
  els.tryAgain.addEventListener("click", function () {
    endRound();
    newGame();
  });
  els.keepGoing.addEventListener("click", function () {
    state.keepPlaying = true;
    hideOverlay();
  });

  // ───── Khởi động ─────
  state.best = Number(storageGet(BEST_KEY)) || 0;
  newGame();

  if (hub) {
    hub.init().then(applyHubData);
    // Hub gửi lại INIT khi người chơi đăng nhập / đổi ngôn ngữ
    hub.on("init", applyHubData);
    hub.on("scoreResult", showResult);
  }
})();
