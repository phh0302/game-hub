// Một chỗ duy nhất làm việc với SDK – scene chỉ gọi các hàm ở đây.
import { GameHub, type InitData, type ScoreResult } from "@monlabs/sdk";

export type Progress = { best: number; plays: number; muted: boolean };
const DEFAULT: Progress = { best: 0, plays: 0, muted: false };

export const hub = {
  data: null as InitData | null,
  progress: { ...DEFAULT },

  async init(): Promise<InitData> {
    const projectKey = import.meta.env.VITE_MONLABS_PROJECT_KEY as string | undefined;
    // Trong hub: không cần projectKey. Domain riêng: cần API key công khai pk_…
    this.data = await GameHub.init(projectKey ? { projectKey } : undefined);
    GameHub.on("init", (d) => (this.data = d)); // đăng nhập / đổi ngôn ngữ
    const saved = await GameHub.loadState<Partial<Progress>>();
    if (saved && typeof saved === "object") this.progress = { ...DEFAULT, ...saved };
    return this.data;
  },

  get vi() {
    return (this.data?.locale ?? "vi") === "vi";
  },

  start() {
    void GameHub.gameStart();
    GameHub.track("run_start", { plays: this.progress.plays });
  },

  async finish(score: number): Promise<ScoreResult> {
    const s = Math.max(0, Math.floor(score));
    this.progress.plays++;
    if (s > this.progress.best) this.progress.best = s;
    void GameHub.saveState(this.progress); // thay cho localStorage (bị chặn trong hub)
    GameHub.track("run_end", { score: s });
    return GameHub.gameOver(s);
  },

  canRevive() {
    return this.data?.ads.rewarded === true;
  },
  async revive() {
    const r = await GameHub.showRewardedAd();
    return r.rewarded;
  },

  share(score: number) {
    return GameHub.share({ score, text: this.vi ? `Mình né được ${score} ngôi sao!` : `I dodged ${score} stars!` });
  },
  invite() {
    return GameHub.invite();
  },
  onPause(cb: () => void) {
    GameHub.on("pause", cb);
  },
  onResume(cb: () => void) {
    GameHub.on("resume", cb);
  },
};
