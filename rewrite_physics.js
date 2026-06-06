const fs = require('fs');

const oldSlime = fs.readFileSync('oldSlime.tsx', 'utf8');

// Extract updatePhysics body from oldSlime.tsx
const match = oldSlime.match(/const updatePhysics = \(dt: number\) => \{([\s\S]+?)const updateAnimation =/);
if (!match) throw new Error("Could not find updatePhysics in oldSlime");

let physicsBody = match[1];

// Strip out the old squish physics and replace with Matter.js logic
const squishRegex = /\/\/\s*Squish fiziği: Tüm kutular için yay simülasyonu[\s\S]+?setActiveBox\(newActiveBox\);/m;
const matterSquishLogic = `
      // Y ekseninde Squish değerini hesapla ve state'e yaz ki UI tarafı çizebilsin
      for (const box of BOXES) {
        const matterBox = state.matterBoxes[box.id];
        if (!matterBox) continue;

        // Bulunduğumuz kutunun spring constraint'i
        const boxSpring = matterEngine.world.constraints.find(c => c.bodyB === matterBox);
        const isOnThisBox = (state.activeBox === box.id);
        const targetAnchorY = isOnThisBox ? (-box.height / 2) + 25 : (-box.height / 2);

        if (boxSpring && boxSpring.pointA) {
          // Anchor noktasını yumuşakça (lerp) aşağı/yukarı taşı
          boxSpring.pointA.y += (targetAnchorY - boxSpring.pointA.y) * 10 * dt;
        }
        
        state.boxSquish[box.id] = matterBox.position.y - (-box.height / 2);
      }

      // State değiştiyse React tarafını tetikle
      if (newActiveBox !== state.activeBox) {
        state.prevActiveBox = state.activeBox;
        state.activeBox = newActiveBox;
`;

physicsBody = physicsBody.replace(squishRegex, matterSquishLogic);

// Replace box Top calculations
physicsBody = physicsBody.replace(/const boxTop = -box\.height \+ state\.boxSquish\[box\.id\];/g, "const matterBox = state.matterBoxes[box.id];\n         if (!matterBox) continue;\n         const boxTop = matterBox.position.y - box.height / 2;");

// At the end, matterBody.setPosition
physicsBody = physicsBody.replace(/    \};\n$/, `
      if (state.matterCharacter) {
        Matter.Body.setPosition(state.matterCharacter, {
          x: state.x,
          y: state.y - 32
        });
      }

      if (matterEngine) {
        for (const cube of state.matterCubes) {
          if (cube.position.y > 100) {
            Matter.Body.setPosition(cube, { x: (Math.random() - 0.5) * 800, y: -1000 - Math.random() * 500 });
            Matter.Body.setVelocity(cube, { x: 0, y: 0 });
            Matter.Body.setAngularVelocity(cube, 0);
          }
          
          const speed = Math.sqrt(cube.velocity.x ** 2 + cube.velocity.y ** 2);
          if (speed > 15) {
            Matter.Body.setVelocity(cube, { x: cube.velocity.x * 0.95, y: cube.velocity.y * 0.95 });
          }
          
          if (Math.abs(cube.velocity.x) > 5) {
            Matter.Body.setVelocity(cube, { x: Math.sign(cube.velocity.x) * 5, y: cube.velocity.y });
          }
        }
        Matter.Engine.update(matterEngine, dt * 1000);
      }
    };
`);

const finalCode = `import Matter from "matter-js";
import { GameState, ActionState } from "./types";
import { PHYSICS, ANIMATIONS, BOX_DEFAULT_HEIGHT, BOX_ACTIVE_HEIGHT, BOXES, SPRITE_SIZE, SCALE } from "./constants";

export const updatePhysics = (
  state: GameState, 
  dt: number, 
  canvas: HTMLCanvasElement, 
  matterEngine: Matter.Engine,
  router: any,
  changeState: (s: ActionState) => void
) => {
  if (!state.loaded) return;
` + physicsBody;

fs.writeFileSync('src/components/SlimeGame/physics.ts', finalCode);
console.log("Rewrote physics.ts successfully");
