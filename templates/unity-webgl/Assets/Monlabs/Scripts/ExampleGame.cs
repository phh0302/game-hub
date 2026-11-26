using UnityEngine;
using Monlabs;

/// <summary>Ví dụ dùng MonlabsHub: gắn vào 1 GameObject bất kỳ, nối các hàm vào nút UI.</summary>
public class ExampleGame : MonoBehaviour
{
    [System.Serializable] class Progress { public int best; public int plays; }

    Progress progress = new Progress();
    int score;

    void Start()
    {
        var hub = MonlabsHub.Instance;
        hub.Paused += () => Time.timeScale = 0;
        hub.Resumed += () => Time.timeScale = 1;
        hub.LoadState(json => { if (!string.IsNullOrEmpty(json)) progress = JsonUtility.FromJson<Progress>(json); });
    }

    public void OnPlayButton() { score = 0; MonlabsHub.Instance.GameStart(); MonlabsHub.Instance.Track("run_start"); }
    public void AddPoint() { score++; }

    public void OnDied()
    {
        var hub = MonlabsHub.Instance;
        if (hub.Data != null && hub.Data.ads.rewarded)
        {
            hub.ShowRewardedAd(r => { if (r.rewarded) Revive(); else Finish(); });
            return;
        }
        Finish();
    }

    void Revive() { /* cho người chơi tiếp tục */ }

    void Finish()
    {
        progress.plays++;
        if (score > progress.best) progress.best = score;
        MonlabsHub.Instance.SaveState(JsonUtility.ToJson(progress)); // PlayerPrefs không lưu được trên hub
        MonlabsHub.Instance.Track("run_end", "{\"score\":" + score + "}");
        MonlabsHub.Instance.GameOver(score, r => Debug.Log(r.saved ? "Đã lưu điểm" : "Không lưu: " + r.code));
    }

    public void OnShareButton() => MonlabsHub.Instance.Share("", score);
    public void OnInviteButton() => MonlabsHub.Instance.Invite();
}
