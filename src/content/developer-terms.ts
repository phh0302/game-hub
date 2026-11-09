// Nội dung Điều khoản người đăng game (bản nháp – nên nhờ luật sư rà soát trước khi vận hành thương mại).
// Sửa nội dung → nhớ đổi DEVELOPER_TERMS_VERSION trong src/modules/developer/terms.ts

type Terms = { title: string; intro: string; sections: { heading: string; items: string[] }[] };

export const DEVELOPER_TERMS: Record<"vi" | "en", Terms> = {
  vi: {
    title: "Điều khoản dành cho người đăng game",
    intro:
      "Khi tạo studio và đăng game lên Game Hub, bạn (nhà phát triển) đồng ý với các điều khoản dưới đây. Nếu đăng thay mặt một tổ chức, bạn xác nhận mình có quyền đại diện tổ chức đó.",
    sections: [
      {
        heading: "1. Quyền sở hữu nội dung",
        items: [
          "Bạn là tác giả của game hoặc có giấy phép hợp lệ cho toàn bộ mã nguồn, hình ảnh, âm thanh, font và tên gọi trong game.",
          "Không đăng game sao chép, giả mạo hoặc vi phạm bản quyền, nhãn hiệu của người khác.",
          "Bạn vẫn giữ toàn bộ quyền sở hữu game của mình.",
        ],
      },
      {
        heading: "2. Nội dung bị cấm",
        items: [
          "Cờ bạc, cá cược hoặc bất kỳ cơ chế nào đổi được ra tiền thật.",
          "Nội dung khiêu dâm, bạo lực cực đoan, kích động thù ghét, phân biệt đối xử hoặc vi phạm pháp luật Việt Nam.",
          "Lừa đảo, mã độc, đào tiền mã hóa, chuyển hướng người chơi sang trang lạ, tự ý hiển thị quảng cáo hoặc thu tiền bên ngoài Game Hub.",
          "Thu thập dữ liệu cá nhân của người chơi khi không được phép.",
        ],
      },
      {
        heading: "3. Yêu cầu kỹ thuật",
        items: [
          "Game chạy trong môi trường cô lập (sandbox) của Game Hub; không được tìm cách vượt qua môi trường này.",
          "Chỉ gửi điểm thật của người chơi qua Game Hub SDK; không gửi điểm giả hay thao túng bảng xếp hạng.",
          "Bản build phải đáp ứng yêu cầu trong tài liệu tích hợp SDK.",
        ],
      },
      {
        heading: "4. Quyền của Game Hub",
        items: [
          "Bạn cấp cho Game Hub quyền không độc quyền, miễn phí để lưu trữ, phát hành game trên Game Hub và dùng tên, ảnh bìa, mô tả game để giới thiệu.",
          "Game Hub được quyền từ chối duyệt, tạm khóa hoặc gỡ game, và xóa điểm có dấu hiệu gian lận, khi game vi phạm điều khoản hoặc nhận báo cáo vi phạm có căn cứ.",
          "Game Hub có thể thu thập số liệu lượt chơi, người chơi để thống kê và hiển thị cho bạn.",
        ],
      },
      {
        heading: "5. Doanh thu",
        items: [
          "Hiện Game Hub chưa có chương trình chia doanh thu. Khi có, sẽ áp dụng điều khoản riêng và bạn cần đồng ý trước khi tham gia.",
        ],
      },
      {
        heading: "6. Gỡ game và thay đổi điều khoản",
        items: [
          "Bạn có thể yêu cầu admin gỡ game của mình bất kỳ lúc nào.",
          "Khi điều khoản thay đổi, studio cần đồng ý phiên bản mới trước khi tạo game hoặc upload phiên bản tiếp theo.",
          "Khiếu nại bản quyền hoặc nội dung: dùng nút “Báo cáo” dưới mỗi game.",
        ],
      },
    ],
  },
  en: {
    title: "Developer Terms",
    intro:
      "By creating a studio and publishing games on Game Hub, you (the developer) agree to these terms. If you publish on behalf of an organization, you confirm you are authorized to represent it.",
    sections: [
      {
        heading: "1. Content ownership",
        items: [
          "You are the author of the game or hold valid licenses for all code, art, audio, fonts and names used in it.",
          "Do not publish copied or counterfeit games, or games that infringe others' copyrights or trademarks.",
          "You keep full ownership of your game.",
        ],
      },
      {
        heading: "2. Prohibited content",
        items: [
          "Gambling, betting or any mechanic that can be exchanged for real money.",
          "Sexual content, extreme violence, hate speech, discrimination or anything illegal under Vietnamese law.",
          "Scams, malware, crypto mining, redirecting players to other sites, or showing your own ads or taking payments outside Game Hub.",
          "Collecting players' personal data without permission.",
        ],
      },
      {
        heading: "3. Technical requirements",
        items: [
          "Games run inside Game Hub's sandbox; do not attempt to escape it.",
          "Only submit players' real scores through the Game Hub SDK; do not submit fake scores or manipulate leaderboards.",
          "Builds must meet the requirements in the SDK integration docs.",
        ],
      },
      {
        heading: "4. Game Hub's rights",
        items: [
          "You grant Game Hub a non-exclusive, royalty-free license to host and publish the game on Game Hub and to use its name, cover image and description to promote it.",
          "Game Hub may reject, suspend or remove games, and delete suspicious scores, when a game breaks these terms or receives a substantiated report.",
          "Game Hub may collect play and player statistics to show them to you.",
        ],
      },
      {
        heading: "5. Revenue",
        items: [
          "Game Hub does not currently offer revenue sharing. If it does, separate terms will apply and you will need to accept them before joining.",
        ],
      },
      {
        heading: "6. Removal and changes",
        items: [
          "You can ask an admin to remove your game at any time.",
          "When these terms change, your studio must accept the new version before creating games or uploading new versions.",
          "Copyright or content complaints: use the “Report” button under each game.",
        ],
      },
    ],
  },
};
