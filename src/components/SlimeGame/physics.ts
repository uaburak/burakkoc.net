import { GameState, ActionState } from "./types";
import { PHYSICS, ANIMATIONS, BOX_DEFAULT_HEIGHT, BOX_ACTIVE_HEIGHT, BOXES, DISPLAY_SIZE, SCALE } from "./constants";

export const updatePhysics = (
  state: GameState, 
  dt: number, 
  canvas: HTMLCanvasElement, 
  router: any,
  changeState: (s: ActionState) => void,
  setActiveBox: (boxId: string | null) => void
) => {
  if (!state.loaded) return;


      // Seçilen moda göre hızları belirle
      const computedWalkSpeed = PHYSICS.useFrameBasedDistance 
        ? PHYSICS.walkDistancePerFrame * ANIMATIONS.walk.frameRate 
        : PHYSICS.walkSpeed;
        
      const computedRunSpeed = PHYSICS.useFrameBasedDistance 
        ? PHYSICS.runDistancePerFrame * ANIMATIONS.run.frameRate 
        : PHYSICS.runSpeed;

      let moveSpeed = state.keys.shift ? computedRunSpeed : computedWalkSpeed;
      const acceleration = PHYSICS.acceleration;
      const friction = PHYSICS.friction;
      const airFriction = PHYSICS.airFriction;
      const currentFriction = (state.isJumping || state.isPreparingJump) ? airFriction : friction;
      const gravity = PHYSICS.gravity;
      const jumpForce = PHYSICS.jumpForce;

      // Combo Reset Timer
      if (state.comboResetTimer > 0) {
        state.comboResetTimer -= dt;
        if (state.comboResetTimer <= 0) {
          state.attackCombo = 0; // Kombo sıfırlanır
        }
      }

      // Horizontal Movement
      let moveDir = 0;
      let isAutoPilotActive = false;
      let autoPilotJumpRequested = false;

      // OTOPİLOT KONTROLÜ
      if (state.autoPilotTarget || state.autoPilotLocked) {
         isAutoPilotActive = true;
         
         // Hedefe ulaştı ve kilitlendi → tamamen sabit kal
         if (state.autoPilotLocked) {
            state.vx = 0;
            state.vy = Math.max(state.vy, 0); // Yerçekimi uygulanmaya devam etsin (yere insin)
            moveDir = 0;
         }
         else if (state.activeBox === state.autoPilotTarget) {
            // Hedefe ulaştı! Karakteri 1000ms kilitle
            state.autoPilotLocked = true;
            state.vx = 0;
            state.inputType = "none";
            const route = state.autoPilotRoute;
            state.autoPilotTarget = null;
            state.autoPilotRoute = null;
            if (route) {
               // Pozisyonu kaydet (geri gelince aynı yerden devam)
               sessionStorage.setItem('slime_pos', JSON.stringify({
                 x: state.x,
                 y: state.y,
                 dir: state.direction
               }));
               setTimeout(() => {
                  router.push(route);
               }, 800);
            }
            // 1000ms sonra kilidi aç (geri gelirse kontrol kullanıcıda)
            setTimeout(() => {
               state.autoPilotLocked = false;
            }, 1000);
         } else {
            const targetBox = BOXES.find(b => b.id === state.autoPilotTarget);
            if (targetBox) {
               const dx = targetBox.xOffset - state.x;
               if (Math.abs(dx) > 10) {
                  moveDir = Math.sign(dx);
                  moveSpeed = computedRunSpeed; // Otopilot koşarak gitsin
               } else {
                  moveDir = 0; // Hedefe yatayda geldi
                  state.vx = 0; // Havada dahi olsa anında fren yapıp olduğu yere düşsün
               }

               // Engelleri Aşma (Akıllı / Prediktif Zıplama)
               let obstacleAhead = false;
               const charHalfWidth = 15;
               // Hıza göre dinamik algılama mesafesi (ne kadar hızlıysa o kadar erken zıpla)
               const lookAheadDist = Math.max(70, Math.abs(state.vx) * 0.3);
               for (const box of BOXES) {
                  const boxTop = -box.height + state.boxSquish[box.id];
                  const boxLeft = box.xOffset - box.width / 2;
                  const boxRight = box.xOffset + box.width / 2;
                  
                  // Sadece yerdeyken (veya kutunun altındayken) engelleri kontrol et
                  if (state.y > boxTop + 10) { 
                     if (moveDir === 1) {
                        const dist = boxLeft - (state.x + charHalfWidth);
                        if (dist > -5 && dist < lookAheadDist) obstacleAhead = true;
                     } else if (moveDir === -1) {
                        const dist = (state.x - charHalfWidth) - boxRight;
                        if (dist > -5 && dist < lookAheadDist) obstacleAhead = true;
                     }
                  }
               }

               // Yerdeyken ve önünde engel varsa zıpla
               if (moveDir !== 0 && obstacleAhead && !state.isJumping && !state.isPreparingJump) {
                  autoPilotJumpRequested = true;
               }

               // Hedefe yatayda ulaştı ama kutunun üstünde değilse → zıpla
               if (Math.abs(dx) <= 10 && state.activeBox !== state.autoPilotTarget && !state.isJumping && !state.isPreparingJump) {
                  autoPilotJumpRequested = true;
               }

               // Otopilot Double Jump: Havadayken ve hedef kutuya yeterli yükseklikte değilse
               if (state.isJumping && state.canDoubleJump && state.vy > -100) {
                  // Zirveye yaklaştığında (vy ~0) double jump at
                  const targetBoxTop = -targetBox.height + (state.boxSquish[targetBox.id] || 0);
                  if (state.y > targetBoxTop + 20) {
                     // Hâlâ kutunun altındayız, double jump gerek
                     state.canDoubleJump = false;
                     state.jumpOriginY = state.y;
                     state.vy = PHYSICS.jumpForce;
                     state.frameIndex = 2;
                     state.frameTimer = 0;
                  }
               }
             }
         }
      }

      if (!isAutoPilotActive) {
         // Mouse Takip Mantığı (Sadece Mouse Modundaysa)
         if (state.inputType === "mouse") {
           const characterScreenX = (canvas.width / 2) + state.x;
           const diffX = state.mouseX - characterScreenX;
           
           if (Math.abs(diffX) > PHYSICS.mouseRunDistance) {
             state.keys.left = diffX < 0;
             state.keys.right = diffX > 0;
             state.keys.shift = true;
             moveSpeed = computedRunSpeed;
           } else if (Math.abs(diffX) > PHYSICS.mouseWalkDistance) {
             state.keys.left = diffX < 0;
             state.keys.right = diffX > 0;
             state.keys.shift = false;
             moveSpeed = computedWalkSpeed;
           } else {
             state.keys.left = false;
             state.keys.right = false;
             state.keys.shift = false;
           }
         }

         if (state.keys.right) moveDir += 1;
         if (state.keys.left) moveDir -= 1;
      }

      // Saldırı veya stop animasyonu sırasında hareket engellensin (start'ta serbest)
      const isLocked =
        (state.isAttacking && state.currentState !== "run_attack") ||
        (state.isLanding && state.landingGraceTimer <= 0) ||
        state.isRunStopping;
      
      // Landing grace timer countdown
      if (state.landingGraceTimer > 0) {
        state.landingGraceTimer -= dt;
      }

      // Zıplama Başlangıcı
      const jumpRequested = state.keys.jump || autoPilotJumpRequested;
      if (jumpRequested && !state.isJumping && !state.isPreparingJump && !isLocked) {
        // Grace period içindeyse hazırlık animasyonunu atla, direkt zıpla
        if (state.landingGraceTimer > 0) {
          state.landingGraceTimer = 0;
          state.isLanding = false;
          state.isJumping = true;
          state.canDoubleJump = true;
          state.jumpOriginY = state.y; // Zıplama başlangıç Y
          state.vy = PHYSICS.jumpForce;
          state.currentState = "jump";
          state.frameIndex = 2; // Frame 3'ten başla
          state.frameTimer = 0;
        } else {
          state.isPreparingJump = true;
          state.jumpOriginY = state.y; // Zıplama başlangıç Y
          changeState("jump"); // Normal zıplama animasyonunu başlat
        }
      }

      if (!isLocked) {
        if (moveDir !== 0) {
          state.direction = moveDir;
          const oldVx = state.vx;
          state.vx += moveDir * acceleration * dt;
          
          let currentMaxSpeed = moveSpeed;
          if (state.isJumping || state.isPreparingJump) {
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

      // 2. Y Ekseni (Yerçekimi ve Zemin/Platform Çarpışmaları)
      const prevCharBottom = state.y;
      state.y += state.vy * dt;

      let currentGroundY = 0; // Kendi lokal eksenimizde ana zemin
      let newActiveBox: string | null = null;
      let isOnCube = false; // Küp üzerinde mi?
      
      const charHalfWidth = 15; // Karakterin fiziksel genişliğinin yarısı (Duvar çarpışmaları için)

      for (const box of BOXES) {
        // Squish offset dahil: kutu aşağı kaydığında hitbox da kayar
        const boxTop = -box.height + state.boxSquish[box.id];
        const boxLeft = box.xOffset - box.width / 2;
        const boxRight = box.xOffset + box.width / 2;
        
        // Karakter kutunun yatay hizasında mı?
        if (state.x + charHalfWidth > boxLeft && state.x - charHalfWidth < boxRight) {
          // Zaten bu kutunun üstündeyse → squish değişse bile kutuda tut
          if (state.activeBox === box.id && !state.isJumping && !state.isPreparingJump) {
            currentGroundY = Math.min(currentGroundY, boxTop);
            newActiveBox = box.id;
          }
          // Yeni iniş: sıkı kontrol (sadece ilk temas için)
          else if (prevCharBottom <= boxTop + 3) {
            if (state.y >= boxTop) {
              currentGroundY = Math.min(currentGroundY, boxTop);
              newActiveBox = box.id;
            }
          }
        }
      }

      // Karakter - Küp Zemin Kontrolü (MTV)
      for (const cube of state.cubes) {
        const cubeTop    = cube.y - cube.size / 2;
        const cubeLeft   = cube.x - cube.size / 2;
        const cubeRight  = cube.x + cube.size / 2;

        const overlapL = (state.x + charHalfWidth) - cubeLeft;
        const overlapR = cubeRight - (state.x - charHalfWidth);
        const overlapT = (state.y) - cubeTop;              // karakter alt - küp üst
        const overlapB = (cube.y + cube.size/2) - (state.y - 50); // küp alt - karakter üst (kabaca)

        if (overlapL > 0 && overlapR > 0 && overlapT > 0 && overlapB > 0) {
          // Üstten iniş mi? overlapT en küçükse ve yukarıdan geliyorsak
          if (overlapT <= overlapL && overlapT <= overlapR && prevCharBottom <= cubeTop + 4) {
            if (cubeTop <= currentGroundY || currentGroundY === 0) {
              currentGroundY = cubeTop;
              newActiveBox = null;
              isOnCube = true;
              if (state.vy > 50) {
                cube.vy += state.vy * 0.15; // küpü aşağı it
              }
            }
          }
        }
      }

      // Squish fiziği: Tüm kutular için yay simülasyonu
      // Her kutunun hedef konumu: karakter üstündeyse biraz aşağıda, değilse 0
      for (const box of BOXES) {
        const isOnThisBox = (newActiveBox === box.id);
        const targetSquish = isOnThisBox ? (BOX_DEFAULT_HEIGHT - BOX_ACTIVE_HEIGHT) : 0;
        
        const squish = state.boxSquish[box.id];
        const squishVel = state.boxSquishVelocity[box.id];
        
        // Yay sabitleri (yüksek sönümleme = hızlı oturma, az salınım)
        const springStiffness = 300;
        const springDamping = 30;
        
        // Hedefe doğru yay kuvveti: F = -k*(x - target) - c*v
        const displacement = squish - targetSquish;
        const springForce = -springStiffness * displacement - springDamping * squishVel;
        state.boxSquishVelocity[box.id] += springForce * dt;
        state.boxSquish[box.id] += state.boxSquishVelocity[box.id] * dt;
        
        // Hedefe yaklaştığında kilitle (1-2 saniye içinde oturur)
        if (Math.abs(state.boxSquish[box.id] - targetSquish) < 0.5 && Math.abs(state.boxSquishVelocity[box.id]) < 1) {
          state.boxSquish[box.id] = targetSquish;
          state.boxSquishVelocity[box.id] = 0;
        }
      }
      
      // State değiştiyse React tarafını tetikle
      if (newActiveBox !== state.activeBox) {
        state.prevActiveBox = state.activeBox;
        state.activeBox = newActiveBox;
        setActiveBox(newActiveBox);
        
        // Yeni bir kutunun üzerine indiysek → iniş etkisi (impact) ekle
        if (newActiveBox !== null) {
          // İniş anındaki hız ile orantılı darbe (vy henüz sıfırlanmadı)
          const impactVelocity = Math.min(Math.abs(state.vy) * 0.35, 300);
          state.boxSquishVelocity[newActiveBox] = impactVelocity;
        }
      }

      if (state.y >= currentGroundY) {
        state.y = currentGroundY;
        state.vy = 0;
        
        if (state.isJumping || state.isLanding) {
          const wasJumping = state.isJumping;
          state.isJumping = false;
          state.canDoubleJump = false;
          
          // Jump buffer kontrolü: Havadayken zıplama tuşuna basıldıysa hemen zıpla
          if (state.jumpBuffered) {
            state.jumpBuffered = false;
            state.isLanding = false;
            state.isJumping = true;
            state.canDoubleJump = true;
            state.vy = PHYSICS.jumpForce;
            state.currentState = "jump";
            state.frameIndex = 2; // Frame 3'ten başla (hazırlık animasyonunu atla)
            state.frameTimer = 0;
          } else if (wasJumping) {
            state.isLanding = true;
            state.landingGraceTimer = 1.5; // 1.5 saniye içinde zıplarsa hızlı zıplama
            // Yere inme başladı, zıplama animasyonunun 8. karesine geç
            if (state.currentState === "jump") {
              state.frameIndex = 7;
              state.frameTimer = 0;
            }
          }
        }
      }

      // 3. X Ekseni (Yatay Hareket ve Duvar Çarpışmaları)
      state.x += state.vx * dt;

      for (const box of BOXES) {
        const boxTop = -box.height + state.boxSquish[box.id];
        const boxLeft = box.xOffset - box.width / 2;
        const boxRight = box.xOffset + box.width / 2;
        
        // Karakter kutunun yatay sınırlarına girdi mi?
        if (state.x + charHalfWidth > boxLeft && state.x - charHalfWidth < boxRight) {
           // Havadayken ve kutunun üstünden geçebilecek yükseklikteyse duvar çarpışmasını atla
           if ((state.isJumping || state.isPreparingJump) && state.y <= boxTop + 3) {
              continue; // Zıplama sırasında kutuyu temizliyoruz, duvar olarak sayma
           }
           
           // Ayakları kutunun üstünden daha aşağıdaysa (yani kutunun yanındaysa)
           if (state.y > boxTop + 3) { 
              // Duvara çarptı! Geri ittir.
              if (state.vx > 0) { // Sağa giderken sol duvara çarptı
                 state.x = boxLeft - charHalfWidth;
                 state.vx = 0;
              } else if (state.vx < 0) { // Sola giderken sağ duvara çarptı
                 state.x = boxRight + charHalfWidth;
                 state.vx = 0;
              }
           }
        }
      }

      // Karakter - Küp Tam AABB Çarpışması (MTV - iç içe girme yok)
      const charHeight = 50; // Karakterin yaklaşık boyu
      for (const cube of state.cubes) {
        const cubeTop    = cube.y - cube.size / 2;
        const cubeBottom = cube.y + cube.size / 2;
        const cubeLeft   = cube.x - cube.size / 2;
        const cubeRight  = cube.x + cube.size / 2;
        const charTop    = state.y - charHeight;
        const charBottom = state.y;

        // AABB tam çakışma kontrolü
        const overlapL = (state.x + charHalfWidth) - cubeLeft;
        const overlapR = cubeRight - (state.x - charHalfWidth);
        const overlapT = charBottom - cubeTop;
        const overlapB = cubeBottom - charTop;

        if (overlapL > 0 && overlapR > 0 && overlapT > 0 && overlapB > 0) {
          // Üstten iniş zaten Y-ekseninde yukarıda halledildi, burada sadece yan duvar
          // En küçük overlap'ı bul
          const minOv = Math.min(overlapL, overlapR, overlapT, overlapB);

          if (minOv === overlapT && state.vy >= 0) {
            // Zaten zemin kontrolü yaptık, tekrar yapma
          } else if (minOv === overlapL) {
            // Karakterin sağ kenarı küpün sol kenarına girdi → karakteri sola it
            state.x = cubeLeft - charHalfWidth;
            cube.vx += state.vx * 0.4; // küpü karakterin hızıyla it
            cube.angularVelocity += state.vx * 0.01;
            state.vx = 0;
          } else if (minOv === overlapR) {
            // Karakterin sol kenarı küpün sağ kenarına girdi → karakteri sağa it
            state.x = cubeRight + charHalfWidth;
            cube.vx += state.vx * 0.4;
            cube.angularVelocity += state.vx * 0.01;
            state.vx = 0;
          } else if (minOv === overlapB) {
            // Karakterin kafası küpün altına girdi → karakteri aşağı it
            state.y = cubeBottom + 1;
            state.vy = Math.max(state.vy, 0); // yukarı hareketi kes
          }
        }
      }

      // Ekran Sınırları (Sağ / Sol)
      const halfWidth = (canvas.width / 2) - (DISPLAY_SIZE * SCALE / 4);
      if (state.x < -halfWidth) state.x = -halfWidth;
      if (state.x > halfWidth) state.x = halfWidth;

      // Animasyon Durumu Belirleme (Saldırı yoksa ve yere inme/zıplama hazırlığı bitmişse)
      // Run Start Tetikleyici: Shift basılı, hareket var, run'a geçmeden önce Start oyna
      if (
        state.keys.shift &&
        Math.abs(state.vx) > 10 &&
        !state.isRunStarting &&
        !state.isRunStopping &&
        !state.isRunSlowingToWalk &&
        !state.isJumping &&
        !state.isPreparingJump &&
        !state.isAttacking &&
        state.currentState !== "run" &&
        state.currentState !== "start"
      ) {
        state.isRunStarting = true;
        changeState("start");
      }

      // Run → Walk Tetikleyici: Koşarken shift bırakılır ama hareket devam ederse Start'ı ters oynat
      if (
        state.currentState === "run" &&
        !state.keys.shift &&
        Math.abs(state.vx) > 10 &&
        !state.isRunStopping &&
        !state.isRunStarting &&
        !state.isRunSlowingToWalk &&
        !state.isJumping &&
        !state.isPreparingJump &&
        !state.isAttacking
      ) {
        state.isRunSlowingToWalk = true;
        // changeState yerine doğrudan atıyoruz — changeState frameIndex'i sıfırlar!
        state.currentState = "start";
        state.prevFrameIndex = ANIMATIONS.start.frames - 1;
        state.frameIndex = ANIMATIONS.start.frames - 1; // Son frame'den başla (ters oynatma)
        state.frameTimer = 0;
      }

      // Run Stop Tetikleyici: Koşarken shift bırakılırsa Stop animasyonunu oynat
      // Yön değiştirme sırasında tetiklenmesin: hareket tuşu hâlâ basılıysa dur değil yön değişimi
      const noMovementInput = !state.keys.left && !state.keys.right &&
        (state.inputType !== "mouse" ||
          Math.abs(state.mouseX - (canvas.width / 2 + state.x)) <= PHYSICS.mouseWalkDistance);
      if (
        state.currentState === "run" &&
        !state.isRunStopping &&
        !state.isRunSlowingToWalk &&
        !state.isJumping &&
        !state.isPreparingJump &&
        !state.isAttacking &&
        noMovementInput &&
        (!state.keys.shift || Math.abs(state.vx) < 20)
      ) {
        state.isRunStopping = true;
        state.vx = 0;
        changeState("stop");
      }

      if (!state.isAttacking && !state.isLanding && !state.isPreparingJump && !state.isRunStopping && !state.isRunStarting && !state.isRunSlowingToWalk) {
        if (state.isJumping) {
          changeState("jump");
        } else if (Math.abs(state.vx) > 10) {
          if (state.keys.shift) {
            changeState("run");
          } else {
            changeState("walk");
          }
        } else {
          changeState("idle");
        }
      }
    
  // =============================================================
  // KÜPLER FİZİĞİ — İTERATİF CONSTRAINT SOLVER (8 iter)
  // Kural: Hiçbir obje bir diğerinin içine GİREMEZ.
  // =============================================================

  const GROUND_Y = 0;
  const SOLVER_ITERS = 8;

  // ---- ADIM 1: Sadece hareket (gravity + velocity integration) ----
  for (const cube of state.cubes) {
    if (cube.y > 120) {
      cube.y  = -900 - Math.random() * 600;
      cube.x  = (Math.random() - 0.5) * 700;
      cube.vy = 0; cube.vx = 0;
      cube.angularVelocity = 0; cube.angle = 0;
      continue;
    }
    cube.vy += PHYSICS.gravity * 0.45 * dt;
    cube.x  += cube.vx * dt;
    cube.y  += cube.vy * dt;
    // Açı sadece havadayken değişsin
    cube.angle += cube.angularVelocity * dt;
  }

  // ---- ADIM 2: İTERATİF CONSTRAINT SOLVER ----
  for (let iter = 0; iter < SOLVER_ITERS; iter++) {
    const applyImpulse = iter === 0; // Hız değişimi sadece ilk iterasyonda

    // 2a) Her küp: Zemin + Platform çarpışması
    for (const cube of state.cubes) {
      const h = cube.size / 2;

      // -- Ana Zemin --
      if (cube.y + h > GROUND_Y) {
        cube.y = GROUND_Y - h; // pozisyonu düzelt (tam otur)
        if (applyImpulse) {
          cube.vy = cube.vy > 20 ? cube.vy * -0.2 : 0;
        } else {
          cube.vy = Math.min(cube.vy, 0);
        }
        cube.vx *= 0.87;
        // Açı → sıfıra zorla (yerdeyken döndürme yok)
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
        const boxBottom = GROUND_Y; // platform zeminde bitiyor

        const cL = cube.x - h, cR = cube.x + h;
        const cT = cube.y - h, cB = cube.y + h;

        if (cR <= boxLeft || cL >= boxRight || cB <= boxTop || cT >= boxBottom) continue; // overlap yok

        // Hangi yüzeyden girdi? → en küçük penetrasyon = çözüm yönü
        const penL = cR - boxLeft;   // küp sağ kenar platform sol kenar içine ne kadar girdi
        const penR = boxRight - cL;  // küp sol kenar platform sağ kenar içine ne kadar girdi
        const penT = cB - boxTop;    // küp alt → platform üst (üstten iniş)
        const penB = boxBottom - cT; // küp üst → platform alt (alttan çıkış — bu çok büyük olur, ihmal et)

        // boxBottom çok büyük overlap verir, sadece gerçek üç yüzeyi karşılaştır
        const minPen = Math.min(penL, penR, penT);

        if (minPen === penT) {
          // ÜSTTEN İNİŞ
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
          // SOL YÜZDEN ÇARPI
          cube.x = boxLeft - h;
          if (applyImpulse && cube.vx > 0) cube.vx *= -0.25;
          else if (cube.vx > 0) cube.vx = 0;

        } else {
          // SAĞ YÜZDEN ÇARPI
          cube.x = boxRight + h;
          if (applyImpulse && cube.vx < 0) cube.vx *= -0.25;
          else if (cube.vx < 0) cube.vx = 0;
        }
      }
    }

    // 2b) Küp – Küp çarpışması (tüm çiftler)
    for (let i = 0; i < state.cubes.length; i++) {
      for (let j = i + 1; j < state.cubes.length; j++) {
        const c1 = state.cubes[i];
        const c2 = state.cubes[j];
        const h1 = c1.size / 2;
        const h2 = c2.size / 2;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const sepX = h1 + h2; // bu mesafeden yakınlarsa çakışıyorlar
        const sepY = h1 + h2;

        if (Math.abs(dx) >= sepX || Math.abs(dy) >= sepY) continue; // çakışmıyor

        const overlapX = sepX - Math.abs(dx);
        const overlapY = sepY - Math.abs(dy);

        if (overlapX <= overlapY) {
          // YATAY AYIRMA (daha az overlap yatay eksende)
          const push = overlapX * 0.5;
          const sx = dx >= 0 ? 1 : -1;
          c1.x -= push * sx;
          c2.x += push * sx;

          if (applyImpulse) {
            // Sadece yaklaşıyorlarsa hız değiştir (uzaklaşıyorlarsa zaten ok)
            const relVx = (c1.vx - c2.vx) * sx;
            if (relVx > 0) {
              const imp = relVx * 0.65; // elastisite
              c1.vx -= imp * sx;
              c2.vx += imp * sx;
              // Küçük dönme efekti
              c1.angularVelocity -= imp * 0.015 * sx;
              c2.angularVelocity += imp * 0.015 * sx;
            }
          }
        } else {
          // DİKEY AYIRMA (daha az overlap dikey eksende)
          const push = overlapY * 0.5;
          const sy = dy >= 0 ? 1 : -1;
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

  // ---- ADIM 3: Hava sürtünmesi (sadece havadaysa) ----
  for (const cube of state.cubes) {
    const h = cube.size / 2;
    const onGround = (cube.y + h) >= GROUND_Y - 0.5;
    let onPlatform = false;
    for (const box of BOXES) {
      const boxTop = -box.height + (state.boxSquish[box.id] || 0);
      const boxLeft = box.xOffset - box.width / 2;
      const boxRight = box.xOffset + box.width / 2;
      if (cube.x + h > boxLeft && cube.x - h < boxRight && Math.abs(cube.y + h - boxTop) < 2) {
        onPlatform = true; break;
      }
    }
    if (!onGround && !onPlatform) {
      cube.vx *= 0.997;
    }
  }
};


