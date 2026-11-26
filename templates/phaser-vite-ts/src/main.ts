import Phaser from "phaser";
import { hub } from "./hub";
import { PlayScene } from "./scenes/PlayScene";

async function boot() {
  await hub.init();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#0b0b16",
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    physics: { default: "arcade", arcade: { debug: false } },
    scene: [PlayScene],
  });
  // Hub tạm dừng khi người chơi rời tab / mở bảng chia sẻ
  hub.onPause(() => game.scene.getScenes(true).forEach((s) => s.scene.pause()));
  hub.onResume(() => game.scene.getScenes(false).forEach((s) => s.scene.isPaused() && s.scene.resume()));
}

void boot();
