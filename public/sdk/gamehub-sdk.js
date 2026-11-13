/*!
 * Game Hub SDK v2
 * 1. Chế độ hub (game chạy trong Game Hub): giao tiếp qua postMessage – y hệt v1.
 *      const hub = await GameHub.init();  GameHub.gameStart();  GameHub.gameOver(1234);
 * 2. Chế độ độc lập (game chạy trên domain riêng – Platform API): truyền projectKey.
 *      await GameHub.init({ projectKey: "pk_live_…" });
 *      await GameHub.login();                 // ví MetaMask; GameHub.login({ guest: true }) = chơi khách
 *      GameHub.gameStart();
 *      const result = await GameHub.gameOver(1234);
 *      const top = await GameHub.leaderboard({ period: "week" });
 * Tài liệu: https://docs.monlabs.fun/sdk
 */
(function (global) {
  "use strict";

  var PROTOCOL = "gamehub";
  var VERSION = 1; // phiên bản giao thức postMessage (chế độ hub)
  var SDK_VERSION = 2;
  var INIT_TIMEOUT_MS = 3000;

  var embedded = global.parent && global.parent !== global;
  // Domain của hub = nơi tải file SDK này (dùng làm địa chỉ API ở chế độ độc lập)
  var scriptOrigin = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      return src ? new URL(src).origin : "";
    } catch (e) {
      return "";
    }
  })();
  var project = null; // { key, api, token, sessionPromise, locale } khi chạy chế độ độc lập
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

  // ───────────── Chế độ độc lập (Platform API) ─────────────

  var MESSAGES = {
    vi: {
      saved: "Đã lưu {score} điểm",
      best: "Kỷ lục mới!",
      rank: "Hạng #{rank}",
      guest: "(khách)",
      PLAYER_UNAUTHORIZED: "Hãy đăng nhập để lưu điểm",
      PLAY_TOO_SHORT: "Điểm không được ghi nhận: ván chơi quá ngắn",
      SCORE_TOO_FAST: "Điểm không được ghi nhận: tốc độ ghi điểm bất thường",
      SCORE_INVALID: "Điểm nằm ngoài mức cho phép",
      SERVER_SCORING_ONLY: "Game này nộp điểm qua máy chủ của game",
      PLAYER_BANNED: "Tài khoản đã bị cấm trong game này",
      SESSION_NOT_STARTED: "Chưa gọi gameStart() nên không lưu được điểm",
      RATE_LIMITED: "Thao tác quá nhanh, thử lại sau",
      NETWORK: "Không kết nối được máy chủ",
      error: "Không lưu được điểm ({code})",
    },
    en: {
      saved: "Saved {score} points",
      best: "New best!",
      rank: "Rank #{rank}",
      guest: "(guest)",
      PLAYER_UNAUTHORIZED: "Sign in to save your score",
      PLAY_TOO_SHORT: "Score not counted: the run was too short",
      SCORE_TOO_FAST: "Score not counted: abnormal scoring speed",
      SCORE_INVALID: "Score is outside the allowed range",
      SERVER_SCORING_ONLY: "This game submits scores from its own server",
      PLAYER_BANNED: "This account is banned in this game",
      SESSION_NOT_STARTED: "gameStart() was not called, so the score can't be saved",
      RATE_LIMITED: "Too many requests, try again later",
      NETWORK: "Can't reach the server",
      error: "Couldn't save the score ({code})",
    },
  };

  function msg(key, vars) {
    var table = MESSAGES[project && project.locale === "vi" ? "vi" : "en"];
    var text = table[key] || table.error;
    Object.keys(vars || {}).forEach(function (k) {
      text = text.replace("{" + k + "}", vars[k]);
    });
    return text;
  }

  function storage(action, value) {
    var name = "gamehub:" + project.key.slice(0, 20) + ":token";
    try {
      if (action === "get") return global.localStorage.getItem(name);
      if (action === "set") return global.localStorage.setItem(name, value);
      return global.localStorage.removeItem(name);
    } catch (e) {
      return null; // localStorage bị chặn → giữ token trong bộ nhớ
    }
  }

  /** Gọi Client API: trả về dữ liệu JSON, lỗi thì throw { code, message, status } */
  function api(method, path, body) {
    var headers = { "x-gamehub-key": project.key };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (project.token) headers.authorization = "Bearer " + project.token;
    var url = project.api + "/api/p1" + path + (path.indexOf("?") >= 0 ? "&" : "?") + "locale=" + project.locale;
    return fetch(url, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) }).then(
      function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            if (res.ok) return data;
            var err = (data && data.error) || {};
            if (res.status === 401 && err.code === "PLAYER_UNAUTHORIZED") setToken(null);
            throw { status: res.status, code: err.code || "HTTP_" + res.status, message: err.message || "" };
          });
      },
      function () {
        throw { status: 0, code: "NETWORK", message: msg("NETWORK") };
      },
    );
  }

  function setToken(token) {
    project.token = token;
    if (token) storage("set", token);
    else storage("remove");
  }

  function projectInitData() {
    return {
      protocolVersion: VERSION,
      sdkVersion: SDK_VERSION,
      standalone: false,
      mode: "project",
      locale: project.locale,
      project: project.info,
      player: project.player,
      canSubmitScore: !!project.player,
    };
  }

  function initProject(options) {
    var lang = options.locale || (global.navigator && global.navigator.language) || "en";
    project = {
      key: String(options.projectKey),
      api: String(options.apiBase || scriptOrigin).replace(/\/+$/, ""),
      locale: String(lang).toLowerCase().indexOf("vi") === 0 ? "vi" : "en",
      token: null,
      player: null,
      info: null,
      sessionPromise: null,
    };
    project.token = storage("get");
    return api("GET", "/project")
      .then(function (data) {
        project.info = data.project;
        if (!project.token) return null;
        return api("GET", "/me").then(
          function (me) {
            project.player = me.player;
          },
          function () {
            project.player = null; // token hết hạn / bị thu hồi → coi như chưa đăng nhập
          },
        );
      })
      .then(function () {
        initData = projectInitData();
        emit("init", initData);
        return initData;
      });
  }

  /** personal_sign chuẩn MetaMask: thông điệp UTF-8 mã hóa hex "0x…" */
  function utf8ToHex(text) {
    var bytes = new TextEncoder().encode(text);
    var out = "0x";
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return out;
  }

  function walletLogin() {
    var eth = global.ethereum;
    if (!eth || !eth.request) return Promise.reject({ code: "NO_WALLET", message: "MetaMask not found" });
    var address;
    return eth
      .request({ method: "eth_requestAccounts" })
      .then(function (accounts) {
        address = accounts && accounts[0];
        if (!address) throw { code: "NO_ACCOUNT", message: "No wallet account" };
        return eth.request({ method: "eth_chainId" });
      })
      .then(function (chainHex) {
        return api("POST", "/auth/nonce", { address: address, chainId: parseInt(chainHex, 16) || 1 });
      })
      .then(function (res) {
        return eth.request({ method: "personal_sign", params: [utf8ToHex(res.message), address] }).then(function (signature) {
          return api("POST", "/auth/verify", { message: res.message, signature: signature });
        });
      });
  }

  function afterLogin(res) {
    setToken(res.token);
    project.player = res.player;
    initData = projectInitData();
    emit("init", initData);
    return res.player;
  }

  function requireProject(name) {
    if (!project) throw new Error("[GameHub SDK] " + name + "() cần GameHub.init({ projectKey }) trước");
  }

  var GameHub = {
    version: SDK_VERSION,

    /**
     * Gọi 1 lần khi game tải xong. Trả về { locale, player, canSubmitScore, standalone }.
     * Chạy ngoài hub (mở file trực tiếp) → standalone: true.
     */
    init: function (options) {
      if (initPromise) return initPromise;
      if (options && options.projectKey) {
        initPromise = initProject(options);
        return initPromise;
      }
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

    /**
     * Gọi khi bắt đầu 1 ván mới (hub bắt đầu tính thời gian lượt chơi).
     * Chế độ độc lập: trả về Promise<sessionId | null> – game có máy chủ riêng gửi sessionId này
     * cho máy chủ để nộp điểm qua Server API.
     */
    gameStart: function () {
      if (project) {
        project.sessionPromise = project.player
          ? api("POST", "/sessions", {}).then(
              function (r) {
                return r.sessionId;
              },
              function () {
                return null;
              },
            )
          : Promise.resolve(null);
        return project.sessionPromise;
      }
      send("GAME_START", {});
    },

    /**
     * Gọi khi ván kết thúc. score: số nguyên ≥ 0.
     * options.leaderboard: key bảng xếp hạng (mặc định "default").
     */
    gameOver: function (score, options) {
      var value = Math.max(0, Math.floor(Number(score) || 0));
      var board = (options && options.leaderboard) || "default";
      if (!project) {
        send("GAME_OVER", { score: value, leaderboard: board });
        return;
      }
      // Chế độ độc lập: trả về Promise<{ saved, code, message, score?, best?, rank?, isNewBest?, tournaments? }>
      function finish(result) {
        emit("scoreResult", result);
        return result;
      }
      if (!project.player) return Promise.resolve(finish({ saved: false, code: "PLAYER_UNAUTHORIZED", message: msg("PLAYER_UNAUTHORIZED") }));
      var pendingSession = project.sessionPromise;
      project.sessionPromise = null;
      if (!pendingSession) return Promise.resolve(finish({ saved: false, code: "SESSION_NOT_STARTED", message: msg("SESSION_NOT_STARTED") }));
      return pendingSession
        .then(function (sessionId) {
          if (!sessionId) throw { code: "SESSION_NOT_STARTED" };
          return api("POST", "/scores", { sessionId: sessionId, score: value, leaderboard: board });
        })
        .then(
          function (r) {
            var parts = [msg("saved", { score: r.score.value })];
            if (r.isNewBest) parts.push(msg("best"));
            if (r.rank) parts.push(msg("rank", { rank: r.rank }));
            return finish({
              saved: true,
              code: null,
              message: parts.join(" · "),
              score: r.score.value,
              best: r.best,
              rank: r.rank,
              isNewBest: r.isNewBest,
              tournaments: r.tournaments || [],
            });
          },
          function (err) {
            var code = (err && err.code) || "ERROR";
            return finish({ saved: false, code: code, message: msg(code, { code: code }) });
          },
        );
    },

    /**
     * Chế độ độc lập: đăng nhập người chơi. Mặc định bằng ví MetaMask (ký SIWE trên domain của game);
     * login({ guest: true }) = chơi khách. Trả về Promise<player>.
     */
    login: function (options) {
      requireProject("login");
      var p = options && options.guest ? api("POST", "/auth/guest", {}) : walletLogin();
      return p.then(afterLogin);
    },

    /** Chế độ độc lập: đăng xuất (thu hồi token trên máy chủ) */
    logout: function () {
      requireProject("logout");
      var done = function () {
        setToken(null);
        project.player = null;
        initData = projectInitData();
        emit("init", initData);
      };
      return api("POST", "/auth/logout", {}).then(done, done);
    },

    /** Chế độ độc lập: người chơi hiện tại + điểm tốt nhất ở bảng chính, hoặc null nếu chưa đăng nhập */
    me: function () {
      requireProject("me");
      if (!project.token) return Promise.resolve(null);
      return api("GET", "/me").then(null, function () {
        return null;
      });
    },

    /** Chế độ độc lập: bảng xếp hạng. options: { board = "default", period = "all" | "week" | "day", limit = 50 } */
    leaderboard: function (options) {
      requireProject("leaderboard");
      var o = options || {};
      var qs = "board=" + encodeURIComponent(o.board || "default") + "&period=" + (o.period || "all") + "&limit=" + (o.limit || 50);
      return api("GET", "/leaderboard?" + qs);
    },

    /** Chế độ độc lập: danh sách bảng chính + giải đấu đang hiển thị */
    leaderboards: function () {
      requireProject("leaderboards");
      return api("GET", "/leaderboards").then(function (r) {
        return r.leaderboards;
      });
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
