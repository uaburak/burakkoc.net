import { GameState } from "./types";
import { BOXES } from "./constants";

export const getInitialState = (theme: string): GameState => {
  const savedPos = typeof window !== 'undefined'
    ? (() => {
        try {
          const raw = sessionStorage.getItem('slime_pos');
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })()
    : null;

  return {
    images: {
      light: {},
      dark: {},
    },
    theme: theme,
    loaded: false,
    x: savedPos?.x ?? 0,
    y: savedPos ? savedPos.y : -1200, // Kayıtlı pozisyon varsa oradan, yoksa yukarıdan düşsün
    vx: 0,
    vy: 0,
    direction: savedPos?.dir ?? 1,
    currentState: (savedPos ? "idle" : "jump"),
    frameIndex: savedPos ? 0 : 6,
    frameTimer: 0,
    keys: { left: false, right: false, shift: false, jump: false },
    mouseX: 0,
    mouseY: 0,
    inputType: "none",
    isJumping: savedPos ? false : true,
    canDoubleJump: false,
    isLanding: false,
    jumpBuffered: false,
    jumpOriginY: 0,
    landingGraceTimer: 0,
    isAttacking: false,
    runPhase: null,
    pendingRunDirection: 1,
    activeBox: null,
    autoPilotTarget: null,
    autoPilotRoute: null,
    autoPilotLocked: false,
    // boxSquish ve boxSquishVelocity BOXES'dan dinamik olarak üretilir
    boxSquish: Object.fromEntries(BOXES.map((b) => [b.id, 0])),
    boxSquishVelocity: Object.fromEntries(BOXES.map((b) => [b.id, 0])),
    attackCombo: 0,
    comboResetTimer: 0,
    cubes: [],
    idleTimer: 0,
    isIdleMode: false,
    idleWalkDir: 1,
  };
};
