const fs = require('fs');

const code = `import Matter from "matter-js";
import { GameState, ActionState } from "./types";
import { PHYSICS, ANIMATIONS, BOXES, SPRITE_SIZE, SCALE } from "./constants";

export const updatePhysics = (
  state: GameState, 
  dt: number, 
  canvas: HTMLCanvasElement, 
  matterEngine: Matter.Engine,
  router: any,
  changeState: (s: ActionState) => void
) => {
  if (!state.loaded || !state.matterCharacter) return;

  const charBody = state.matterCharacter;

  // Constants adjusted for Matter.js tick scale (approx 60 ticks per second)
  const TICK_RATE = 60;
  const walkSpeed = PHYSICS.walkSpeed / TICK_RATE;
  const runSpeed = PHYSICS.runSpeed / TICK_RATE;
  const jumpVelocity = PHYSICS.jumpForce / TICK_RATE;
  
  let moveDir = 0;
  
  if (state.inputType === "mouse") {
    // Note: state.x is character's x. (canvas.width / 2) is screen center
    const characterScreenX = (canvas.width / 2) + charBody.position.x;
    const diffX = state.mouseX - characterScreenX;
    if (Math.abs(diffX) > PHYSICS.mouseWalkDistance) {
      moveDir = Math.sign(diffX);
    }
  } else if (state.inputType === "keyboard") {
    if (state.keys.left) moveDir = -1;
    if (state.keys.right) moveDir = 1;
  }

  // AutoPilot Logic
  if (state.autoPilotTarget) {
    const targetBox = BOXES.find(b => b.id === state.autoPilotTarget);
    if (targetBox) {
      const targetX = targetBox.xOffset;
      const dx = targetX - charBody.position.x;
      
      const boxLeft = targetX - (targetBox.width / 2);
      const boxRight = targetX + (targetBox.width / 2);
      // Top of box in Matter space: -targetBox.height
      const charBottom = charBody.position.y + 32; // height is 64
      
      const isOnTargetBox = 
        charBottom <= -targetBox.height + 5 && 
        charBody.position.x > boxLeft && 
        charBody.position.x < boxRight;

      if (state.autoPilotLocked) {
        moveDir = 0;
      } else if (isOnTargetBox) {
        moveDir = 0;
        state.autoPilotLocked = true;
        Matter.Body.setVelocity(charBody, { x: 0, y: charBody.velocity.y });
        state.inputType = "none";
        
        if (state.autoPilotRoute) {
          const route = state.autoPilotRoute;
          state.autoPilotRoute = null;
          state.autoPilotTarget = null;
          setTimeout(() => {
            router.push(route);
          }, 800);
          setTimeout(() => {
            state.autoPilotLocked = false;
          }, 1000);
        }
      } else {
        if (Math.abs(dx) > 10) {
          moveDir = Math.sign(dx);
          state.keys.shift = true; // Run towards target
        } else {
          moveDir = 0;
        }

        // Auto jump if needed
        const obstacleAhead = false; // Could enhance this with raycasts
        if (Math.abs(dx) <= 10 && !state.isJumping) {
          state.keys.jump = true;
        }
      }
    }
  }

  if (!state.autoPilotTarget && state.autoPilotLocked) {
    state.autoPilotLocked = false;
  }

  if (moveDir !== 0 && !state.autoPilotLocked) {
    state.direction = moveDir;
  }

  // Ground Detection using Matter.js Collisions
  // We check if the character is colliding with the floor, boxes, or cubes
  const allBodies = [state.matterFloor, ...state.matterCubes, ...Object.values(state.matterBoxes)].filter(b => b);
  const collisions = Matter.Query.collides(charBody, allBodies);
  
  let isGrounded = false;
  let activeBoxId = null;

  for (const collision of collisions) {
    // Check if collision normal points up (we are on top of something)
    // In Matter.js, normal points from bodyA to bodyB. 
    // If charBody is bodyA, normal.y > 0 means bodyB is below.
    // If charBody is bodyB, normal.y < 0 means bodyA is below.
    const isCharA = collision.bodyA === charBody;
    const normalY = isCharA ? collision.normal.y : -collision.normal.y;
    
    // Character bottom is at y + 32
    // If touching something and velocity is close to 0
    if (normalY > 0.5 && charBody.velocity.y > -1 && charBody.velocity.y < 2) {
      isGrounded = true;
      
      // Identify if we are on a box
      const otherBody = isCharA ? collision.bodyB : collision.bodyA;
      for (const box of BOXES) {
        if (state.matterBoxes[box.id] === otherBody) {
          activeBoxId = box.id;
          break;
        }
      }
      break;
    }
  }

  // Update jumping state
  if (isGrounded) {
    state.isJumping = false;
    state.canDoubleJump = false;
    
    // Landing grace logic
    if (state.isLanding) {
      state.landingGraceTimer -= dt;
      if (state.landingGraceTimer <= 0) {
        state.isLanding = false;
      }
    }
  } else {
    // If not grounded and not jumping, we are falling
    if (!state.isJumping && charBody.velocity.y > 2) {
      state.isJumping = true;
      changeState("jump");
      state.frameIndex = 5; // Falling frame
    }
  }

  // Jumping
  const isLocked = state.isAttacking || (state.isLanding && state.landingGraceTimer <= 0);
  
  if (state.keys.jump && !isLocked) {
    if (isGrounded) {
      state.keys.jump = false; // consume jump
      Matter.Body.setVelocity(charBody, { x: charBody.velocity.x, y: jumpVelocity });
      state.isJumping = true;
      state.canDoubleJump = true;
      changeState("jump");
    } else if (state.canDoubleJump && charBody.velocity.y > -2) {
      // Double jump at apex
      state.keys.jump = false;
      state.canDoubleJump = false;
      Matter.Body.setVelocity(charBody, { x: charBody.velocity.x, y: jumpVelocity });
      changeState("jump");
    }
  }

  // Horizontal Movement (Kinematic-style tight control)
  if (!isLocked && !state.autoPilotLocked) {
    const isRunning = state.keys.shift;
    let targetSpeed = moveDir * (isRunning ? runSpeed : walkSpeed);
    
    // Acceleration and Friction
    // Instead of using Matter.js friction, we strictly control velocity for platforming feel
    const currentAccel = isGrounded ? (PHYSICS.acceleration / TICK_RATE) * dt : (PHYSICS.airFriction / TICK_RATE) * dt;
    const currentFric = isGrounded ? (PHYSICS.friction / TICK_RATE) * dt : (PHYSICS.airFriction / TICK_RATE) * dt;
    
    let vx = charBody.velocity.x;
    
    if (moveDir !== 0) {
      if (Math.abs(vx) < Math.abs(targetSpeed) || Math.sign(vx) !== moveDir) {
        vx += moveDir * currentAccel;
        // Cap speed
        if (Math.abs(vx) > Math.abs(targetSpeed)) vx = targetSpeed;
      }
    } else {
      if (vx > 0) {
        vx = Math.max(0, vx - currentFric);
      } else if (vx < 0) {
        vx = Math.min(0, vx + currentFric);
      }
    }
    
    Matter.Body.setVelocity(charBody, { x: vx, y: charBody.velocity.y });
  }

  // Screen Boundaries
  const halfWidth = (canvas.width / 2) - 15;
  if (charBody.position.x < -halfWidth) {
    Matter.Body.setPosition(charBody, { x: -halfWidth, y: charBody.position.y });
    Matter.Body.setVelocity(charBody, { x: 0, y: charBody.velocity.y });
  } else if (charBody.position.x > halfWidth) {
    Matter.Body.setPosition(charBody, { x: halfWidth, y: charBody.position.y });
    Matter.Body.setVelocity(charBody, { x: 0, y: charBody.velocity.y });
  }

  // Sync Animation State
  if (!state.isAttacking && !state.isLanding && !state.isPreparingJump) {
    if (state.isJumping) {
      // Jump animation is handled in animation.ts, just ensure we are in jump state
    } else if (Math.abs(charBody.velocity.x) > 0.5) {
      if (state.keys.shift && Math.abs(charBody.velocity.x) > walkSpeed * 1.5) {
        changeState("run");
      } else {
        changeState("walk");
      }
    } else {
      changeState("idle");
    }
  }

  // Update Squish and Box State
  if (activeBoxId !== state.activeBox) {
    state.prevActiveBox = state.activeBox;
    state.activeBox = activeBoxId;
  }

  for (const box of BOXES) {
    const matterBox = state.matterBoxes[box.id];
    if (!matterBox) continue;

    const boxSpring = matterEngine.world.constraints.find(c => c.bodyB === matterBox);
    const isOnThisBox = (state.activeBox === box.id);
    const targetAnchorY = isOnThisBox ? (-box.height / 2) + 25 : (-box.height / 2);

    if (boxSpring && boxSpring.pointA) {
      boxSpring.pointA.y += (targetAnchorY - boxSpring.pointA.y) * 10 * dt;
    }
    
    state.boxSquish[box.id] = matterBox.position.y - (-box.height / 2);
  }

  // Physics Step
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

      // Flat landing logic for cubes
      const targetAngle = Math.round(cube.angle / (Math.PI / 2)) * (Math.PI / 2);
      const angleDiff = cube.angle - targetAngle;
      
      if (Math.abs(angleDiff) < 0.2 && Math.abs(cube.angularVelocity) < 0.05) {
        Matter.Body.setAngle(cube, targetAngle);
        Matter.Body.setAngularVelocity(cube, 0);
      } else {
        Matter.Body.applyForce(cube, cube.position, { x: 0, y: 0.001 });
        Matter.Body.setAngularVelocity(cube, cube.angularVelocity * 0.98);
      }
    }

    Matter.Engine.update(matterEngine, dt * 1000);
  }

  // SYNC STATE POSITION TO MATTER.JS (For Rendering)
  state.x = charBody.position.x;
  state.y = charBody.position.y + 32; // Custom Y system treats character bottom as Y. Body center is -32.
};
`;

fs.writeFileSync('src/components/SlimeGame/physics.ts', code);
console.log("Rewrote physics.ts for FULL MATTER.JS!");
