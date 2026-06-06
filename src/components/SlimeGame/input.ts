import { GameState, ActionState } from "./types";

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
      state.inputType = "keyboard";
    }

    if (["ArrowLeft", "KeyA"].includes(key)) state.keys.left = true;
    if (["ArrowRight", "KeyD"].includes(key)) state.keys.right = true;
    if (["ShiftLeft", "ShiftRight"].includes(key)) state.keys.shift = true;
    if (["Space", "ArrowUp", "KeyW"].includes(key)) {
      if (!state.keys.jump) {
        const currentHeight = state.jumpOriginY - state.y;
        const maxJumpHeight = (PHYSICS.jumpForce * PHYSICS.jumpForce) / (2 * PHYSICS.gravity);
        const minDoubleJumpHeight = (PHYSICS.doubleJumpThreshold / Math.abs(PHYSICS.jumpForce)) * maxJumpHeight;
        
        if (
          state.isJumping && 
          state.canDoubleJump && 
          state.currentState === "jump" &&
          currentHeight >= minDoubleJumpHeight
        ) {
          state.canDoubleJump = false;
          state.jumpBuffered = false;
          state.jumpOriginY = state.y;
          state.vy = PHYSICS.jumpForce;
          state.frameIndex = 2;
          state.frameTimer = 0;
        } else if (state.isJumping || state.isLanding) {
          state.jumpBuffered = true;
        }
      }
      state.keys.jump = true;
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    const key = e.code;
    if (["ArrowLeft", "KeyA"].includes(key)) state.keys.left = false;
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
      state.inputType = "mouse";
    }
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;
  };

  const handleMouseDown = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      let clickedCube = false;

      for (const cube of state.cubes) {
        // Custom explosion logic for cubes
        const cx = (canvas.width / 2) + cube.x;
        const cy = canvas.height + cube.y;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (dist < 100) {
           cube.vx += (cube.x - (e.clientX - (canvas.width / 2))) * 10;
           cube.vy -= 800;
           cube.angularVelocity += (Math.random() - 0.5) * 20;
        }
      }
      
      if (clickedCube) return;
    }

    const target = e.target as HTMLElement;
    if (!target.closest('.platform-box') && !target.closest('a') && !target.closest('button')) {
      if (!state.keys.jump) {
        const currentHeight = state.jumpOriginY - state.y;
        const maxJumpHeight = (PHYSICS.jumpForce * PHYSICS.jumpForce) / (2 * PHYSICS.gravity);
        const minDoubleJumpHeight = (PHYSICS.doubleJumpThreshold / Math.abs(PHYSICS.jumpForce)) * maxJumpHeight;
        
        if (
          state.isJumping &&
          state.canDoubleJump &&
          state.currentState === "jump" &&
          currentHeight >= minDoubleJumpHeight
        ) {
          state.canDoubleJump = false;
          state.jumpBuffered = false;
          state.jumpOriginY = state.y;
          state.vy = PHYSICS.jumpForce;
          state.frameIndex = 2;
          state.frameTimer = 0;
        }
        else if (state.isJumping || state.isLanding) {
          state.jumpBuffered = true;
        }
      }
      state.keys.jump = true;
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    state.keys.jump = false;
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mouseup", handleMouseUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
  };
};
