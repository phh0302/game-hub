import Phaser from "phaser";
import { hub } from "../hub";

/** Né sao rơi: kéo / di chuột để di chuyển, mỗi sao né được +1 điểm */
export class PlayScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private stars!: Phaser.Physics.Arcade.Group;
  private score = 0;
  private alive = false;
  private revived = false;
  private label!: Phaser.GameObjects.Text;
  private panel?: Phaser.GameObjects.Container;
  private spawner?: Phaser.Time.TimerEvent;

  constructor() {
    super("play");
  }

  create() {
    const { width, height } = this.scale;
    this.player = this.add.circle(width / 2, height - 60, 18, 0x22e3ff);
    this.physics.add.existing(this.player);
    this.stars = this.physics.add.group();
    this.label = this.add.text(16, 16, "", { fontFamily: "system-ui", fontSize: "20px", color: "#ffffff" });
    this.physics.add.overlap(this.player, this.stars, () => this.hit());
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.alive) this.player.x = Phaser.Math.Clamp(p.x, 20, this.scale.width - 20);
    });
    this.showMenu(hub.vi ? "Chạm để chơi" : "Tap to play");
  }

  private start() {
    this.panel?.destroy();
    this.stars.clear(true, true);
    this.score = 0;
    this.revived = false;
    this.alive = true;
    hub.start();
    this.spawner = this.time.addEvent({ delay: 450, loop: true, callback: () => this.spawn() });
  }

  private spawn() {
    const x = Phaser.Math.Between(20, this.scale.width - 20);
    const star = this.add.star(x, -20, 5, 8, 16, 0xff3ec8);
    this.stars.add(star);
    (star.body as Phaser.Physics.Arcade.Body).setVelocityY(Phaser.Math.Between(180, 260 + this.score * 4));
  }

  update() {
    this.label.setText(`${hub.vi ? "Điểm" : "Score"}: ${this.score}   ${hub.vi ? "Kỷ lục" : "Best"}: ${hub.progress.best}`);
    for (const s of this.stars.getChildren() as Phaser.GameObjects.Star[]) {
      if (s.y > this.scale.height + 20) {
        s.destroy();
        if (this.alive) this.score++;
      }
    }
  }

  private async hit() {
    if (!this.alive) return;
    this.alive = false;
    this.spawner?.remove();
    this.physics.pause();
    if (!this.revived && hub.canRevive()) {
      this.revived = true;
      if (await hub.revive()) {
        this.stars.clear(true, true);
        this.physics.resume();
        this.alive = true;
        this.spawner = this.time.addEvent({ delay: 450, loop: true, callback: () => this.spawn() });
        return;
      }
    }
    const result = await hub.finish(this.score);
    this.physics.resume();
    this.showMenu(
      result.saved
        ? `${hub.vi ? "Đã lưu" : "Saved"}: ${this.score}`
        : result.code === "LOGIN_REQUIRED"
          ? hub.vi ? "Kết nối ví để lưu điểm" : "Connect a wallet to save"
          : `${this.score}`,
    );
  }

  private showMenu(title: string) {
    const { width, height } = this.scale;
    const c = this.add.container(width / 2, height / 2);
    const button = (y: number, text: string, onClick: () => void) => {
      const t = this.add.text(0, y, text, { fontFamily: "system-ui", fontSize: "22px", color: "#0b0b16", backgroundColor: "#22e3ff", padding: { x: 14, y: 8 } });
      t.setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerdown", (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        onClick();
      });
      c.add(t);
    };
    c.add(this.add.text(0, -90, title, { fontFamily: "system-ui", fontSize: "28px", color: "#ffffff" }).setOrigin(0.5));
    button(-20, hub.vi ? "Chơi" : "Play", () => this.start());
    if (hub.data?.social.share && this.score > 0) button(40, hub.vi ? "Khoe điểm" : "Share", () => void hub.share(this.score));
    if (hub.data?.social.invite) button(100, hub.vi ? "Mời bạn" : "Invite", () => void hub.invite());
    this.panel = c;
  }
}
