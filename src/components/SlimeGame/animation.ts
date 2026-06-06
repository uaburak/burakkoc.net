import { GameState } from "./types";
import { ANIMATIONS, PHYSICS, RUN_START_END, RUN_LOOP_START, RUN_LOOP_END, RUN_STOP_START, JUMP_AIR_START, JUMP_AIR_END, JUMP_LAND_START } from "./constants";

export const updateAnimation = (state: GameState, dt: number) => {
  const config = ANIMATIONS[state.currentState];
  if (!config) return;

  // ── JUMP animasyonu: 2 fazlı sistem (startup iptal) ─────────────
  if (state.currentState === "jump") {
    state.frameTimer += dt;
    if (state.frameTimer >= (1 / config.frameRate)) {
      state.frameTimer = 0;

      if (state.isJumping) {
        // Faz 1: Havada (JUMP_AIR_START - JUMP_AIR_END) — son frame'de bekle
        if (state.frameIndex < JUMP_AIR_END) {
          state.frameIndex++;
        }
        // JUMP_AIR_END'de kal: iniş gelene kadar
      } else if (state.isLanding) {
        // Faz 2: İniş (JUMP_LAND_START - son frame)
        if (state.frameIndex < config.frames - 1) {
          state.frameIndex++;
        } else {
          state.isLanding = false; // İniş animasyonu bitti
        }
      }
    }
    return;
  }
  // ─────────────────────────────────────────────────────────────────

  // ── RUN animasyonu: kendi timer'ı ile 3 fazlı sistem ─────────────
  if (state.currentState === "run") {
    const isTurnStop = state.runPhase === "stop" && state.pendingRunDirection !== 0;
    const frameRate = isTurnStop
      ? config.frameRate * PHYSICS.turnStopSpeedMult
      : config.frameRate;
    const frameDuration = 1 / frameRate;

    state.frameTimer += dt;
    if (state.frameTimer >= frameDuration) {
      state.frameTimer = 0;

      if (state.runPhase === "start") {
        if (state.frameIndex < RUN_START_END) {
          state.frameIndex++;
        } else {
          state.runPhase = "loop";
          state.frameIndex = RUN_LOOP_START;
        }
      } else if (state.runPhase === "loop") {
        state.frameIndex++;
        if (state.frameIndex > RUN_LOOP_END) {
          state.frameIndex = RUN_LOOP_START;
        }
      } else if (state.runPhase === "stop") {
        if (state.frameIndex < config.frames - 1) {
          state.frameIndex++;
        } else {
          if (state.pendingRunDirection !== 0) {
            state.direction = state.pendingRunDirection;
            state.pendingRunDirection = 0;
            state.runPhase = "start";
            state.frameIndex = 0;
          } else {
            state.runPhase = null;
          }
        }
      } else {
        state.runPhase = "loop";
        state.frameIndex = RUN_LOOP_START;
      }
    }
    return;
  }
  // ─────────────────────────────────────────────────────────────────

  // Diğer animasyonlar için standart oynatma
  const frameDuration = 1 / config.frameRate;
  state.frameTimer += dt;

  if (state.frameTimer >= frameDuration) {
    state.frameTimer = 0;
    state.frameIndex++;

    if (state.frameIndex >= config.frames) {
      if (config.loop) {
        state.frameIndex = 0;
      } else {
        state.frameIndex = config.frames - 1;
        if (state.isAttacking) {
          state.isAttacking = false;
          state.comboResetTimer = 0.5;
        }
      }
    }
  }
};
