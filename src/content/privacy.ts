// Chính sách quyền riêng tư cho người chơi (bản nháp – nên nhờ luật sư rà soát trước khi vận hành thương mại).
// Google AdSense yêu cầu trang này nêu rõ quảng cáo bên thứ ba dùng cookie.

type Policy = { title: string; updated: string; intro: string; sections: { heading: string; items: string[] }[] };

export const PRIVACY: Record<"vi" | "en", Policy> = {
  vi: {
    title: "Chính sách quyền riêng tư",
    updated: "27/11/2026",
    intro: "Trang này giải thích Game Hub (play.monlabs.fun) thu thập những gì khi bạn chơi game và dùng chúng vào việc gì.",
    sections: [
      {
        heading: "1. Dữ liệu chúng tôi lưu",
        items: [
          "Địa chỉ ví khi bạn đăng nhập bằng ví (chúng tôi không bao giờ giữ khóa riêng hay cụm từ khôi phục).",
          "Tên hiển thị, ảnh đại diện bạn tự đặt; điểm số, lượt chơi, tiến trình game đã lưu, phòng chơi bạn tham gia.",
          "Người đã mời bạn (khi bạn mở link mời) và số bạn bè bạn đã mời.",
          "Nội dung góp ý / liên hệ bạn gửi kèm email bạn cung cấp.",
          "Địa chỉ IP và thông tin trình duyệt trong nhật ký máy chủ – dùng để chống gian lận, chặn tấn công, giữ trong thời gian ngắn.",
        ],
      },
      {
        heading: "2. Cookie và bộ nhớ trình duyệt",
        items: [
          "Cookie đăng nhập, chống giả mạo yêu cầu (CSRF), ngôn ngữ và mã mời – cần để trang hoạt động.",
          "Bộ nhớ trình duyệt (localStorage) lưu tạm tiến trình game khi bạn chưa đăng nhập và lựa chọn xác nhận độ tuổi.",
        ],
      },
      {
        heading: "3. Quảng cáo",
        items: [
          "Một số game có quảng cáo do Google cung cấp (Google H5 Games Ads / AdSense). Bên thứ ba như Google dùng cookie để hiển thị quảng cáo dựa trên các lần bạn truy cập trang này và các trang khác.",
          "Google dùng cookie quảng cáo để Google và đối tác hiển thị quảng cáo phù hợp. Bạn có thể tắt quảng cáo cá nhân hóa tại https://adssettings.google.com và tìm hiểu thêm tại https://policies.google.com/technologies/ads.",
          "Người dùng ở khu vực yêu cầu sự đồng ý (EU, Anh, Thụy Sĩ…) sẽ được hỏi trước khi dùng cookie quảng cáo.",
          "Quảng cáo thưởng chỉ hiện khi bạn tự bấm xem trong game; bạn có thể đóng bất cứ lúc nào (khi đó không nhận thưởng).",
        ],
      },
      {
        heading: "4. Chia sẻ dữ liệu",
        items: [
          "Chúng tôi không bán dữ liệu cá nhân.",
          "Bảng xếp hạng công khai hiện tên hiển thị và điểm của bạn.",
          "Nhà phát triển game nhận số liệu tổng hợp (lượt chơi, sự kiện, lượt xem quảng cáo) và, nếu game dùng Server API, mã người chơi, tên hiển thị, địa chỉ ví công khai và điểm của người chơi game đó.",
          "Nhà cung cấp hạ tầng (máy chủ, cơ sở dữ liệu, lưu trữ file, gửi email) xử lý dữ liệu thay mặt chúng tôi.",
        ],
      },
      {
        heading: "5. Thời gian lưu và quyền của bạn",
        items: [
          "Dữ liệu tạm (nhật ký sự kiện, tài khoản khách không dùng, phòng chơi đã kết thúc) được tự động xóa theo lịch.",
          "Bạn có thể xóa tài khoản trong trang Hồ sơ – điểm số và dữ liệu gắn với tài khoản sẽ bị xóa.",
          "Câu hỏi về quyền riêng tư: gửi về admin@monlabs.fun.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy policy",
    updated: "27 Nov 2026",
    intro: "This page explains what Game Hub (play.monlabs.fun) collects when you play and what we use it for.",
    sections: [
      {
        heading: "1. Data we store",
        items: [
          "Your wallet address when you sign in with a wallet (we never hold private keys or recovery phrases).",
          "The display name and avatar you set; scores, plays, saved game progress and rooms you join.",
          "Who invited you (when you open an invite link) and how many friends you invited.",
          "Feedback / contact messages you send, with the email you provide.",
          "IP address and browser details in server logs – used against cheating and abuse, kept for a short time.",
        ],
      },
      {
        heading: "2. Cookies and browser storage",
        items: [
          "Sign-in, request-forgery protection (CSRF), language and invite-code cookies – needed for the site to work.",
          "Browser storage (localStorage) keeps game progress before you sign in and your age-confirmation choice.",
        ],
      },
      {
        heading: "3. Advertising",
        items: [
          "Some games show ads served by Google (Google H5 Games Ads / AdSense). Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites.",
          "Google's use of advertising cookies enables it and its partners to serve ads to you. You can opt out of personalised advertising at https://adssettings.google.com and learn more at https://policies.google.com/technologies/ads.",
          "Users in regions that require consent (EU, UK, Switzerland…) are asked before advertising cookies are used.",
          "Rewarded ads only appear when you choose to watch one in a game; you can close it at any time (without the reward).",
        ],
      },
      {
        heading: "4. Sharing",
        items: [
          "We don't sell personal data.",
          "Public leaderboards show your display name and scores.",
          "Game developers get aggregated numbers (plays, events, ad views) and, if the game uses the Server API, the player id, display name, public wallet address and scores of that game's players.",
          "Infrastructure providers (hosting, database, file storage, email) process data on our behalf.",
        ],
      },
      {
        heading: "5. Retention and your rights",
        items: [
          "Temporary data (event logs, unused guest accounts, finished rooms) is deleted automatically on a schedule.",
          "You can delete your account from your Profile – scores and data tied to the account are deleted.",
          "Privacy questions: admin@monlabs.fun.",
        ],
      },
    ],
  },
};
