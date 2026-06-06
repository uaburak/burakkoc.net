import { GameState } from "./types";
import { ANIMATIONS, PHYSICS, SCALE, DISPLAY_SIZE } from "./constants";

export const renderGame = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: GameState
) => {
// Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!state.loaded) return;

      // CUBES DISABLED — uncomment to re-enable
      // if (state.cubeImg) {
      //   for (const cube of state.cubes) {
      //     const cx = (canvas.width / 2) + cube.x;
      //     const cy = canvas.height + cube.y;
      //     ctx.save();
      //     ctx.translate(cx, cy);
      //     ctx.rotate(cube.angle);
      //     ctx.drawImage(state.cubeImg, -cube.size/2, -cube.size/2, cube.size, cube.size);
      //     ctx.restore();
      //   }
      // }



      // Dinamik kaynak boyutu (Görsellerin çözünürlüğü farklı olabilir, örn: 512x512 veya 128x128)
      const config = ANIMATIONS[state.currentState];
      const themeKey = (state.theme || "light") as "light" | "dark";
      const img = state.images[themeKey]?.[state.currentState];
      if (!img) {
        ctx.fillStyle = "red";
        ctx.font = "20px sans-serif";
        ctx.fillText(`Error: Missing image for state '${state.currentState}'`, 20, 40);
        return;
      }

      // Dinamik kaynak boyutu (Görsellerin çözünürlüğü farklı olabilir, örn: 512x512 veya 128x128)
      const sw = img.width / config.frames;
      const sh = img.height;
      const sx = state.frameIndex * sw;
      const sy = 0;

      // Ekrana çizilecek boyut (DISPLAY_SIZE × SCALE)
      const dw = DISPLAY_SIZE * SCALE;
      const dh = DISPLAY_SIZE * SCALE;
      
      // Çizim koordinatları (Karakterin alt merkezi origin olacak şekilde)
      // footOffsetY: Sprite'taki şeffaf alt bölgeyi telafi ederek ayakları zemine oturtur
      const dx = (canvas.width / 2) + state.x - (dw / 2);
      const dy = canvas.height - dh + state.y + PHYSICS.footOffsetY;

      ctx.save();
      
      // Yön çevirme (Karakter sola bakıyorsa canvas'ı y ekseninde çevir)
      if (state.direction === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, -dx - dw, dy, dw, dh);
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      }

      ctx.restore();
    
};