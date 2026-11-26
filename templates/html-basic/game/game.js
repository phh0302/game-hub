// Tap Rush – game mẫu tích hợp đủ Monlabs Game Hub SDK (không framework, không build).
// Chạy thử: npx serve game  → mở http://localhost:3000 trong Sandbox: https://play.monlabs.fun/developer/sandbox
(function () {
  "use strict";
  var TEXT = {
    vi: { hint: "Chạm vòng tròn càng nhiều càng tốt trong 10 giây", score: "Điểm", best: "Kỷ lục", share: "Khoe điểm", invite: "Mời bạn", revive: "Xem QC: +5 giây", saved: "Đã lưu điểm!", notSaved: "Kết nối ví để lưu điểm", start: "Chạm để bắt đầu" },
    en: { hint: "Tap the circle as many times as you can in 10 seconds", score: "Score", best: "Best", share: "Share score", invite: "Invite", revive: "Watch ad: +5s", saved: "Score saved!", notSaved: "Connect a wallet to save scores", start: "Tap to start" },
  };
  var $ = function (id) { return document.getElementById(id); };
  var t = TEXT.vi;
  var state = { best: 0, plays: 0 };   // tiến trình lưu bằng GameHub.saveState (KHÔNG dùng localStorage – bị chặn trong hub)
  var score = 0, left = 10, timer = null, running = false, lastScore = 0, revived = false;

  function render() {
    $("score").textContent = score;
    $("best").textContent = state.best;
    $("time").textContent = left;
  }

  function applyHub(hub) {
    t = TEXT[hub.locale] || TEXT.vi;
    $("hint").textContent = t.hint;
    $("label-score").textContent = t.score;
    $("label-best").textContent = t.best;
    $("share").textContent = t.share;
    $("invite").textContent = t.invite;
    $("revive").textContent = t.revive;
    // Chỉ hiện nút khi hub hỗ trợ
    $("share").hidden = !hub.social || !hub.social.share;
    $("invite").hidden = !hub.social || !hub.social.invite;
    $("status").textContent = running ? "" : t.start;
  }

  function start() {
    running = true;
    revived = false;
    score = 0;
    left = 10;
    $("revive").hidden = true;
    $("status").textContent = "";
    GameHub.gameStart();                       // hub bắt đầu tính thời gian ván chơi
    GameHub.track("run_start", { plays: state.plays });
    timer = setInterval(tick, 1000);
    render();
  }

  function tick() {
    left--;
    render();
    if (left > 0) return;
    clearInterval(timer);
    // Còn quảng cáo thưởng → cho hồi sinh 1 lần trước khi kết thúc
    var hub = GameHub.getInitData();
    if (!revived && hub && hub.ads && hub.ads.rewarded) {
      $("revive").hidden = false;
      setTimeout(function () { if (!revived && left <= 0) end(); }, 3000);
      return;
    }
    end();
  }

  function end() {
    if (!running) return;
    running = false;
    $("revive").hidden = true;
    lastScore = score;
    state.plays++;
    if (score > state.best) state.best = score;
    GameHub.saveState(state);
    GameHub.track("run_end", { score: score, revived: revived });
    GameHub.gameOver(score).then(function (r) {   // điểm phải là số nguyên ≥ 0
      $("status").textContent = r.saved ? t.saved : r.code === "LOGIN_REQUIRED" ? t.notSaved : r.message || "";
    });
    render();
  }

  $("target").addEventListener("click", function () {
    if (!running) return start();
    score++;
    render();
  });
  $("revive").addEventListener("click", function () {
    revived = true;
    $("revive").hidden = true;
    GameHub.showRewardedAd().then(function (r) {
      if (r.rewarded) {
        left = 5;
        timer = setInterval(tick, 1000);
        render();
      } else end();
    });
  });
  $("share").addEventListener("click", function () {
    GameHub.share({ score: lastScore, text: lastScore ? "Mình chạm " + lastScore + " lần trong 10 giây!" : undefined });
  });
  $("invite").addEventListener("click", function () { GameHub.invite(); });

  // Hub tạm dừng (người chơi chuyển tab) → dừng đồng hồ
  GameHub.on("pause", function () { clearInterval(timer); });
  GameHub.on("resume", function () { if (running && left > 0) { clearInterval(timer); timer = setInterval(tick, 1000); } });
  GameHub.on("init", applyHub);  // hub gửi lại khi người chơi đăng nhập / đổi ngôn ngữ

  GameHub.init().then(function (hub) {
    applyHub(hub);
    return GameHub.loadState();
  }).then(function (saved) {
    if (saved && typeof saved === "object") state = Object.assign(state, saved);
    render();
  });
})();
