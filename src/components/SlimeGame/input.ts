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

  // ── İvme Sensörü (DeviceOrientation) ────────────────────────────────────
  const TILT_DEADZONE = 3;   // ±3° → hareket yok
  const TILT_MAX      = 15;  // ±15° → tam hız + sprint

  const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
    // gamma: sola/sağa yatış açısı (-90 ila +90)
    const gamma = e.gamma ?? 0;

    state.inputType  = "touch";
    state.idleTimer  = 0;
    state.isIdleMode = false;

    const absGamma = Math.abs(gamma);

    if (absGamma < TILT_DEADZONE) {
      // Deadzone — hiç hareket yok
      state.keys.left  = false;
      state.keys.right = false;
      state.keys.shift = false;
    } else {
      const normalized = Math.min((absGamma - TILT_DEADZONE) / (TILT_MAX - TILT_DEADZONE), 1);
      state.keys.shift = normalized > 0.7;  // %70 eğimde sprint

      if (gamma < -TILT_DEADZONE) {
        state.keys.left  = true;
        state.keys.right = false;
      } else {
        state.keys.right = true;
        state.keys.left  = false;
      }
    }
  };

  // ── Mobil Dokunmatik: Zıplama ─────────────────────────────────────────────
  // Etkileşimli bir elemente tıklanıp tıklanmadığını kontrol eder.
  // data-no-jump attribute'u olan herhangi bir element de kapsam dışı.
  const isInteractiveTarget = (el: HTMLElement): boolean => {
    return !!(
      el.closest("a")                   ||
      el.closest("button")              ||
      el.closest("input")               ||
      el.closest("select")              ||
      el.closest("textarea")            ||
      el.closest("label")               ||
      el.closest("[role='button']")     ||
      el.closest("[role='link']")       ||
      el.closest("[data-no-jump]")
    );
  };

  let touchDidJump = false; // Bu dokunuşun zıplamayı tetikleyip tetiklemediğini izler

  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!isInteractiveTarget(target)) {
      touchDidJump = true;
      tryDoubleJump(state, PHYSICS);
      state.keys.jump  = true;
      state.inputType  = "touch";
      state.idleTimer  = 0;
      state.isIdleMode = false;
    } else {
      touchDidJump = false;
    }
  };

  const handleTouchEnd = () => {
    if (touchDidJump) {
      state.keys.jump = false;
      touchDidJump = false;
    }
  };

  // ── iOS 13+ İzin Akışı ────────────────────────────────────────────────────
  const startOrientationListener = async () => {
    // @ts-ignore — iOS 13+ exclusive API
    if (typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      try {
        // @ts-ignore
        const result = await (DeviceOrientationEvent as any).requestPermission();
        if (result === "granted") {
          window.addEventListener("deviceorientation", handleDeviceOrientation, true);
        }
      } catch {
        // İzin reddedildi veya desteklenmiyor — sessizce geç
      }
    } else {
      // Android veya izin gerektirmeyen tarayıcılar
      window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    }
  };

  // Sadece mobil cihazlarda sensörü aç
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    startOrientationListener();
  }

  window.addEventListener("keydown",    handleKeyDown);
  window.addEventListener("keyup",      handleKeyUp);
  window.addEventListener("mousemove",  handleMouseMove);
  window.addEventListener("mousedown",  handleMouseDown);
  window.addEventListener("mouseup",    handleMouseUp);
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("touchend",   handleTouchEnd,   { passive: true });

  return () => {
    window.removeEventListener("keydown",          handleKeyDown);
    window.removeEventListener("keyup",            handleKeyUp);
    window.removeEventListener("mousemove",        handleMouseMove);
    window.removeEventListener("mousedown",        handleMouseDown);
    window.removeEventListener("mouseup",          handleMouseUp);
    window.removeEventListener("touchstart",       handleTouchStart);
    window.removeEventListener("touchend",         handleTouchEnd);
    window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  };
};
