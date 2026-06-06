
export type ActionState =
  | "idle"
  | "walk"
  | "run"
  | "jump"
  | "attack1"
  | "attack2"
  | "attack3"
  | "run_attack"
  | "hurt"
  | "dead";

export interface GameState {
  images: {
    light: Record<string, HTMLImageElement>;
    dark: Record<string, HTMLImageElement>;
  };
  theme: string;
  loaded: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: number;
  currentState: ActionState;
  frameIndex: number;
  frameTimer: number;
  keys: { left: boolean; right: boolean; shift: boolean; jump: boolean };
  mouseX: number;
  mouseY: number;
  inputType: "keyboard" | "mouse" | "none";
  isJumping: boolean;
  canDoubleJump: boolean;
  isLanding: boolean;
  jumpBuffered: boolean;
  jumpOriginY: number;
  landingGraceTimer: number;
  isAttacking: boolean;
  runPhase: "start" | "loop" | "stop" | null;
  pendingRunDirection: number; // Dönüş sonrası yeni yön (0 = tam dur)
  activeBox: string | null;
  autoPilotTarget: string | null;
  autoPilotRoute: string | null;
  autoPilotLocked: boolean;
  boxSquish: Record<string, number>;
  boxSquishVelocity: Record<string, number>;
  attackCombo: number;
  comboResetTimer: number;
  cubes: Cube[];
  // Idle otomasyon
  idleTimer: number;       // Son inputtan bu yana geçen süre
  isIdleMode: boolean;     // Otonom mod aktif mi
  idleWalkDir: number;     // Wolta için yön (-1 veya 1)
}

export interface Cube {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  size: number;
  active: boolean;
}
