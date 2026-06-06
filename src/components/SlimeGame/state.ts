import { GameState } from "./types";

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
    prevFrameIndex: savedPos ? 0 : 6,
    frameTimer: 0,
    keys: { left: false, right: false, shift: false, jump: false },
    mouseX: 0,
    mouseY: 0,
    inputType: "none",
    isJumping: savedPos ? false : true,
    canDoubleJump: false,
    isPreparingJump: false,
    isLanding: false,
    jumpBuffered: false,
    jumpOriginY: 0,
    landingGraceTimer: 0,
    isAttacking: false,
    isRunStarting: false,
    isRunStopping: false,
    isRunSlowingToWalk: false,
    activeBox: null,
    prevActiveBox: null,
    autoPilotTarget: null,
    autoPilotRoute: null,
    autoPilotLocked: false,
    boxSquish: { about: 0, projects: 0, cv: 0 },
    boxSquishVelocity: { about: 0, projects: 0, cv: 0 },
    lastLandingVy: 0,
    attackCombo: 0,
    comboResetTimer: 0,
    cubeImg: null,
    cubes: [],
  };
};
