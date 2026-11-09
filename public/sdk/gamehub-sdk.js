/*!
 * Game Hub SDK v1
 * Nhúng vào game HTML5 để giao tiếp với Game Hub qua postMessage.
 * Tài liệu: docs/GAME_SDK.md
 *
 *   <script src="https://<hub-domain>/sdk/gamehub-sdk.js"></script>
 *   const hub = await GameHub.init();
 *   GameHub.gameStart();
 *   GameHub.gameOver(1234);
 */
(function (global) {
  "use strict";

  var PROTOCOL = "gamehub";
  var VERSION = 1;
  var INIT_TIMEOUT_MS = 3000;

  var embedded = global.parent && global.parent !== global;
  var listeners = {};
  var pending = {};
  var seq = 0;
  var initData = null;
  var initPromise = null;

  function send(type, payload) {
    if (!embedded) return;
    // Game chạy trong iframe sandbox (origin "null") nên không giới hạn targetOrigin được.
    // Tin nhắn chỉ chứa dữ liệu không nhạy cảm; hub tự kiểm tra nguồn gửi.
    global.parent.postMessage({ source: PROTOCOL, v: VERSION, type: type, payload: payload || {} }, "*");
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(function (cb) {
      try {
        cb(data);
      } catch (err) {
        console.error("[GameHub SDK] listener error", err);
      }
    });
  }

  global.addEventListener("message", function (event) {
    if (!embedded || event.source !== global.parent) return;
    var msg = event.data;
    if (!msg || msg.source !== PROTOCOL || typeof msg.type !== "string") return;
    var payload = msg.payload || {};

    switch (msg.type) {
      case "INIT":
        initData = payload;
        emit("init", payload);
        break;
      case "AD_RESULT":
        if (pending[payload.requestId]) {
          pending[payload.requestId](payload);
          delete pending[payload.requestId];
        }
        break;
      case "SCORE_RESULT":
        // Kết quả lưu điểm sau gameOver(): { saved, code, message, score?, best?, rank?, isNewBest? }
        emit("scoreResult", payload);
        break;
      case "PAUSE":
        emit("pause", payload);
        break;
      case "RESUME":
        emit("resume", payload);
        break;
    }
  });

  function standaloneData() {
    var lang = (global.navigator && global.navigator.language) || "vi";
    return {
      protocolVersion: VERSION,
      standalone: true,
      locale: lang.toLowerCase().indexOf("vi") === 0 ? "vi" : "en",
      player: null,
      canSubmitScore: false,
    };
  }

  function requestAd(kind) {
    return new Promise(function (resolve) {
      if (!embedded) return resolve({ shown: false, rewarded: false, reason: "STANDALONE" });
      var requestId = "ad_" + ++seq;
      pending[requestId] = resolve;
      send("AD_REQUEST", { requestId: requestId, kind: kind });
      // Hub không phản hồi → coi như không có quảng cáo
      setTimeout(function () {
        if (pending[requestId]) {
          pending[requestId]({ shown: false, rewarded: false, reason: "TIMEOUT" });
          delete pending[requestId];
        }
      }, 60000);
    });
  }

  var GameHub = {
    version: VERSION,

    /**
     * Gọi 1 lần khi game tải xong. Trả về { locale, player, canSubmitScore, standalone }.
     * Chạy ngoài hub (mở file trực tiếp) → standalone: true.
     */
    init: function () {
      if (initPromise) return initPromise;
      initPromise = new Promise(function (resolve) {
        if (!embedded) return resolve(standaloneData());
        var done = false;
        GameHub.on("init", function (data) {
          if (done) return;
          done = true;
          resolve(data);
        });
        send("READY", { sdkVersion: VERSION });
        setTimeout(function () {
          if (done) return;
          done = true;
          resolve(standaloneData());
        }, INIT_TIMEOUT_MS);
      });
      return initPromise;
    },

    /** Gọi khi bắt đầu 1 ván mới (hub bắt đầu tính thời gian lượt chơi) */
    gameStart: function () {
      send("GAME_START", {});
    },

    /**
     * Gọi khi ván kết thúc. score: số nguyên ≥ 0.
     * options.leaderboard: key bảng xếp hạng (mặc định "default").
     */
    gameOver: function (score, options) {
      var value = Math.max(0, Math.floor(Number(score) || 0));
      send("GAME_OVER", { score: value, leaderboard: (options && options.leaderboard) || "default" });
    },

    /** Quảng cáo có thưởng → Promise<{ shown, rewarded, reason? }>. Chỉ thưởng khi rewarded === true. */
    showRewardedAd: function () {
      return requestAd("rewarded");
    },

    /** Quảng cáo xen giữa màn → Promise<{ shown }> */
    showInterstitialAd: function () {
      return requestAd("interstitial");
    },

    /** Lắng nghe sự kiện từ hub: "init", "scoreResult", "pause", "resume" */
    on: function (event, cb) {
      (listeners[event] = listeners[event] || []).push(cb);
    },

    /** Dữ liệu INIT đã nhận (null nếu chưa init) */
    getInitData: function () {
      return initData;
    },
  };

  global.GameHub = GameHub;
})(window);
