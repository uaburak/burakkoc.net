import { GameState, ActionState } from "./types";
import {
  PHYSICS, ANIMATIONS, BOX_DEFAULT_HEIGHT, BOX_ACTIVE_HEIGHT, BOXES,
  DISPLAY_SIZE, SCALE, RUN_STOP_START, RUN_LOOP_START, JUMP_AIR_START,
  JUMP_LAND_START, CHAR_HALF_WIDTH, CHAR_HEIGHT,
} from "./constants";

export const updatePhysics = (
  state: GameState,
  dt: number,
  canvas: HTMLCanvasElement,
  router: any,
  changeState: (s: ActionState) => void,
  setActiveBox: (boxId: string | null) => void
) => {
  if (!state.loaded) return;

  // Hız hesapları (frame-bazlı mesafe × animasyon hızı)
  const computedWalkSpeed = PHYSICS.walkDistancePerFrame * ANIMATIONS.walk.frameRate;
  const computedRunSpeed  = PHYSICS.runDistancePerFrame  * ANIMATIONS.run.frameRate;

  let moveSpeed = state.keys.shift ? computedRunSpeed : computedWalkSpeed;
  const acceleration    = PHYSICS.acceleration;
  const friction        = PHYSICS.friction;
  const airFriction     = PHYSICS.airFriction;
  const currentFriction = state.isJumping ? airFriction : friction;
  const gravity         = PHYSICS.gravity;

  // Combo Reset Timer
  if (state.comboResetTimer > 0) {
    state.comboResetTimer -= dt;
    if (state.comboResetTimer <= 0) {
      state.attackCombo = 0;
    }
  }

  // Horizontal Movement
  let moveDir = 0;
  let isAutoPilotActive = false;
  let autoPilotJumpRequested = false;

  // ── IDLE OTOMASYON ─────────────────────────────────────────────
  // Kullanıcı input vermezse 4 saniye sonra karakter otonom hareket eder.
  if (!state.isIdleMode) {
    const hasActiveInput =
      state.keys.left || state.keys.right || state.keys.jump ||
      state.isAttacking || state.autoPilotTarget !== null;
    if (!hasActiveInput) {
      state.idleTimer += dt;
      if (state.idleTimer >= 4) {
        state.isIdleMode  = true;
        state.idleWalkDir = state.x > 0 ? -1 : 1;
      }
    } else {
      state.idleTimer = 0;
    }
  }

  if (state.isIdleMode && !state.isJumping && !state.isLanding && !state.isAttacking) {
    const halfWidth      = (canvas.width / 2) - (DISPLAY_SIZE * SCALE / 4);
    const EDGE_MARGIN    = 20;
    const edgeThreshold  = halfWidth - EDGE_MARGIN;

    if (state.x >= edgeThreshold) {
      state.idleWalkDir = -1;
    } else if (state.x <= -edgeThreshold) {
      state.idleWalkDir = 1;
    }

    isAutoPilotActive = true;
    moveDir           = state.idleWalkDir;
    moveSpeed         = computedRunSpeed;
    state.keys.shift  = true;
  } else if (!state.isIdleMode) {
    state.keys.shift = false;
  }
  // ───────────────────────────────────────────────────────────────

  // OTOPİLOT KONTROLÜ
  if (state.autoPilotTarget || state.autoPilotLocked) {
    isAutoPilotActive = true;

    if (state.autoPilotLocked) {
      state.vx = 0;
      state.vy = Math.max(state.vy, 0); // Yerçekimi uygulanmaya devam etsin
      moveDir = 0;
    } else if (state.activeBox === state.autoPilotTarget) {
      // Hedefe ulaştı! Karakteri 1000ms kilitle
      state.autoPilotLocked = true;
      state.vx = 0;
      state.inputType = "none";
      const route = state.autoPilotRoute;
      state.autoPilotTarget = null;
      state.autoPilotRoute = null;
      if (route) {
        sessionStorage.setItem('slime_pos', JSON.stringify({
          x: state.x,
          y: state.y,
          dir: state.direction,
        }));
        setTimeout(() => { router.push(route); }, 800);
      }
      setTimeout(() => { state.autoPilotLocked = false; }, 1000);
    } else {
      const targetBox = BOXES.find(b => b.id === state.autoPilotTarget);
      if (targetBox) {
        const dx = targetBox.xOffset - state.x;
        if (Math.abs(dx) > 10) {
          moveDir   = Math.sign(dx);
          moveSpeed = computedRunSpeed;
        } else {
          moveDir   = 0;
          state.vx  = 0; // Havada dahi olsa anında fren yapıp olduğu yere düşsün
        }

        // Engelleri Aşma (Akıllı / Prediktif Zıplama)
        let obstacleAhead = false;
        const lookAheadDist = Math.max(70, Math.abs(state.vx) * 0.3);
        for (const box of BOXES) {
          const boxTop   = -box.height + state.boxSquish[box.id];
          const boxLeft  = box.xOffset - box.width / 2;
          const boxRight = box.xOffset + box.width / 2;

          if (state.y > boxTop + 10) {
            if (moveDir === 1) {
              const dist = boxLeft - (state.x + CHAR_HALF_WIDTH);
              if (dist > -5 && dist < lookAheadDist) obstacleAhead = true;
            } else if (moveDir === -1) {
              const dist = (state.x - CHAR_HALF_WIDTH) - boxRight;
              if (dist > -5 && dist < lookAheadDist) obstacleAhead = true;
            }
          }
        }

        if (moveDir !== 0 && obstacleAhead && !state.isJumping) {
          autoPilotJumpRequested = true;
        }

        if (Math.abs(dx) <= 10 && state.activeBox !== state.autoPilotTarget && !state.isJumping) {
          autoPilotJumpRequested = true;
        }

        // Otopilot Double Jump
        if (state.isJumping && state.canDoubleJump && state.vy > -100) {
          const targetBoxTop = -targetBox.height + (state.boxSquish[targetBox.id] || 0);
          if (state.y > targetBoxTop + 20) {
            state.canDoubleJump = false;
            state.jumpOriginY   = state.y;
            state.vy            = PHYSICS.jumpForce;
            state.frameIndex    = JUMP_AIR_START;
            state.frameTimer    = 0;
          }
        }
      }
    }
  }

  if (!isAutoPilotActive) {
    // Mouse Takip Mantığı
    if (state.inputType === "mouse" && !state.isIdleMode) {
      const characterScreenX = (canvas.width / 2) + state.x;
      const diffX = state.mouseX - characterScreenX;

      if (Math.abs(diffX) > PHYSICS.mouseRunDistance) {
        state.keys.left  = diffX < 0;
        state.keys.right = diffX > 0;
        state.keys.shift = true;
        moveSpeed        = computedRunSpeed;
      } else if (Math.abs(diffX) > PHYSICS.mouseWalkDistance) {
        state.keys.left  = diffX < 0;
        state.keys.right = diffX > 0;
        state.keys.shift = false;
        moveSpeed        = computedWalkSpeed;
      } else {
        state.keys.left  = false;
        state.keys.right = false;
        state.keys.shift = false;
      }
    }

    if (state.keys.right) moveDir += 1;
    if (state.keys.left)  moveDir -= 1;
  }

  // Idle modda inputType'ı "none" zorla — eski mouse konumu etki etmesin
  if (state.isIdleMode) {
    state.inputType = "none";
  }

  // Run'dayken: dur/dönüş tespiti
  if (state.currentState === "run" && state.runPhase === "loop") {
    const noMoveInput = !state.keys.left && !state.keys.right &&
      (state.inputType !== "mouse" ||
        Math.abs(state.mouseX - (canvas.width / 2 + state.x)) <= PHYSICS.mouseWalkDistance);
    const isTurning = moveDir !== 0 && Math.sign(moveDir) !== Math.sign(state.direction);

    if (isTurning && !state.isJumping && !state.isAttacking) {
      state.pendingRunDirection = moveDir;
      state.runPhase   = "stop";
      state.frameIndex = RUN_STOP_START;
      state.frameTimer = 0;
    } else if (noMoveInput && !state.isIdleMode && !state.isJumping && !state.isAttacking) {
      state.pendingRunDirection = 0;
      state.runPhase   = "stop";
      state.frameIndex = RUN_STOP_START;
      state.frameTimer = 0;
    } else if (!state.keys.shift && !state.isJumping && !state.isIdleMode) {
      state.runPhase = null;
    }
  }

  const isLocked =
    (state.isAttacking && state.currentState !== "run_attack") ||
    state.isLanding ||
    state.runPhase === "stop";

  // Landing grace timer
  if (state.landingGraceTimer > 0) {
    state.landingGraceTimer -= dt;
  }

  // Zıplama Başlangıcı
  const jumpRequested = state.keys.jump || autoPilotJumpRequested;
  if (jumpRequested && !state.isJumping && !isLocked) {
    state.landingGraceTimer = 0;
    state.isLanding         = false;
    state.isJumping         = true;
    state.canDoubleJump     = true;
    state.jumpOriginY       = state.y;
    state.vy                = PHYSICS.jumpForce;
    state.currentState      = "jump";
    state.frameIndex        = JUMP_AIR_START;
    state.frameTimer        = 0;
  }

  if (!isLocked) {
    if (moveDir !== 0) {
      state.direction = moveDir;
      const oldVx = state.vx;
      state.vx += moveDir * acceleration * dt;

      let currentMaxSpeed = moveSpeed;
      if (state.isJumping) {
        if (Math.sign(oldVx) === moveDir || oldVx === 0) {
          currentMaxSpeed = Math.max(moveSpeed, Math.abs(oldVx));
        }
      }

      if (Math.abs(state.vx) > currentMaxSpeed) {
        state.vx = Math.sign(state.vx) * currentMaxSpeed;
      }
    } else {
      if (state.vx > 0) {
        state.vx = Math.max(0, state.vx - currentFriction * dt);
      } else if (state.vx < 0) {
        state.vx = Math.min(0, state.vx + currentFriction * dt);
      }
    }
  } else {
    if (state.vx > 0) state.vx = Math.max(0, state.vx - friction * dt * 2);
    else if (state.vx < 0) state.vx = Math.min(0, state.vx + friction * dt * 2);
  }

  // Y ekseni (Yerçekimi)
  state.vy += gravity * dt;

  // 2. Y Ekseni (Zemin/Platform Çarpışmaları)
  const prevCharBottom = state.y;
  state.y += state.vy * dt;

  let currentGroundY = 0;
  let newActiveBox: string | null = null;

  for (const box of BOXES) {
    const boxTop   = -box.height + state.boxSquish[box.id];
    const boxLeft  = box.xOffset - box.width / 2;
    const boxRight = box.xOffset + box.width / 2;

    if (state.x + CHAR_HALF_WIDTH > boxLeft && state.x - CHAR_HALF_WIDTH < boxRight) {
      if (state.activeBox === box.id && !state.isJumping) {
        currentGroundY = Math.min(currentGroundY, boxTop);
        newActiveBox   = box.id;
      } else if (prevCharBottom <= boxTop + 3) {
        if (state.y >= boxTop) {
          currentGroundY = Math.min(currentGroundY, boxTop);
          newActiveBox   = box.id;
        }
      }
    }
  }

  // Karakter - Küp Zemin Kontrolü (MTV)
  if (state.cubes.length > 0) {
    for (const cube of state.cubes) {
      const cubeTop   = cube.y - cube.size / 2;
      const cubeLeft  = cube.x - cube.size / 2;
      const cubeRight = cube.x + cube.size / 2;

      const overlapL = (state.x + CHAR_HALF_WIDTH) - cubeLeft;
      const overlapR = cubeRight - (state.x - CHAR_HALF_WIDTH);
      const overlapT = state.y - cubeTop;
      const overlapB = (cube.y + cube.size / 2) - (state.y - 50);

      if (overlapL > 0 && overlapR > 0 && overlapT > 0 && overlapB > 0) {
        if (overlapT <= overlapL && overlapT <= overlapR && prevCharBottom <= cubeTop + 4) {
          if (cubeTop <= currentGroundY || currentGroundY === 0) {
            currentGroundY = cubeTop;
            newActiveBox   = null;
            if (state.vy > 50) {
              cube.vy += state.vy * 0.15;
            }
          }
        }
      }
    }
  }

  // Squish fiziği: Tüm kutular için yay simülasyonu
  for (const box of BOXES) {
    const isOnThisBox  = (newActiveBox === box.id);
    const targetSquish = isOnThisBox ? (BOX_DEFAULT_HEIGHT - BOX_ACTIVE_HEIGHT) : 0;

    const squish    = state.boxSquish[box.id];
    const squishVel = state.boxSquishVelocity[box.id];

    const springStiffness = 300;
    const springDamping   = 30;

    const displacement = squish - targetSquish;
    const springForce  = -springStiffness * displacement - springDamping * squishVel;
    state.boxSquishVelocity[box.id] += springForce * dt;
    state.boxSquish[box.id]         += state.boxSquishVelocity[box.id] * dt;

    if (Math.abs(state.boxSquish[box.id] - targetSquish) < 0.5 && Math.abs(state.boxSquishVelocity[box.id]) < 1) {
      state.boxSquish[box.id]         = targetSquish;
      state.boxSquishVelocity[box.id] = 0;
    }
  }

  // State değiştiyse React tarafını tetikle
  if (newActiveBox !== state.activeBox) {
    state.activeBox = newActiveBox;
    setActiveBox(newActiveBox);

    if (newActiveBox !== null) {
      const impactVelocity = Math.min(Math.abs(state.vy) * 0.35, 300);
      state.boxSquishVelocity[newActiveBox] = impactVelocity;
    }
  }

  if (state.y >= currentGroundY) {
    state.y  = currentGroundY;
    state.vy = 0;

    if (state.isJumping || state.isLanding) {
      const wasJumping    = state.isJumping;
      state.isJumping     = false;
      state.canDoubleJump = false;

      if (state.jumpBuffered) {
        state.jumpBuffered  = false;
        state.isLanding     = false;
        state.isJumping     = true;
        state.canDoubleJump = true;
        state.vy            = PHYSICS.jumpForce;
        state.currentState  = "jump";
        state.frameIndex    = JUMP_AIR_START;
        state.frameTimer    = 0;
      } else if (wasJumping) {
        state.isLanding         = true;
        state.landingGraceTimer = 1.5;
        state.vx                = 0;
        if (state.currentState === "jump") {
          state.frameIndex = JUMP_LAND_START;
          state.frameTimer = 0;
        }
      }
    }
  }

  // 3. X Ekseni (Yatay Hareket ve Duvar Çarpışmaları)
  state.x += state.vx * dt;

  for (const box of BOXES) {
    const boxTop   = -box.height + state.boxSquish[box.id];
    const boxLeft  = box.xOffset - box.width / 2;
    const boxRight = box.xOffset + box.width / 2;

    if (state.x + CHAR_HALF_WIDTH > boxLeft && state.x - CHAR_HALF_WIDTH < boxRight) {
      if (state.isJumping && state.y <= boxTop + 3) {
        continue; // Zıplama sırasında kutuyu temizliyoruz, duvar olarak sayma
      }

      if (state.y > boxTop + 3) {
        if (state.vx > 0) {
          state.x  = boxLeft - CHAR_HALF_WIDTH;
          state.vx = 0;
        } else if (state.vx < 0) {
          state.x  = boxRight + CHAR_HALF_WIDTH;
          state.vx = 0;
        }
      }
    }
  }

  // Karakter - Küp Tam AABB Çarpışması (MTV)
  if (state.cubes.length > 0) {
    for (const cube of state.cubes) {
      const cubeTop    = cube.y - cube.size / 2;
      const cubeBottom = cube.y + cube.size / 2;
      const cubeLeft   = cube.x - cube.size / 2;
      const cubeRight  = cube.x + cube.size / 2;
      const charTop    = state.y - CHAR_HEIGHT;
      const charBottom = state.y;

      const overlapL = (state.x + CHAR_HALF_WIDTH) - cubeLeft;
      const overlapR = cubeRight - (state.x - CHAR_HALF_WIDTH);
      const overlapT = charBottom - cubeTop;
      const overlapB = cubeBottom - charTop;

      if (overlapL > 0 && overlapR > 0 && overlapT > 0 && overlapB > 0) {
        const minOv = Math.min(overlapL, overlapR, overlapT, overlapB);

        if (minOv === overlapT && state.vy >= 0) {
          // Üstten iniş zaten Y-ekseninde yukarıda halledildi
        } else if (minOv === overlapL) {
          state.x  = cubeLeft - CHAR_HALF_WIDTH;
          cube.vx += state.vx * 0.4;
          cube.angularVelocity += state.vx * 0.01;
          state.vx = 0;
        } else if (minOv === overlapR) {
          state.x  = cubeRight + CHAR_HALF_WIDTH;
          cube.vx += state.vx * 0.4;
          cube.angularVelocity += state.vx * 0.01;
          state.vx = 0;
        } else if (minOv === overlapB) {
          state.y  = cubeBottom + 1;
          state.vy = Math.max(state.vy, 0);
        }
      }
    }
  }

  // Ekran Sınırları (Sağ / Sol)
  const halfWidth = (canvas.width / 2) - (DISPLAY_SIZE * SCALE / 4);
  if (state.x < -halfWidth) state.x = -halfWidth;
  if (state.x >  halfWidth) state.x =  halfWidth;

  // Animasyon Durumu Belirleme
  if (!state.isAttacking && !state.isLanding && state.runPhase !== "stop") {
    if (state.isJumping) {
      changeState("jump");
    } else if (Math.abs(state.vx) > 10) {
      if (state.keys.shift) {
        const wasNotRunning = state.currentState !== "run";
        changeState("run");
        if (wasNotRunning && state.currentState === "run") {
          state.runPhase   = state.isIdleMode ? "loop" : "start";
          if (state.isIdleMode) state.frameIndex = RUN_LOOP_START;
        } else if (state.runPhase === null) {
          state.runPhase   = "loop";
          state.frameIndex = RUN_LOOP_START;
        }
      } else {
        changeState("walk");
        state.runPhase = null;
      }
    } else {
      changeState("idle");
      state.runPhase = null;
    }
  }

  // =============================================================
  // KÜPLER FİZİĞİ — İTERATİF CONSTRAINT SOLVER (8 iter)
  // Guard: state.cubes boşsa döngülere girilmez.
  // =============================================================
  if (state.cubes.length > 0) {
    const GROUND_Y    = 0;
    const SOLVER_ITERS = 8;

    // ADIM 1: Gravity + velocity integration
    for (const cube of state.cubes) {
      if (cube.y > 120) {
        cube.y              = -900 - Math.random() * 600;
        cube.x              = (Math.random() - 0.5) * 700;
        cube.vy             = 0;
        cube.vx             = 0;
        cube.angularVelocity = 0;
        cube.angle          = 0;
        continue;
      }
      cube.vy    += PHYSICS.gravity * 0.45 * dt;
      cube.x     += cube.vx * dt;
      cube.y     += cube.vy * dt;
      cube.angle += cube.angularVelocity * dt;
    }

    // ADIM 2: İTERATİF CONSTRAINT SOLVER
    for (let iter = 0; iter < SOLVER_ITERS; iter++) {
      const applyImpulse = iter === 0;

      // 2a) Her küp: Zemin + Platform çarpışması
      for (const cube of state.cubes) {
        const h = cube.size / 2;

        // -- Ana Zemin --
        if (cube.y + h > GROUND_Y) {
          cube.y = GROUND_Y - h;
          if (applyImpulse) {
            cube.vy = cube.vy > 20 ? cube.vy * -0.2 : 0;
          } else {
            cube.vy = Math.min(cube.vy, 0);
          }
          cube.vx *= 0.87;
          cube.angularVelocity = 0;
          const tgt = Math.round(cube.angle / (Math.PI / 2)) * (Math.PI / 2);
          cube.angle = cube.angle + (tgt - cube.angle) * 0.6;
          if (Math.abs(cube.angle - tgt) < 0.05) cube.angle = tgt;
        }

        // -- Platform Kutuları --
        for (const box of BOXES) {
          const boxTop    = -box.height + (state.boxSquish[box.id] || 0);
          const boxLeft   = box.xOffset - box.width / 2;
          const boxRight  = box.xOffset + box.width / 2;
          const boxBottom = GROUND_Y;

          const cL = cube.x - h, cR = cube.x + h;
          const cT = cube.y - h, cB = cube.y + h;

          if (cR <= boxLeft || cL >= boxRight || cB <= boxTop || cT >= boxBottom) continue;

          const penL   = cR - boxLeft;
          const penR   = boxRight - cL;
          const penT   = cB - boxTop;
          const minPen = Math.min(penL, penR, penT);

          if (minPen === penT) {
            cube.y = boxTop - h;
            if (applyImpulse) {
              if (cube.vy > 20) {
                state.boxSquishVelocity[box.id] += Math.min(cube.vy * 0.08, 35);
                cube.vy *= -0.2;
              } else { cube.vy = 0; }
            } else { cube.vy = Math.min(cube.vy, 0); }
            cube.vx *= 0.87;
            cube.angularVelocity = 0;
            const tgt = Math.round(cube.angle / (Math.PI / 2)) * (Math.PI / 2);
            cube.angle = cube.angle + (tgt - cube.angle) * 0.6;
            if (Math.abs(cube.angle - tgt) < 0.05) cube.angle = tgt;
          } else if (minPen === penL) {
            cube.x = boxLeft - h;
            if (applyImpulse && cube.vx > 0) cube.vx *= -0.25;
            else if (cube.vx > 0) cube.vx = 0;
          } else {
            cube.x = boxRight + h;
            if (applyImpulse && cube.vx < 0) cube.vx *= -0.25;
            else if (cube.vx < 0) cube.vx = 0;
          }
        }
      }

      // 2b) Küp – Küp çarpışması
      for (let i = 0; i < state.cubes.length; i++) {
        for (let j = i + 1; j < state.cubes.length; j++) {
          const c1 = state.cubes[i];
          const c2 = state.cubes[j];
          const h1 = c1.size / 2;
          const h2 = c2.size / 2;

          const dx   = c2.x - c1.x;
          const dy   = c2.y - c1.y;
          const sepX = h1 + h2;
          const sepY = h1 + h2;

          if (Math.abs(dx) >= sepX || Math.abs(dy) >= sepY) continue;

          const overlapX = sepX - Math.abs(dx);
          const overlapY = sepY - Math.abs(dy);

          if (overlapX <= overlapY) {
            const push = overlapX * 0.5;
            const sx   = dx >= 0 ? 1 : -1;
            c1.x -= push * sx;
            c2.x += push * sx;

            if (applyImpulse) {
              const relVx = (c1.vx - c2.vx) * sx;
              if (relVx > 0) {
                const imp = relVx * 0.65;
                c1.vx -= imp * sx;
                c2.vx += imp * sx;
                c1.angularVelocity -= imp * 0.015 * sx;
                c2.angularVelocity += imp * 0.015 * sx;
              }
            }
          } else {
            const push = overlapY * 0.5;
            const sy   = dy >= 0 ? 1 : -1;
            c1.y -= push * sy;
            c2.y += push * sy;

            if (applyImpulse) {
              const relVy = (c1.vy - c2.vy) * sy;
              if (relVy > 0) {
                const imp = relVy * 0.65;
                c1.vy -= imp * sy;
                c2.vy += imp * sy;
              }
            }
          }
        }
      }
    } // solver iter bitti

    // ADIM 3: Hava sürtünmesi (sadece havadaysa)
    for (const cube of state.cubes) {
      const h          = cube.size / 2;
      const onGround   = (cube.y + h) >= GROUND_Y - 0.5;
      let   onPlatform = false;
      for (const box of BOXES) {
        const boxTop   = -box.height + (state.boxSquish[box.id] || 0);
        const boxLeft  = box.xOffset - box.width / 2;
        const boxRight = box.xOffset + box.width / 2;
        if (cube.x + h > boxLeft && cube.x - h < boxRight && Math.abs(cube.y + h - boxTop) < 2) {
          onPlatform = true;
          break;
        }
      }
      if (!onGround && !onPlatform) {
        cube.vx *= 0.997;
      }
    }
  } // if cubes.length > 0
};
