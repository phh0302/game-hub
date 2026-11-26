// Quét tĩnh bản build khi upload: quảng cáo ngoài, đào coin, lừa ví / đòi seed phrase, chuyển hướng, mã rối, chữ spam.
// Hàm thuần (unit test được). Kết quả lưu vào phiên bản; mức "critical" chặn duyệt trừ khi admin xác nhận.

export type ScanSeverity = "critical" | "warning" | "info";
export type ScanFinding = { rule: string; severity: ScanSeverity; path: string; match: string; count: number };
export type ScanReport = { level: "clean" | ScanSeverity; findings: ScanFinding[]; scannedFiles: number; scannedBytes: number };

type Rule = { id: string; severity: ScanSeverity; re: RegExp; minCount?: number; files?: RegExp };

const TEXT_FILE = /\.(m?js|cjs|html?|css|json|txt|svg|xml|wasm\.js)$/i;
const MAX_FILE_SCAN = 5 * 1024 * 1024; // mỗi file quét tối đa 5MB đầu
const MAX_TOTAL_SCAN = 60 * 1024 * 1024;

const RULES: Rule[] = [
  // Đào tiền ảo bằng máy người chơi
  {
    id: "crypto_miner",
    severity: "critical",
    re: /coinhive|coin-hive|cryptonight|crypto-loot|jsecoin|webminepool|minero\.cc|deepminer|stratum\+tcp|xmrig|monerominer|coinimp|webmine\.cz/gi,
  },
  // Lừa ví: đòi cụm từ khôi phục / khóa riêng, hoặc gọi lệnh ký / chuyển tiền của ví
  {
    id: "wallet_phishing",
    severity: "critical",
    re: /seed\s*phrase|secret\s*recovery\s*phrase|recovery\s*phrase|mnemonic\s*phrase|private\s*key|cụm\s*từ\s*khôi\s*phục|khóa\s*riêng\s*tư/gi,
    files: /\.(html?|m?js|json)$/i,
  },
  {
    id: "wallet_drain",
    severity: "critical",
    re: /eth_sendTransaction|eth_sign\b|eth_signTypedData|personal_sign|setApprovalForAll|wallet_switchEthereumChain|increaseAllowance/g,
  },
  { id: "wallet_access", severity: "warning", re: /window\.ethereum|ethereum\.request\(|solana\.connect|tronWeb/g },
  // Mạng quảng cáo ngoài (hub tự quản lý quảng cáo – game không được tự gắn)
  {
    id: "ad_network",
    severity: "warning",
    re: /adsbygoogle|googlesyndication\.com|doubleclick\.net|adservice\.google|propellerads|popads\.net|popcash|adsterra|exoclick|juicyads|a-ads\.com|adnxs\.com|taboola|outbrain|mgid\.com|onclickads|hilltopads|monetag|admaven|clickadu|richads|ad-maven/gi,
  },
  // SDK quảng cáo của cổng game khác (game copy từ nơi khác)
  {
    id: "other_portal_sdk",
    severity: "warning",
    re: /gamedistribution\.com|html5\.api\.gamedistribution|sdk\.crazygames|crazygames-sdk|poki-sdk|game-cdn\.poki|y8\.com\/api|gamemonetize\.com|gamepix\.com/gi,
  },
  // Chuyển người chơi ra khỏi hub
  { id: "redirect", severity: "warning", re: /(?:window\.)?top\.location\s*(?:\.href\s*)?=|parent\.location\s*(?:\.href\s*)?=|top\.location\.replace\(/g },
  { id: "popup", severity: "info", re: /window\.open\s*\(/g, minCount: 3 },
  { id: "password_input", severity: "warning", re: /<input[^>]+type\s*=\s*["']?password/gi, files: /\.html?$/i },
  // Mã bị làm rối nặng (che giấu hành vi)
  { id: "obfuscated", severity: "warning", re: /_0x[0-9a-f]{4,6}/g, minCount: 300 },
  { id: "eval_payload", severity: "warning", re: /eval\s*\(\s*(?:atob|unescape|decodeURIComponent)\s*\(|new\s+Function\s*\(\s*atob\s*\(/g },
  // Chữ spam / cờ bạc / lừa đảo kiếm tiền
  {
    id: "gambling_spam",
    severity: "warning",
    re: /nhà\s*cái|cá\s*cược|tài\s*xỉu|nổ\s*hũ|lô\s*đề|xóc\s*đĩa|bắn\s*cá\s*đổi\s*thưởng|game\s*bài\s*đổi\s*thưởng|đổi\s*thưởng|casino|sportsbook|slot\s*online|free\s*usdt|airdrop\s*claim|claim\s*your\s*(?:reward|airdrop)|kiếm\s*tiền\s*online|nạp\s*tiền\s*nhận/gi,
    files: /\.(html?|json|txt)$/i,
  },
  { id: "short_link", severity: "info", re: /\b(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly|shorturl\.at|rb\.gy)\/[\w-]+/gi },
];

/** Script / iframe tải từ domain ngoài (CDN thư viện phổ biến thì bỏ qua) */
const EXTERNAL_SRC = /<(?:script|iframe)[^>]+src\s*=\s*["'](https?:)?\/\/([^/"']+)/gi;
const TRUSTED_CDN = /(^|\.)(play\.monlabs\.fun|monlabs\.fun|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/i;

const ORDER: Record<ScanSeverity, number> = { info: 1, warning: 2, critical: 3 };

function decode(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(data.subarray(0, MAX_FILE_SCAN));
}

function snippet(text: string, index: number, len: number): string {
  return text.slice(Math.max(0, index - 30), index + len + 30).replace(/\s+/g, " ").trim().slice(0, 160);
}

export function scanBuild(files: { path: string; data: Uint8Array }[], meta: string[] = []): ScanReport {
  const findings = new Map<string, ScanFinding>();
  const add = (rule: string, severity: ScanSeverity, path: string, match: string, n = 1, keyExtra = "") => {
    const key = `${rule}|${path}|${keyExtra}`;
    const f = findings.get(key);
    if (f) f.count += n;
    else findings.set(key, { rule, severity, path, match, count: n });
  };
  let scannedFiles = 0;
  let scannedBytes = 0;

  const scanText = (path: string, text: string) => {
    for (const rule of RULES) {
      if (rule.files && !rule.files.test(path)) continue;
      rule.re.lastIndex = 0;
      const matches = [...text.matchAll(rule.re)];
      if (matches.length === 0 || matches.length < (rule.minCount ?? 1)) continue;
      const first = matches[0]!;
      add(rule.id, rule.severity, path, snippet(text, first.index ?? 0, first[0].length), matches.length);
    }
    if (/\.html?$/i.test(path)) {
      EXTERNAL_SRC.lastIndex = 0;
      for (const m of text.matchAll(EXTERNAL_SRC)) {
        const host = m[2]!.toLowerCase();
        if (!TRUSTED_CDN.test(host)) add("external_script", "info", path, host, 1, host);
      }
    }
  };

  for (const f of files) {
    if (!TEXT_FILE.test(f.path) || scannedBytes >= MAX_TOTAL_SCAN) continue;
    const text = decode(f.data);
    scannedFiles++;
    scannedBytes += Math.min(f.data.byteLength, MAX_FILE_SCAN);
    scanText(f.path, text);
  }
  // Tên / mô tả game
  if (meta.length) scanText("(thông tin game).txt", meta.join("\n"));

  const list = [...findings.values()].sort((a, b) => ORDER[b.severity] - ORDER[a.severity] || b.count - a.count).slice(0, 50);
  const top = list[0]?.severity;
  return { level: top ?? "clean", findings: list, scannedFiles, scannedBytes };
}
