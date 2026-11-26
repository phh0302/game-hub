// Cầu nối C# ↔ Monlabs Game Hub SDK (window.GameHub nạp trong WebGLTemplates/Monlabs/index.html).
// Kết quả bất đồng bộ trả về C# bằng SendMessage(<tên GameObject>, <hàm>, <chuỗi JSON>).
mergeInto(LibraryManager.library, {
  MonlabsInit: function (goPtr) {
    var go = UTF8ToString(goPtr);
    window.__monlabsGo = go;
    if (!window.GameHub) {
      SendMessage(go, "OnInit", JSON.stringify({ standalone: true, locale: "en", player: null, canSubmitScore: false, ads: { rewarded: false, interstitial: false }, social: { share: false, invite: false }, invites: null }));
      return;
    }
    window.GameHub.on("init", function (d) { SendMessage(go, "OnInit", JSON.stringify(d)); });
    window.GameHub.on("pause", function () { SendMessage(go, "OnPause", ""); });
    window.GameHub.on("resume", function () { SendMessage(go, "OnResume", ""); });
    window.GameHub.init().then(function (d) { SendMessage(go, "OnInit", JSON.stringify(d)); });
  },
  MonlabsGameStart: function () {
    if (window.GameHub) window.GameHub.gameStart();
  },
  MonlabsGameOver: function (score, boardPtr) {
    var board = UTF8ToString(boardPtr) || "default";
    if (!window.GameHub) return;
    window.GameHub.gameOver(score, { leaderboard: board }).then(function (r) {
      SendMessage(window.__monlabsGo, "OnScoreResult", JSON.stringify(r));
    });
  },
  MonlabsSaveState: function (jsonPtr) {
    var json = UTF8ToString(jsonPtr);
    if (!window.GameHub) return;
    var data;
    try { data = JSON.parse(json); } catch (e) { data = json; }
    window.GameHub.saveState(data).then(function (r) {
      SendMessage(window.__monlabsGo, "OnStateSaved", JSON.stringify(r));
    });
  },
  MonlabsLoadState: function () {
    if (!window.GameHub) { SendMessage(window.__monlabsGo, "OnStateLoaded", ""); return; }
    window.GameHub.loadState().then(function (d) {
      SendMessage(window.__monlabsGo, "OnStateLoaded", d == null ? "" : JSON.stringify(d));
    });
  },
  MonlabsTrack: function (namePtr, propsPtr) {
    if (!window.GameHub) return;
    var props = null;
    try { props = JSON.parse(UTF8ToString(propsPtr) || "null"); } catch (e) {}
    window.GameHub.track(UTF8ToString(namePtr), props || undefined);
  },
  MonlabsShowRewardedAd: function () {
    if (!window.GameHub) { SendMessage(window.__monlabsGo, "OnAdResult", JSON.stringify({ shown: false, rewarded: false, reason: "STANDALONE" })); return; }
    window.GameHub.showRewardedAd().then(function (r) { SendMessage(window.__monlabsGo, "OnAdResult", JSON.stringify(r)); });
  },
  MonlabsShare: function (textPtr, score) {
    if (!window.GameHub) return;
    var opts = { text: UTF8ToString(textPtr) || undefined };
    if (score >= 0) opts.score = score;
    window.GameHub.share(opts).then(function (r) { SendMessage(window.__monlabsGo, "OnShareResult", JSON.stringify(r)); });
  },
  MonlabsInvite: function () {
    if (!window.GameHub) return;
    window.GameHub.invite().then(function (r) { SendMessage(window.__monlabsGo, "OnShareResult", JSON.stringify(r)); });
  },
});
