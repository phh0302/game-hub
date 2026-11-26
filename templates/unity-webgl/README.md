# Unity WebGL + Monlabs SDK

Chép thư mục `Assets/` vào project Unity (2021.3+). Gồm:

| File | Vai trò |
|---|---|
| `Assets/Plugins/WebGL/MonlabsHub.jslib` | Cầu nối C# → `window.GameHub` |
| `Assets/Monlabs/Scripts/MonlabsHub.cs` | API C#: `GameStart`, `GameOver`, `SaveState` / `LoadState`, `Track`, `ShowRewardedAd`, `Share`, `Invite`, sự kiện `Paused` / `Resumed` |
| `Assets/Monlabs/Scripts/ExampleGame.cs` | Ví dụ dùng |
| `Assets/WebGLTemplates/Monlabs/index.html` | Template WebGL đã nạp SDK, tắt Data Caching |

```bash
npx degit phh0302/game-hub/templates/unity-webgl my-unity-kit
```

## Cài đặt

1. Tạo GameObject tên **MonlabsHub** trong scene đầu tiên, gắn `MonlabsHub.cs`.
2. **Player Settings → Resolution and Presentation → WebGL Template: Monlabs**.
3. **Publishing Settings**: tắt **Data Caching**; Compression Brotli / Gzip / Disabled đều được (hub tự giải nén lúc upload, không cần Decompression Fallback).
4. Build WebGL vào `Build/WebGL`.
5. Thử không cần upload: phục vụ thư mục build (`npx serve Build/WebGL`) rồi mở https://play.monlabs.fun/developer/sandbox.
6. Đẩy lên: sửa `game` trong `monlabs.json` → `npx @monlabs/cli login` → `npx @monlabs/cli deploy --version 1.0.0`.

**PlayerPrefs không lưu được trên hub** (khung cách ly) – dùng `SaveState(JsonUtility.ToJson(data))` / `LoadState(cb)`.
Không có bí mật nào trong build. Token CLI để trong `MONLABS_TOKEN`, không commit.
