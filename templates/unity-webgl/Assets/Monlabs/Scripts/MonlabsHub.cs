using System;
using System.Runtime.InteropServices;
using UnityEngine;

namespace Monlabs
{
    [Serializable] public class Ads { public bool rewarded; public bool interstitial; }
    [Serializable] public class Social { public bool share; public bool invite; }
    [Serializable] public class Player { public string displayName; }
    [Serializable] public class Invites { public int count; public int viaGame; public string invitedBy; }

    [Serializable]
    public class InitData
    {
        public bool standalone;
        public string locale;
        public Player player;
        public bool canSubmitScore;
        public Ads ads;
        public Social social;
        public Invites invites;
    }

    [Serializable] public class ScoreResult { public bool saved; public string code; public string message; public int best; }
    [Serializable] public class AdResult { public bool shown; public bool rewarded; public string reason; }
    [Serializable] public class ShareResult { public bool shared; public string method; public string reason; }
    [Serializable] public class SaveResult { public bool saved; public string code; }

    /// <summary>
    /// Monlabs Game Hub SDK cho Unity WebGL. Đặt script này lên 1 GameObject tên "MonlabsHub" trong scene đầu tiên.
    /// Trong Editor / nền tảng khác: các hàm chạy rỗng, callback trả giá trị mặc định – game vẫn chạy bình thường.
    /// PlayerPrefs KHÔNG lưu được trên hub → dùng SaveState / LoadState.
    /// </summary>
    public class MonlabsHub : MonoBehaviour
    {
        public static MonlabsHub Instance { get; private set; }
        public InitData Data { get; private set; }

        public event Action<InitData> Initialized;
        public event Action Paused;
        public event Action Resumed;

        Action<ScoreResult> _onScore;
        Action<string> _onLoad;
        Action<AdResult> _onAd;
        Action<ShareResult> _onShare;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void MonlabsInit(string go);
        [DllImport("__Internal")] static extern void MonlabsGameStart();
        [DllImport("__Internal")] static extern void MonlabsGameOver(int score, string board);
        [DllImport("__Internal")] static extern void MonlabsSaveState(string json);
        [DllImport("__Internal")] static extern void MonlabsLoadState();
        [DllImport("__Internal")] static extern void MonlabsTrack(string name, string propsJson);
        [DllImport("__Internal")] static extern void MonlabsShowRewardedAd();
        [DllImport("__Internal")] static extern void MonlabsShare(string text, int score);
        [DllImport("__Internal")] static extern void MonlabsInvite();
        const bool Web = true;
#else
        static void MonlabsInit(string go) { }
        static void MonlabsGameStart() { }
        static void MonlabsGameOver(int score, string board) { }
        static void MonlabsSaveState(string json) { }
        static void MonlabsLoadState() { }
        static void MonlabsTrack(string name, string propsJson) { }
        static void MonlabsShowRewardedAd() { }
        static void MonlabsShare(string text, int score) { }
        static void MonlabsInvite() { }
        const bool Web = false;
#endif

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            if (Web) MonlabsInit(gameObject.name);
            else OnInit(JsonUtility.ToJson(new InitData { standalone = true, locale = "en", ads = new Ads(), social = new Social() }));
        }

        public void GameStart() => MonlabsGameStart();

        /// <summary>Hết ván – điểm là số nguyên ≥ 0</summary>
        public void GameOver(int score, Action<ScoreResult> done = null, string leaderboard = "default")
        {
            _onScore = done;
            if (Web) MonlabsGameOver(Mathf.Max(0, score), leaderboard);
            else done?.Invoke(new ScoreResult { saved = false, code = "EDITOR" });
        }

        /// <summary>Lưu tiến trình (≤ 64KB). Dùng JsonUtility.ToJson(object) cho dữ liệu của bạn.</summary>
        public void SaveState(string json) => MonlabsSaveState(json);

        /// <summary>Đọc tiến trình – callback nhận chuỗi JSON (rỗng nếu chưa có)</summary>
        public void LoadState(Action<string> done)
        {
            _onLoad = done;
            if (Web) MonlabsLoadState(); else done?.Invoke("");
        }

        public void Track(string name, string propsJson = null) => MonlabsTrack(name, propsJson ?? "");

        public void ShowRewardedAd(Action<AdResult> done)
        {
            _onAd = done;
            if (Web) MonlabsShowRewardedAd(); else done?.Invoke(new AdResult { shown = false, rewarded = false, reason = "EDITOR" });
        }

        /// <summary>Mở bảng chia sẻ của hub – gọi từ nút người chơi bấm. score &lt; 0 = không kèm điểm.</summary>
        public void Share(string text = "", int score = -1, Action<ShareResult> done = null) { _onShare = done; MonlabsShare(text ?? "", score); }
        public void Invite(Action<ShareResult> done = null) { _onShare = done; MonlabsInvite(); }

        // ───── callback từ .jslib (SendMessage) ─────
        void OnInit(string json) { Data = JsonUtility.FromJson<InitData>(json); Initialized?.Invoke(Data); }
        void OnPause(string _) { Paused?.Invoke(); }
        void OnResume(string _) { Resumed?.Invoke(); }
        void OnScoreResult(string json) { var cb = _onScore; _onScore = null; cb?.Invoke(JsonUtility.FromJson<ScoreResult>(json)); }
        void OnStateLoaded(string json) { var cb = _onLoad; _onLoad = null; cb?.Invoke(json); }
        void OnStateSaved(string json) { }
        void OnAdResult(string json) { var cb = _onAd; _onAd = null; cb?.Invoke(JsonUtility.FromJson<AdResult>(json)); }
        void OnShareResult(string json) { var cb = _onShare; _onShare = null; cb?.Invoke(JsonUtility.FromJson<ShareResult>(json)); }
    }
}
