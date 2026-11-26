// Kiểu dữ liệu cho @monlabs/sdk (Game Hub SDK v3). Tài liệu: https://docs.monlabs.fun/sdk

export type Locale = "vi" | "en";

export interface Player {
  displayName: string;
}

export interface InitData {
  protocolVersion: number;
  /** true khi mở game trực tiếp (không trong hub, không có projectKey) */
  standalone: boolean;
  locale: Locale;
  player: Player | null;
  /** Điểm sẽ được lưu khi gọi gameOver() */
  canSubmitScore: boolean;
  /** Loại quảng cáo đang có – false thì ẩn nút "xem quảng cáo" */
  ads: { rewarded: boolean; interstitial: boolean };
  /** Có bảng chia sẻ / mời bạn không */
  social: { share: boolean; invite: boolean };
  /** Bạn đã mời (tổng / qua game này), ai mời người chơi này; null = chưa kết nối ví */
  invites: { count: number; viaGame: number; invitedBy: string | null } | null;
}

export interface InitOptions {
  /** Chế độ độc lập (game chạy trên domain riêng): API key công khai pk_… của game – được phép lộ, giới hạn theo domain */
  projectKey?: string;
  /** Địa chỉ hub (mặc định https://play.monlabs.fun) */
  apiBase?: string;
  locale?: string;
}

export interface ScoreResult {
  saved: boolean;
  /** Mã lỗi khi không lưu: LOGIN_REQUIRED, PLAY_TOO_SHORT, SCORE_TOO_HIGH, TIMEOUT… */
  code: string | null;
  message?: string;
  score?: number;
  best?: number;
  rank?: number | null;
  isPersonalBest?: boolean;
  [key: string]: unknown;
}

export interface GameOverOptions {
  /** Slug bảng xếp hạng (mặc định "default") */
  leaderboard?: string;
}

export interface SaveResult {
  saved: boolean;
  /** STATE_TOO_LARGE (> 64KB), STATE_INVALID, STORAGE_UNAVAILABLE… */
  code: string | null;
}

export interface AdResult {
  shown: boolean;
  rewarded: boolean;
  reason?: "NO_ADS" | "SKIPPED" | "TIMEOUT" | "STANDALONE" | string;
}

export interface ShareOptions {
  /** Tối đa 200 ký tự */
  text?: string;
  /** Có điểm → link chia sẻ hiện ảnh "Mình đạt X điểm" */
  score?: number;
}

export interface ShareResult {
  shared: boolean;
  method: "copy" | "native" | "facebook" | "x" | "telegram" | null;
  reason?: "UNSUPPORTED" | "CANCELLED" | "TIMEOUT" | string;
}

export type TrackProps = Record<string, string | number | boolean>;

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  [key: string]: unknown;
}

export interface GameHubEvents {
  init: InitData;
  scoreResult: ScoreResult;
  pause: undefined;
  resume: undefined;
}

export interface GameHubSDK {
  readonly version: number;
  /** Gọi 1 lần khi game tải xong */
  init(options?: InitOptions): Promise<InitData>;
  /** Bắt đầu 1 ván (hub bắt đầu tính thời gian). Chế độ độc lập: Promise<sessionId | null> */
  gameStart(): void | Promise<string | null>;
  /** Hết ván: nộp điểm (số nguyên ≥ 0) */
  gameOver(score: number, options?: GameOverOptions): Promise<ScoreResult>;
  /** Lưu tiến trình (JSON ≤ 64KB) theo tài khoản / khách – thay cho localStorage (bị chặn trong hub) */
  saveState<T = unknown>(data: T): Promise<SaveResult>;
  loadState<T = unknown>(): Promise<T | null>;
  /** Ghi sự kiện (tên: chữ, số, _ . : - ≤ 64 ký tự; props ≤ 10 khóa) */
  track(name: string, props?: TrackProps): void;
  flush(): Promise<{ sent: number }>;
  showRewardedAd(): Promise<AdResult>;
  showInterstitialAd(): Promise<AdResult>;
  /** Mở bảng chia sẻ (gọi từ thao tác của người chơi) */
  share(options?: ShareOptions): Promise<ShareResult>;
  /** Mời bạn bè bằng link riêng của người chơi */
  invite(options?: { text?: string }): Promise<ShareResult>;
  on<K extends keyof GameHubEvents>(event: K, cb: (data: GameHubEvents[K]) => void): void;
  getInitData(): InitData | null;
  /** Chế độ độc lập: đăng nhập ví (hoặc { guest: true }) */
  login(options?: { guest?: boolean }): Promise<Player>;
  logout(): Promise<void>;
  me(): Promise<{ player: Player; best?: number } | null>;
  leaderboard(options?: { board?: string; period?: "all" | "week" | "day"; limit?: number }): Promise<{ entries: LeaderboardEntry[] }>;
  leaderboards(): Promise<{ slug: string; name: string }[]>;
}

export declare const GameHub: GameHubSDK;
export default GameHub;

declare global {
  interface Window {
    GameHub?: GameHubSDK;
  }
}
