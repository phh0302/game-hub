/* Neon Memory cho Game Hub – điểm = thời gian hoàn thành (mili-giây), càng thấp càng tốt */
(function () {
  "use strict";

  var SYMBOLS = ["🚀", "⭐", "🎧", "🍉", "🌙", "⚡", "🎲", "👾"];
  var FLIP_BACK_MS = 700;
  var BEST_KEY = "gh-memory-best";

  var TEXT = {
    vi: {
      time: "Thời gian",
      moves: "Lượt",
      best: "Nhanh nhất",
      hint: "Lật 2 thẻ giống nhau. Hoàn thành càng nhanh càng tốt!",
      restart: "Xếp lại",
      again: "Chơi lại",
      winTitle: "Hoàn thành!",
      winText: function (time, moves) {
        return "Thời gian " + time + " · " + moves + " lượt lật.";
      },
      card: "Thẻ",
      saveNote: "Kết nối ví trên Game Hub để lưu điểm và lên bảng xếp hạng.",
    },
    en: {
      time: "Time",
      moves: "Moves",
      best: "Best",
      hint: "Match pairs of cards. Finish as fast as you can!",
      restart: "Reshuffle",
      again: "Play again",
      winTitle: "Cleared!",
      winText: function (time, moves) {
        return "Time " + time + " · " + moves + " moves.";
      },
      card: "Card",
      saveNote: "Connect your wallet on Game Hub to save scores and join the leaderboard.",
    },
  };
  var t = TEXT.vi;
  var locale = "vi";
  var hub = window.GameHub;

  var els = {
    grid: document.getElementById("grid"),
    time: document.getElementById("time"),
    moves: document.getElementById("moves"),
    best: document.getElementById("best"),
    overlay: document.getElementById("overlay"),
    title: document.getElementById("overlay-title"),
    text: document.getElementById("overlay-text"),
    again: document.getElementById("again"),
    restart: document.getElementById("restart"),
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

  /** 1:05,3 – giống cách hub hiển thị bảng xếp hạng thời gian */
  function fmtTime(ms) {
    var tenths = Math.round(Math.max(0, ms) / 100);
    var m = Math.floor(tenths / 600);
    var sec = (tenths % 600) / 10;
    var secText = (sec < 10 ? "0" : "") + sec.toFixed(1);
    return m + ":" + (locale === "vi" ? secText.replace(".", ",") : secText);
  }

  // phase: ready (chưa lật thẻ nào) · playing · done
  var s = { phase: "ready", cards: [], open: [], matched: 0, moves: 0, startedAt: 0, elapsed: 0, best: 0, lock: false };

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function newGame() {
    s.phase = "ready";
    s.open = [];
    s.matched = 0;
    s.moves = 0;
    s.elapsed = 0;
    s.lock = false;
    s.cards = shuffle(SYMBOLS.concat(SYMBOLS)).map(function (sym, i) {
      return { id: i, sym: sym, state: "down" }; // down · up · matched
    });
    hideOverlay();
    hideResult();
    render();
    updateHud();
  }

  function render() {
    var frag = document.createDocumentFragment();
    s.cards.forEach(function (card, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card" + (card.state !== "down" ? " up" : "") + (card.state === "matched" ? " matched" : "");
      btn.setAttribute("aria-label", t.card + " " + (i + 1));
      btn.dataset.index = String(i);
      var inner = document.createElement("span");
      inner.className = "inner";
      var back = document.createElement("span");
      back.className = "face back";
      var front = document.createElement("span");
      front.className = "face front";
      front.textContent = card.sym;
      inner.appendChild(back);
      inner.appendChild(front);
      btn.appendChild(inner);
      frag.appendChild(btn);
    });
    els.grid.replaceChildren(frag);
  }

  function updateCard(i) {
    var btn = els.grid.children[i];
    var card = s.cards[i];
    if (!btn) return;
    btn.classList.toggle("up", card.state !== "down");
    btn.classList.toggle("matched", card.state === "matched");
  }

  function updateHud() {
    els.time.textContent = fmtTime(s.elapsed);
    els.moves.textContent = String(s.moves);
    els.best.textContent = s.best ? fmtTime(s.best) : "–";
  }

  function tick() {
    if (s.phase !== "playing") return;
    s.elapsed = performance.now() - s.startedAt;
    els.time.textContent = fmtTime(s.elapsed);
    requestAnimationFrame(tick);
  }

  function flip(i) {
    var card = s.cards[i];
    if (!card || card.state !== "down" || s.lock || s.phase === "done") return;

    if (s.phase === "ready") {
      s.phase = "playing";
      s.startedAt = performance.now();
      hideResult();
      if (hub) hub.gameStart();
      requestAnimationFrame(tick);
    }

    card.state = "up";
    updateCard(i);
    s.open.push(i);
    if (s.open.length < 2) return;

    s.moves += 1;
    els.moves.textContent = String(s.moves);
    var a = s.cards[s.open[0]];
    var b = s.cards[s.open[1]];
    if (a.sym === b.sym) {
      a.state = b.state = "matched";
      updateCard(s.open[0]);
      updateCard(s.open[1]);
      s.open = [];
      s.matched += 1;
      if (s.matched === SYMBOLS.length) finish();
    } else {
      s.lock = true;
      var pair = s.open;
      s.open = [];
      setTimeout(function () {
        pair.forEach(function (idx) {
          s.cards[idx].state = "down";
          updateCard(idx);
        });
        s.lock = false;
      }, FLIP_BACK_MS);
    }
  }

  function finish() {
    s.phase = "done";
    s.elapsed = Math.round(performance.now() - s.startedAt);
    if (!s.best || s.elapsed < s.best) {
      s.best = s.elapsed;
      storageSet(BEST_KEY, String(s.best));
    }
    updateHud();
    setTimeout(function () {
      showOverlay(t.winTitle, t.winText(fmtTime(s.elapsed), s.moves));
    }, 350);
    // Điểm gửi lên = thời gian hoàn thành (mili-giây); bảng xếp hạng "thấp là tốt"
    if (hub) hub.gameOver(s.elapsed);
  }

  // ───── Overlay / kết quả ─────
  function showOverlay(title, text) {
    els.title.textContent = title;
    els.text.textContent = text;
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

  function applyText(next) {
    locale = next === "vi" ? "vi" : "en";
    t = TEXT[locale];
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (typeof t[key] === "string") el.textContent = t[key];
    });
    updateHud();
    if (s.phase === "done") showOverlay(t.winTitle, t.winText(fmtTime(s.elapsed), s.moves));
  }
  function applyHubData(data) {
    applyText(data.locale);
    els.saveNote.classList.toggle("hidden", data.standalone || data.canSubmitScore);
  }

  // ───── Điều khiển ─────
  els.grid.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".card") : null;
    if (btn) flip(Number(btn.dataset.index));
  });
  els.again.addEventListener("click", newGame);
  els.restart.addEventListener("click", newGame);

  // ───── Khởi động ─────
  s.best = Number(storageGet(BEST_KEY)) || 0;
  newGame();

  if (hub) {
    hub.init().then(applyHubData);
    hub.on("init", applyHubData);
    hub.on("scoreResult", showResult);
  }
})();
