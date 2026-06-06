import { GameState } from "./types";
import { ANIMATIONS, PHYSICS } from "./constants";

export const updateAnimation = (state: GameState, dt: number) => {
  const config = ANIMATIONS[state.currentState];
  if (!config) return;

  // Havadayken (vy'ye bağlı özel mantık)
  if (state.currentState === "jump" && state.isJumping) {
    if (state.vy < -250) {
      // Yükselişte: 3, 4, 5. frameler (Index 2, 3, 4)
      state.frameTimer += dt;
      if (state.frameTimer >= (1 / config.frameRate)) {
        state.frameTimer = 0;
        if (state.frameIndex < 2) state.frameIndex = 2;
        else if (state.frameIndex < 4) state.frameIndex++;
      }
    } else if (state.vy > 250) {
      // Düşüşte: 7. frame (Index 6)
      state.frameIndex = 6;
    } else {
      // Zirve noktasında: 6. frame (Index 5)
      state.frameIndex = 5;
    }
    return; // Havadayken normal animasyon döngüsünü pas geç
  }

  const frameDuration = 1 / config.frameRate;
  state.frameTimer += dt;

  if (state.frameTimer >= frameDuration) {
    state.frameTimer = 0;

    // Start animasyonu TERS oynatma (run → walk geçişi)
    if (state.isRunSlowingToWalk && state.currentState === "start") {
      if (state.frameIndex > 0) {
        state.frameIndex--;
      } else {
        state.isRunSlowingToWalk = false;
        state.frameIndex = 0;
      }
      return;
    }

    if (state.currentState === "jump") {
      if (state.isPreparingJump) {
        // Yerdeki hazırlık evresi: ilk 2 kareyi oynat (Index 0 ve 1)
        state.frameIndex++;
        if (state.frameIndex === 2) {
          // 3. kareye (Index 2) geldiğinde tam zıplama gücünü uygula ve havaya kalk!
          state.isPreparingJump = false;
          state.isJumping = true;
          state.canDoubleJump = true; // Double jump hakkı verildi
          state.vy = PHYSICS.jumpForce;
        }
      } else if (state.isLanding) {
        // Yere değdik: 8'den 11'e kadar ilerle (Index 7'den 10'a)
        if (state.frameIndex < 10) {
          state.frameIndex++;
        } else {
          state.isLanding = false; // İniş animasyonu bitti
        }
      }
    } else {
      // Diğer animasyonlar için standart oynatma
      state.frameIndex++;

      // Animasyon bitişi kontrolü
      if (state.frameIndex >= config.frames) {
        if (config.loop) {
          state.frameIndex = 0;
        } else {
          state.frameIndex = config.frames - 1; // Son karede kal

          // Tek seferlik aksiyon bittiyse normale dön
          if (state.isAttacking) {
            state.isAttacking = false;
            state.comboResetTimer = 0.5;
          }
          // Start animasyonu bitti (ileri) → run-start kilidini kaldır
          if (state.currentState === "start" && state.isRunStarting) {
            state.isRunStarting = false;
          }
          // Stop animasyonu bitti → run-stop kilidini kaldır
          if (state.currentState === "stop") {
            state.isRunStopping = false;
          }
        }
      }
    }
  }
};
