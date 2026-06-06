
export type ActionState =
  | "idle"
  | "walk"
  | "run"
  | "start"
  | "stop"
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
  prevFrameIndex: number;
  frameTimer: number;
  keys: { left: boolean; right: boolean; shift: boolean; jump: boolean };
  mouseX: number;
  mouseY: number;
  inputType: "keyboard" | "mouse" | "none";
  isJumping: boolean;
  canDoubleJump: boolean;
  isPreparingJump: boolean;
  isLanding: boolean;
  jumpBuffered: boolean;
  jumpOriginY: number;
  landingGraceTimer: number;
  isAttacking: boolean;
  isRunStarting: boolean;
  isRunStopping: boolean;
  isRunSlowingToWalk: boolean;
  activeBox: string | null;
  prevActiveBox: string | null;
  autoPilotTarget: string | null;
  autoPilotRoute: string | null;
  autoPilotLocked: boolean;
  boxSquish: Record<string, number>;
  boxSquishVelocity: Record<string, number>;
  lastLandingVy: number;
  attackCombo: number;
  comboResetTimer: number;
  cubeImg: HTMLImageElement | null;
  cubes: Cube[];
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
