import { defineConfig } from "vite";

export default defineConfig({
  // Hub phục vụ game trong thư mục con → bắt buộc đường dẫn tương đối
  base: "./",
  build: { outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
});
