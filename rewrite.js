const fs = require('fs');

const code = fs.readFileSync('src/components/SlimeController.tsx', 'utf8');

// I will write a custom string replacer for the component body.
let indexCode = code;

// 1. Remove Constants, types, etc.
indexCode = indexCode.replace(/const SPRITE_SIZE[\s\S]*?const BOXES: any\[\] = \[\n  \/\/.*\n  \/\/.*\n  \/\/.*\n\];/m, "");

// Add imports
indexCode = `import Matter from "matter-js";
import { GameState, ActionState } from "./types";
import { PHYSICS, ANIMATIONS, BOX_DEFAULT_HEIGHT, BOX_ACTIVE_HEIGHT, BOXES, SCALE, SPRITE_SIZE } from "./constants";
import { getInitialState } from "./state";
import { initMatterEngine } from "./matterSetup";
import { updatePhysics } from "./physics";
import { updateAnimation } from "./animation";
import { renderGame } from "./renderer";
` + indexCode.replace(/import Matter from "matter-js";/g, "");

// Clean up unused imports later if needed.

// 2. Replace engineRef initial state
indexCode = indexCode.replace(
  /const engineRef = useRef\(\{[\s\S]*?matterFloor: null as Matter\.Body \| null,\n  \}\);/m,
  "const engineRef = useRef<GameState>(getInitialState(theme));"
);

// 3. Replace matterSetup
indexCode = indexCode.replace(
  /\/\/ --- Matter\.js Setup ---[\s\S]*?matterEngine = engine;/m,
  "matterEngine = initMatterEngine(state);"
);

// Write to SlimeGame/index.tsx
fs.writeFileSync('src/components/SlimeGame/index.tsx', indexCode);
console.log("Rewrote index.tsx");
