import { GameState, ActionState } from "./types";
import { JUMP_AIR_START } from "./constants";

// ── Double Jump Yardımcı Fonksiyonu ─────────────────────────────────────────
// Hem klavye hem fare girişinde aynı mantık kullanılır.

function tryDoubleJump(state: GameState, PHYSICS: any): void {
  if (state.keys.jump) return; // Tuş zaten basılıysa tekrar tetikleme

  const currentHeight     = state.jumpOriginY - state.y;
  const maxJumpHeight     = (PHYSICS.jumpForce * PHYSICS.jumpForce) / (2 * PHYSICS.gravity);
  const minDoubleJumpHeight = (PHYSICS.doubleJumpThreshold / Math.abs(PHYSICS.jumpForce)) * maxJumpHeight;

  if (
    state.isJumping &&
    state.canDoubleJump &&
    state.currentState === "jump" &&
    currentHeight >= minDoubleJumpHeight
  ) {
    state.canDoubleJump = false;
    state.jumpBuffered  = false;
    state.jumpOriginY   = state.y;
    state.vy            = PHYSICS.jumpForce;
    state.frameIndex    = JUMP_AIR_START;
    state.frameTimer    = 0;
  } else if (state.isJumping || state.isLanding) {
    state.jumpBuffered = true;
  }
}

export const setupInputs = (
  canvas: HTMLCanvasElement,
  state: GameState,
  triggerAttack: () => void,
  router: any,
  PHYSICS: any
) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.code;
    if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD", "ShiftLeft", "ShiftRight", "Space", "ArrowUp", "KeyW"].includes(key)) {
      state.inputType  = "keyboard";
      state.idleTimer  = 0;
      state.isIdleMode = false;
    }

    if (["ArrowLeft", "KeyA"].includes(key))  state.keys.left  = true;
    if (["ArrowRight", "KeyD"].includes(key)) state.keys.right = true;
    if (["ShiftLeft", "ShiftRight"].includes(key)) state.keys.shift = true;
    if (["Space", "ArrowUp", "KeyW"].includes(key)) {
      tryDoubleJump(state, PHYSICS);
      state.keys.jump = true;
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const key = e.code;
    if (["ArrowLeft", "KeyA"].includes(key))  state.keys.left  = false;
    if (["ArrowRight", "KeyD"].includes(key)) state.keys.right = false;
    if (["ShiftLeft", "ShiftRight"].includes(key)) state.keys.shift = false;
    if (["Space", "ArrowUp", "KeyW"].includes(key)) state.keys.jump = false;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (state.autoPilotTarget) {
      state.mouseX = e.clientX;
      state.mouseY = e.clientY;
      return;
    }
    if (Math.abs(state.mouseX - e.clientX) > 2 || Math.abs(state.mouseY - e.clientY) > 2) {
      state.inputType  = "mouse";
      state.idleTimer  = 0;
      state.isIdleMode = false;
    }
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  };

  const handleMouseDown = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect) {
      // Küp patlama mantığı
      for (const cube of state.cubes) {
        const cx   = (canvas.width / 2) + cube.x;
        const cy   = canvas.height + cube.y;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (dist < 100) {
          cube.vx += (cube.x - (e.clientX - (canvas.width / 2))) * 10;
          cube.vy -= 800;
          cube.angularVelocity += (Math.random() - 0.5) * 20;
        }
      }
    }

    const target = e.target as HTMLElement;
    if (!target.closest('.platform-box') && !target.closest('a') && !target.closest('button')) {
      tryDoubleJump(state, PHYSICS);
      state.keys.jump = true;
    }
  };

  const handleMouseUp = () => {
    state.keys.jump = false;
  };

  window.addEventListener("keydown",   handleKeyDown);
  window.addEventListener("keyup",     handleKeyUp);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mouseup",   handleMouseUp);

  return () => {
    window.removeEventListener("keydown",   handleKeyDown);
    window.removeEventListener("keyup",     handleKeyUp);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup",   handleMouseUp);
  };
};
