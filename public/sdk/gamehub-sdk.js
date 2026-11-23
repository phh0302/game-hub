/*!
 * Game Hub SDK v3
 * 1. Chế độ hub (game chạy trong Game Hub): giao tiếp qua postMessage.
 *      const hub = await GameHub.init();  GameHub.gameStart();
 *      const result = await GameHub.gameOver(1234);   // v3: Promise kết quả ở mọi chế độ
 *      await GameHub.saveState({ level: 3 });  const save = await GameHub.loadState();
 *      await GameHub.share({ score: 1234 });  await GameHub.invite();   // chia sẻ / mời bạn (23/11)
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
  var SDK_VERSION = 3;
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
  var pendingScore = null; // resolve của gameOver() đang chờ SCORE_RESULT (chế độ hub)
  var SCORE_TIMEOUT_MS = 20000;
  var STATE_TIMEOUT_MS = 5000;
  var SHARE_TIMEOUT_MS = 5 * 60 * 1000; // bảng chia sẻ mở đến khi người chơi đóng
  var STATE_MAX_BYTES = 64 * 1024; // đo theo UTF-8 (tiếng Việt 1 ký tự có thể 2–3 byte)

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
        if (!payload.ads) payload.ads = NO_ADS;
        // Hub cũ không gửi → không có bảng chia sẻ / mời bạn
        if (!payload.social) payload.social = NO_SOCIAL;
        if (payload.invites === undefined) payload.invites = null;
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
        if (pendingScore) {
          var resolveScore = pendingScore;
          pendingScore = null;
          resolveScore(payload);
        }
        emit("scoreResult", payload);
        break;
      case "STATE_RESULT":
      case "SHARE_RESULT":
        if (pending[payload.requestId]) {
          pending[payload.requestId](payload);
          delete pending[payload.requestId];
        }
        break;
      case "PAUSE":
        emit("pause", payload);
        break;
      case "RESUME":
        emit("resume", payload);
        break;
    }
  });

  /** Quảng cáo nào đang có: game nên ẩn nút "xem quảng cáo" khi false (hub cũ không gửi → coi như không có) */
  var NO_ADS = { rewarded: false, interstitial: false };
  var NO_SOCIAL = { share: false, invite: false };

  /** Ngoài hub: chia sẻ bằng bảng chia sẻ của máy, không có thì copy link trang hiện tại */
  function canShareHere() {
    var nav = global.navigator || {};
    return typeof nav.share === "function" || Boolean(nav.clipboard && nav.clipboard.writeText);
  }
  function localSocial() {
    var ok = canShareHere();
    return { share: ok, invite: ok };
  }
  function shareHere(text) {
    var nav = global.navigator || {};
    var url = String(global.location && global.location.href ? global.location.href : "").split("#")[0];
    var title = (global.document && global.document.title) || "";
    function copy() {
      if (!nav.clipboard || !nav.clipboard.writeText) return Promise.resolve({ shared: false, method: null, reason: "UNSUPPORTED" });
      return nav.clipboard.writeText((text ? text + " " : "") + url).then(
        function () {
          return { shared: true, method: "copy" };
        },
        function () {
          return { shared: false, method: null, reason: "UNSUPPORTED" };
        },
      );
    }
    if (typeof nav.share === "function") {
      return nav.share({ title: title, text: text || title, url: url }).then(
        function () {
          return { shared: true, method: "native" };
        },
        function (err) {
          return err && err.name === "AbortError" ? { shared: false, method: null, reason: "CANCELLED" } : copy();
        },
      );
    }
    return copy();
  }

  /** share / invite: trong hub → bảng chia sẻ của hub (link có mã mời); ngoài hub → chia sẻ link trang */
  function social(kind, options) {
    var o = options || {};
    var text = typeof o.text === "string" && o.text.trim() ? o.text.trim().slice(0, 200) : undefined;
    var score = typeof o.score === "number" && isFinite(o.score) && o.score >= 0 ? Math.floor(o.score) : undefined;
    if (embedded && !project) {
      var caps = (initData && initData.social) || NO_SOCIAL;
      if (!caps[kind]) return Promise.resolve({ shared: false, method: null, reason: "UNSUPPORTED" });
      var payload = { text: text };
      if (kind === "share" && score !== undefined) payload.score = score;
      return requestHub(kind === "share" ? "SHARE" : "INVITE", payload, SHARE_TIMEOUT_MS, { shared: false, method: null, reason: "TIMEOUT" }).then(
        function (r) {
          return { shared: Boolean(r.shared), method: r.method || null, reason: r.reason };
        },
      );
    }
    return shareHere(text);
  }

  function standaloneData() {
    var lang = (global.navigator && global.navigator.language) || "vi";
    return {
      protocolVersion: VERSION,
      standalone: true,
      locale: lang.toLowerCase().indexOf("vi") === 0 ? "vi" : "en",
      player: null,
      canSubmitScore: false,
      ads: NO_ADS,
      social: localSocial(),
      invites: null,
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

  /** Gửi yêu cầu cho hub và chờ trả lời theo requestId (hub cũ không trả lời → fallback sau timeoutMs) */
  function requestHub(type, payload, timeoutMs, fallback) {
    return new Promise(function (resolve) {
      var requestId = "rq_" + ++seq;
      var timer = setTimeout(function () {
        if (pending[requestId]) {
          delete pending[requestId];
          resolve(fallback);
        }
      }, timeoutMs);
      pending[requestId] = function (r) {
        clearTimeout(timer); // trả lời rồi → bỏ hẹn giờ (bảng chia sẻ chờ tới 5 phút)
        resolve(r);
      };
      payload.requestId = requestId;
      send(type, payload);
    });
  }

  /**
   * Lưu tiến trình. Trên hub game chạy trong khung sandbox (origin "null") nên localStorage / IndexedDB
   * luôn lỗi → hub lưu hộ (trong trình duyệt của người chơi, theo từng game). Ngoài hub: localStorage của trang.
   */
  function localKey(owner) {
    return "gamehub:state:" + (project ? project.key.slice(0, 16) : "standalone") + (owner ? ":u:" + owner : "");
  }
  function localSave(text, owner) {
    try {
      global.localStorage.setItem(localKey(owner), text);
      return { saved: true, code: null };
    } catch (e) {
      memoryState = text;
      return { saved: false, code: "STORAGE_UNAVAILABLE" };
    }
  }
  function localLoad(owner) {
    try {
      return global.localStorage.getItem(localKey(owner));
    } catch (e) {
      return memoryState;
    }
  }
  function localRemove(owner) {
    try {
      global.localStorage.removeItem(localKey(owner));
    } catch (e) {}
  }
  /** Chế độ độc lập + đã login (ví hoặc khách) → lưu theo tài khoản trên máy chủ Monlabs */
  function cloudOwner() {
    return project && project.token && project.player ? project.player.id : null;
  }
  var memoryState = null;

  function toStateText(data) {
    var text;
    try {
      text = JSON.stringify(data === undefined ? null : data);
    } catch (e) {
      return { error: "STATE_INVALID" };
    }
    if (typeof text !== "string") return { error: "STATE_INVALID" };
    if (utf8Length(text) > STATE_MAX_BYTES) return { error: "STATE_TOO_LARGE" };
    return { text: text };
  }
  function utf8Length(text) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }
  function parseState(text) {
    if (typeof text !== "string") return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  // ───────────── Sự kiện game (GameHub.track) ─────────────
  var trackQueue = [];
  var trackTimer = null;
  var TRACK_FLUSH_MS = 5000;
  var TRACK_BATCH = 20;

  /** Gửi các sự kiện đang chờ: hub (postMessage) / Platform API / mở file trực tiếp thì chỉ in ra console */
  function flushEvents() {
    if (trackTimer) {
      clearTimeout(trackTimer);
      trackTimer = null;
    }
    var batch = trackQueue.splice(0, 50);
    if (!batch.length) return Promise.resolve({ sent: 0 });
    if (embedded && !project) {
      send("TRACK", { events: batch });
      return Promise.resolve({ sent: batch.length });
    }
    if (project) {
      return api("POST", "/events", { events: batch }).then(
        function (r) {
          return { sent: (r && r.accepted) || 0 };
        },
        function () {
          return { sent: 0 };
        },
      );
    }
    console.info("[GameHub SDK] track (standalone, không gửi):", batch);
    return Promise.resolve({ sent: 0 });
  }
  if (global.addEventListener) {
    global.addEventListener("pagehide", function () {
      flushEvents();
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
      QUOTA_PLAYERS: "Điểm chưa được lưu: game đã hết hạn mức người chơi của tháng này",
      QUOTA_SCORES: "Điểm chưa được lưu: game đã hết hạn mức lưu điểm của tháng này",
      IP_BLOCKED: "Bạn gửi quá nhiều yêu cầu nên tạm bị chặn, thử lại sau ít phút",
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
      QUOTA_PLAYERS: "Score not saved: this game reached its monthly player limit",
      QUOTA_SCORES: "Score not saved: this game reached its monthly score limit",
      IP_BLOCKED: "Too many requests – temporarily blocked, try again in a few minutes",
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
      ads: NO_ADS, // chế độ độc lập: Monlabs không cung cấp quảng cáo
      social: localSocial(), // chia sẻ link trang của game (chưa tính lượt mời)
      invites: null,
    };
  }

  /** Gói Free: dòng nhỏ "Powered by Monlabs" ở góc dưới (gói trả phí thì không hiện) */
  function showBranding() {
    var doc = global.document;
    if (!doc || !doc.body || doc.getElementById("monlabs-branding")) return;
    var a = doc.createElement("a");
    a.id = "monlabs-branding";
    a.href = "https://monlabs.fun/?ref=sdk";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Powered by Monlabs";
    a.setAttribute(
      "style",
      "position:fixed;right:8px;bottom:8px;z-index:2147483000;padding:3px 8px;border-radius:6px;" +
        "background:rgba(7,7,15,.75);color:#b6ff3b;font:600 11px/1.4 system-ui,sans-serif;text-decoration:none;opacity:.85",
    );
    doc.body.appendChild(a);
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
        if (project.info && project.info.branding) showBranding();
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
     * Gọi khi ván kết thúc. score: số ≥ 0 (làm tròn xuống; không phải số → cảnh báo trong console và nộp 0).
     * options.leaderboard: key bảng xếp hạng (mặc định "default").
     * Mọi chế độ: trả về Promise<{ saved, code, message, … }> và phát sự kiện "scoreResult".
     */
    gameOver: function (score, options) {
      var num = Number(score);
      if (!isFinite(num) || num < 0) {
        console.warn("[GameHub SDK] gameOver(score): score phải là số ≥ 0, nhận " + String(score) + " → nộp 0 điểm");
      }
      var value = Math.max(0, Math.floor(num || 0));
      var board = (options && options.leaderboard) || "default";
      if (!project) {
        // Chế độ hub: hub nộp điểm rồi trả SCORE_RESULT → Promise kết quả (giống chế độ độc lập)
        if (!embedded) {
          var standalone = { saved: false, code: "STANDALONE", message: "Standalone: score not saved", score: value };
          emit("scoreResult", standalone);
          return Promise.resolve(standalone);
        }
        if (pendingScore) pendingScore({ saved: false, code: "SUPERSEDED", message: "" });
        var scorePromise = new Promise(function (resolve) {
          pendingScore = resolve;
          setTimeout(function () {
            if (pendingScore === resolve) {
              pendingScore = null;
              resolve({ saved: false, code: "TIMEOUT", message: "" });
            }
          }, SCORE_TIMEOUT_MS);
        });
        send("GAME_OVER", { score: value, leaderboard: board });
        return scorePromise;
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

    /**
     * Ghi 1 sự kiện (vd "level_complete", { level: 3 }). Gom lại gửi mỗi 5 giây / 20 sự kiện / khi rời trang.
     * Tên: chữ, số, _ . : - (tối đa 64 ký tự). props: ≤ 10 khóa, giá trị chuỗi (≤ 100 ký tự) / số / boolean.
     * Xem số liệu ở trang Developer → game → Sự kiện game.
     */
    track: function (name, props) {
      if (typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(name)) {
        console.warn("[GameHub SDK] track(name): tên sự kiện không hợp lệ – " + String(name));
        return;
      }
      trackQueue.push(props && typeof props === "object" ? { name: name, props: props } : { name: name });
      if (trackQueue.length >= TRACK_BATCH) flushEvents();
      else if (!trackTimer) trackTimer = setTimeout(flushEvents, TRACK_FLUSH_MS);
    },

    /** Gửi ngay các sự kiện đang chờ → Promise<{ sent }> */
    flush: function () {
      return flushEvents();
    },

    /**
     * Lưu tiến trình (dữ liệu JSON, tối đa 64KB) → Promise<{ saved, code }>.
     * Trên hub: hub lưu hộ trong trình duyệt của người chơi (localStorage của game KHÔNG dùng được trong sandbox).
     * Ngoài hub / chế độ độc lập: localStorage của trang. Mỗi lần lưu ghi đè bản trước.
     */
    saveState: function (data) {
      var t = toStateText(data);
      if (t.error) return Promise.resolve({ saved: false, code: t.error });
      if (embedded && !project) {
        return requestHub("STATE_SAVE", { data: t.text }, STATE_TIMEOUT_MS, { saved: false, code: "TIMEOUT" }).then(function (r) {
          return { saved: !!r.saved, code: r.saved ? null : r.code || "ERROR" };
        });
      }
      var owner = cloudOwner();
      if (owner) {
        // Theo tài khoản (đồng bộ giữa thiết bị) + bản sao trong trình duyệt; mất mạng → còn bản sao
        var local = localSave(t.text, owner);
        return api("POST", "/state", { data: t.text }).then(
          function () {
            return { saved: true, code: null };
          },
          function (err) {
            if (err && (err.code === "STATE_TOO_LARGE" || err.code === "STATE_INVALID")) return { saved: false, code: err.code };
            return local.saved ? { saved: true, code: "SYNC_FAILED" } : { saved: false, code: (err && err.code) || "ERROR" };
          },
        );
      }
      return Promise.resolve(localSave(t.text));
    },

    /** Đọc tiến trình đã lưu bằng saveState() → Promise<data | null> */
    loadState: function () {
      if (embedded && !project) {
        return requestHub("STATE_LOAD", {}, STATE_TIMEOUT_MS, { data: null }).then(function (r) {
          return parseState(r.data);
        });
      }
      var owner = cloudOwner();
      if (owner) {
        return api("GET", "/state").then(
          function (r) {
            if (r && typeof r.data === "string") {
              localSave(r.data, owner);
              return parseState(r.data);
            }
            // Chưa có trên máy chủ: bản của tài khoản trên máy này, hoặc tiến trình lúc chưa login → đẩy lên tài khoản
            var mine = localLoad(owner);
            var carried = mine !== null && mine !== undefined ? mine : localLoad();
            if (typeof carried === "string") {
              api("POST", "/state", { data: carried }).then(
                function () {
                  localSave(carried, owner);
                  if (mine === null || mine === undefined) localRemove();
                },
                function () {},
              );
            }
            return parseState(carried);
          },
          function () {
            return parseState(localLoad(owner));
          },
        );
      }
      return Promise.resolve(parseState(localLoad()));
    },

    /** Quảng cáo có thưởng → Promise<{ shown, rewarded, reason? }>. Chỉ thưởng khi rewarded === true. */
    showRewardedAd: function () {
      return requestAd("rewarded");
    },

    /** Quảng cáo xen giữa màn → Promise<{ shown }> */
    showInterstitialAd: function () {
      return requestAd("interstitial");
    },

    /**
     * Chia sẻ game / khoe điểm. options: { text?, score? } → Promise<{ shared, method, reason? }>.
     * Trong hub: mở bảng chia sẻ của hub (link kèm mã mời của người chơi, có score → ảnh "Mình đạt X điểm").
     * Ngoài hub: bảng chia sẻ của máy hoặc copy link trang. Gọi từ thao tác của người chơi (bấm nút).
     */
    share: function (options) {
      return social("share", options);
    },

    /** Mời bạn bè: link riêng của người chơi; bạn bè tạo tài khoản qua link được tính vào init.invites.count */
    invite: function (options) {
      return social("invite", options);
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
