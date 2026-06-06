const fs = require('fs');

// 1. Delete matterSetup.ts
if (fs.existsSync('src/components/SlimeGame/matterSetup.ts')) {
    fs.unlinkSync('src/components/SlimeGame/matterSetup.ts');
}

// 2. Update types.ts
let types = fs.readFileSync('src/components/SlimeGame/types.ts', 'utf8');
types = types.replace(/import Matter from "matter-js";\n/, '');
types = types.replace(/  matterCubes: Matter\.Body\[\];\n/, '');
types = types.replace(/  matterCharacter: Matter\.Body \| null;\n/, '');
types = types.replace(/  matterFloor: Matter\.Body \| null;\n/, '');
types = types.replace(/  matterBoxes: Record<string, Matter\.Body>;\n/, '');
if (!types.includes("export interface Cube {")) {
  types += `
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
`;
}
types = types.replace(/  cubeImg: HTMLImageElement \| null;\n/, '  cubeImg: HTMLImageElement | null;\n  cubes: Cube[];\n');
fs.writeFileSync('src/components/SlimeGame/types.ts', types);

// 3. Update state.ts
let stateStr = fs.readFileSync('src/components/SlimeGame/state.ts', 'utf8');
stateStr = stateStr.replace(/    matterCubes: \[\],\n/, '');
stateStr = stateStr.replace(/    matterCharacter: null,\n/, '');
stateStr = stateStr.replace(/    matterFloor: null,\n/, '');
stateStr = stateStr.replace(/    matterBoxes: \{\},\n/, '');
stateStr = stateStr.replace(/    cubeImg: null,\n/, '    cubeImg: null,\n    cubes: [],\n');
fs.writeFileSync('src/components/SlimeGame/state.ts', stateStr);

// 4. Update input.ts
let inputStr = fs.readFileSync('src/components/SlimeGame/input.ts', 'utf8');
inputStr = inputStr.replace(/import Matter from "matter-js";\n/, '');
inputStr = inputStr.replace(/  matterEngine: Matter\.Engine,\n/, '');
inputStr = inputStr.replace(/      for \(const cubeBody of state\.matterCubes\) \{[\s\S]+?\}\n/g, `
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
`);
fs.writeFileSync('src/components/SlimeGame/input.ts', inputStr);

// 5. Update index.tsx
let indexStr = fs.readFileSync('src/components/SlimeGame/index.tsx', 'utf8');
indexStr = indexStr.replace(/import Matter from "matter-js";\n/, '');
indexStr = indexStr.replace(/import \{ initMatterEngine \} from "\.\/matterSetup";\n/, '');
indexStr = indexStr.replace(/  const matterEngineRef = useRef<Matter\.Engine \| null>\(null\);\n/, '');
indexStr = indexStr.replace(/    \/\/ Initialize Matter Physics\n    matterEngineRef\.current = initMatterEngine\(state\);\n\n    return \(\) => \{\n      if \(matterEngineRef\.current\) \{\n        Matter\.Engine\.clear\(matterEngineRef\.current\);\n      \}\n    \};\n/g, `
    // Initialize custom cubes
    state.cubes = Array.from({ length: 15 }).map((_, i) => ({
      x: (Math.random() - 0.5) * 800,
      y: -1000 - (i * 300) - Math.random() * 200,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      angularVelocity: 0,
      size: 48,
      active: true
    }));
`);
indexStr = indexStr.replace(/      if \(matterEngineRef\.current\) \{\n        updatePhysics\(state, safeDt, canvas, matterEngineRef\.current, router, changeState\);\n      \}\n/g, '      updatePhysics(state, safeDt, canvas, router, changeState, setActiveBox);\n');
indexStr = indexStr.replace(/      matterEngineRef\.current!,\n/g, '');
fs.writeFileSync('src/components/SlimeGame/index.tsx', indexStr);

// 6. Update renderer.ts
let rendererStr = fs.readFileSync('src/components/SlimeGame/renderer.ts', 'utf8');
rendererStr = rendererStr.replace(/        for \(const cubeBody of state\.matterCubes\) \{[\s\S]+?ctx\.restore\(\);\n        \}\n/g, `
        for (const cube of state.cubes) {
          const cx = (canvas.width / 2) + cube.x;
          const cy = canvas.height + cube.y;
          
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(cube.angle);
          ctx.drawImage(state.cubeImg, -cube.size/2, -cube.size/2, cube.size, cube.size);
          ctx.restore();
          
          // Debug hitbox for cubes
          ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - cube.size/2, cy - cube.size/2, cube.size, cube.size);
        }
`);
rendererStr = rendererStr.replace(/      const drawBodyHitbox = \(body: any\) => \{[\s\S]+?\}\n/g, '');
rendererStr = rendererStr.replace(/      if \(state\.matterCharacter\) drawBodyHitbox\(state\.matterCharacter\);\n      if \(state\.matterFloor\) drawBodyHitbox\(state\.matterFloor\);\n      state\.matterCubes\.forEach\(drawBodyHitbox\);\n      Object\.values\(state\.matterBoxes\)\.forEach\(drawBodyHitbox\);\n/g, `
      // Debug Hitbox for Character
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + dw/2 - 25, dy + dh - 50, 50, 50); // Character Hitbox 50x50
`);
fs.writeFileSync('src/components/SlimeGame/renderer.ts', rendererStr);

// 7. Extract original physics from oldSlime.tsx and add custom cubes logic
const oldSlime = fs.readFileSync('oldSlime.tsx', 'utf8');
const match = oldSlime.match(/const updatePhysics = \(dt: number\) => \{([\s\S]+?)\};\n\n    const updateAnimation/);
if (!match) throw new Error("Could not find updatePhysics in oldSlime.tsx");

let physicsBody = match[1];

// We need to pass state, canvas, router, changeState, setActiveBox as parameters
const newPhysicsFile = `import { GameState, ActionState } from "./types";
import { PHYSICS, ANIMATIONS, BOX_DEFAULT_HEIGHT, BOX_ACTIVE_HEIGHT, BOXES, SPRITE_SIZE, SCALE } from "./constants";

export const updatePhysics = (
  state: GameState, 
  dt: number, 
  canvas: HTMLCanvasElement, 
  router: any,
  changeState: (s: ActionState) => void,
  setActiveBox: (boxId: string | null) => void
) => {
  if (!state.loaded) return;

${physicsBody}

  // --- CUSTOM CUBES PHYSICS ---
  for (const cube of state.cubes) {
    if (cube.y > 100) {
      cube.y = -1000 - Math.random() * 500;
      cube.x = (Math.random() - 0.5) * 800;
      cube.vy = 0;
      cube.vx = 0;
      cube.angularVelocity = 0;
    }

    cube.vy += PHYSICS.gravity * dt * 0.5; // less gravity for cubes
    cube.x += cube.vx * dt;
    cube.y += cube.vy * dt;
    cube.angle += cube.angularVelocity * dt;

    let cubeGround = 0; // Default ground
    
    // Check collision with boxes
    for (const box of BOXES) {
      const boxTop = -box.height + state.boxSquish[box.id];
      const boxLeft = box.xOffset - box.width / 2;
      const boxRight = box.xOffset + box.width / 2;

      if (cube.x > boxLeft && cube.x < boxRight && cube.y + cube.size/2 >= boxTop && cube.y < boxTop + 20) {
         cubeGround = boxTop - cube.size/2;
         
         // If a cube hits the box, make it squish slightly
         if (cube.vy > 100) {
            state.boxSquishVelocity[box.id] += Math.min(cube.vy * 0.1, 50);
         }
      }
    }

    if (cube.y >= cubeGround) {
       cube.y = cubeGround;
       if (cube.vy > 50) {
         cube.vy *= -0.3; // bounce
       } else {
         cube.vy = 0;
       }
       cube.vx *= 0.8; // friction
       
       // Snap to 90 degrees
       const targetAngle = Math.round(cube.angle / (Math.PI / 2)) * (Math.PI / 2);
       const angleDiff = cube.angle - targetAngle;
       if (Math.abs(angleDiff) < 0.2 && Math.abs(cube.angularVelocity) < 0.5) {
         cube.angle = targetAngle;
         cube.angularVelocity = 0;
       } else {
         cube.angularVelocity *= 0.9; // damp
       }
    }
    
    // Air friction
    if (cube.y < cubeGround) {
       cube.vx *= 0.99;
    }
  }
};
`;

fs.writeFileSync('src/components/SlimeGame/physics.ts', newPhysicsFile);
console.log("Successfully removed Matter.js and restored pure custom physics!");
