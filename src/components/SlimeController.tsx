"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

const SPRITE_SIZE = 128;
const SCALE = 0.8; // Karakteri 64px boyutuna küçülttük

type ActionState =
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

// Her animasyonun kaç kareden oluştuğu bilgisi
const ANIMATIONS: Record<ActionState, { src: string; frames: number; frameRate: number; loop: boolean }> = {
  idle: { src: "/Blue_Slime/Idle.png", frames: 7, frameRate: 12, loop: true },
  walk: { src: "/Blue_Slime/walk.png", frames: 4, frameRate: 8, loop: true },
  run: { src: "/Blue_Slime/Run.png", frames: 7, frameRate: 25, loop: true },
  jump: { src: "/Blue_Slime/Jump.png", frames: 11, frameRate: 15, loop: false },
  attack1: { src: "/Blue_Slime/Attack_1.png", frames: 4, frameRate: 12, loop: false },
  attack2: { src: "/Blue_Slime/Attack_2.png", frames: 4, frameRate: 12, loop: false },
  attack3: { src: "/Blue_Slime/Attack_3.png", frames: 5, frameRate: 12, loop: false },
  run_attack: { src: "/Blue_Slime/Run+Attack.png", frames: 10, frameRate: 15, loop: false },
  hurt: { src: "/Blue_Slime/Hurt.png", frames: 6, frameRate: 12, loop: false },
  dead: { src: "/Blue_Slime/Dead.png", frames: 3, frameRate: 8, loop: false },
};

// Fizik ve Hareket Ayarları (Değerleri buradan kolayca değiştirebilirsin)
const PHYSICS = {
  // --- Mod Seçimi ---
  // true: Hızı animasyon karesine göre hesaplar (Ayak kaymasını önler, ultra gerçekçi)
  useFrameBasedDistance: true,

  // Mod: FALSE iken kullanılacak sabit hızlar (px/s)
  walkSpeed: 80,          
  runSpeed: 250,           
  
  // Mod: TRUE iken kullanılacak kare başına mesafe (px/frame)
  walkDistancePerFrame: 10, // Her yürüme karesinde 10 piksel (4 karelik animasyon için hız korundu)
  runDistancePerFrame: 12,  // Her koşma karesinde 12 piksel

  acceleration: 2500,      // Hızlanma ivmesi (Çok daha tepkisel, anında hızlanır)
  friction: 2000,          // Yerde Yavaşlama/Sürtünme (Anında durur)
  airFriction: 0,          // Havadayken sürtünme (Momentumu koruması için 0)
  gravity: 2400,           // Yerçekimi kuvveti (Daha tok ve gerçekçi düşüş)
  jumpForce: -850,         // Zıplama gücü (Tok yerçekimini yenecek tatlı bir zıplama)
  doubleJumpThreshold: 650, // Double jump için minimum yükseklik eşiği (jumpForce ölçeğinde)
  
  mouseRunDistance: 150,   // Fare ile karakter arasındaki mesafe bu değerden büyükse koşar
  mouseWalkDistance: 40,   // Fare ile karakter arasındaki mesafe bu değerden büyükse yürür (değilse durur)
  
  // Sprite ayak ofseti: Sprite'ın alt kısmındaki şeffaf pikselleri telafi eder
  // Pozitif değer = sprite yukarı çekilir (ayaklar zemine oturur)
  footOffsetY: 0,
};

// ── Kutu Yükseklik Ayarları (Hızlı Ayar) ──
const BOX_DEFAULT_HEIGHT = 200;  // Kutunun normal yüksekliği
const BOX_ACTIVE_HEIGHT = 175;   // Karakter üstündeyken yükseklik (yaylanma sonrası)

// Yönlendirme Platformları (Kutular)
const BOXES = [
  { id: "about", label: "About me", width: 140, height: BOX_DEFAULT_HEIGHT, xOffset: -270, href: "/about" },
  { id: "projects", label: "Projects", width: 140, height: BOX_DEFAULT_HEIGHT, xOffset: 0, href: "/projects" },
  { id: "cv", label: "e-cv", width: 140, height: BOX_DEFAULT_HEIGHT, xOffset: 270, href: "/cv" }
];

export default function SlimeController() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const router = useRouter();
  
  const [activeBox, setActiveBox] = useState<string | null>(null);
  const [squishValues, setSquishValues] = useState<Record<string, number>>({ about: 0, projects: 0, cv: 0 });

  // Kaydedilmiş pozisyonu yükle (sayfa değişimlerinde karakterın konumunu koru)
  const savedPos = typeof window !== 'undefined' 
    ? (() => {
        try {
          const raw = sessionStorage.getItem('slime_pos');
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })()
    : null;

  const engineRef = useRef({
    images: {} as Record<string, HTMLImageElement>,
    loaded: false,
    x: savedPos?.x ?? 0,
    y: savedPos ? savedPos.y : -1200, // Kayıtlı pozisyon varsa oradan, yoksa yukarıdan düşsün
    vx: 0,
    vy: 0,
    direction: savedPos?.dir ?? 1,
    currentState: (savedPos ? "idle" : "jump") as ActionState,
    frameIndex: savedPos ? 0 : 6,
    frameTimer: 0,
    keys: { left: false, right: false, shift: false, jump: false },
    mouseX: 0,
    inputType: "none" as "keyboard" | "mouse" | "none",
    isJumping: savedPos ? false : true,
    canDoubleJump: false,
    isPreparingJump: false,
    isLanding: false,
    jumpBuffered: false, // Havadayken zıplama tuşuna basıldıysa yere değince hemen zıpla
    jumpOriginY: 0, // Zıplamanın başladığı Y konumu (yükseklik hesabı için)
    landingGraceTimer: 0, // Yere indikten sonra hızlı zıplama penceresi (saniye)
    isAttacking: false,
    activeBox: null as string | null,
    prevActiveBox: null as string | null, // Önceki aktif kutu (renk değişimi tetiklemek için)
    autoPilotTarget: null as string | null,
    autoPilotRoute: null as string | null,
    autoPilotLocked: false, // Hedefe ulaşınca karakter kilitlenir
    boxSquish: {
      about: 0,
      projects: 0,
      cv: 0
    } as Record<string, number>, // 0 = normal, pozitif = aşağı kayma miktarı (piksel)
    boxSquishVelocity: {
      about: 0,
      projects: 0,
      cv: 0
    } as Record<string, number>,
    lastLandingVy: 0, // İniş anındaki dikey hız (squish hesabı için)
    attackCombo: 0,
    comboResetTimer: 0,
  });

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const totalImages = Object.keys(ANIMATIONS).length;
    const state = engineRef.current;

    Object.entries(ANIMATIONS).forEach(([key, config]) => {
      const img = new Image();
      img.src = config.src;
      img.onload = () => {
        state.images[key] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          state.loaded = true;
        }
      };
    });
  }, []);

  // Main Game Loop & Input Listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Keskin pikseller için
    ctx.imageSmoothingEnabled = false;

    const state = engineRef.current;
    let animationFrameId: number;
    let lastTime = performance.now();
    let hadSquishLastFrame = false;

    const changeState = (newState: ActionState) => {
      if (state.currentState === newState) return;
      state.currentState = newState;
      state.frameIndex = 0;
      state.frameTimer = 0;
    };

    const updatePhysics = (dt: number) => {
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

      // Saldırı veya hasar alırken hareket engellensin (eğer run_attack değilse)
      // Landing sırasında grace timer aktifse zıplamaya izin ver
      const isLocked = (state.isAttacking && state.currentState !== "run_attack") || (state.isLanding && state.landingGraceTimer <= 0);
      
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
            currentGroundY = boxTop;
            newActiveBox = box.id;
          }
          // Yeni iniş: sıkı kontrol (sadece ilk temas için)
          else if (prevCharBottom <= boxTop + 3) {
            if (state.y >= boxTop) {
              currentGroundY = boxTop;
              newActiveBox = box.id;
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

      // Ekran Sınırları (Sağ / Sol)
      const halfWidth = (canvas.width / 2) - (SPRITE_SIZE * SCALE / 4);
      if (state.x < -halfWidth) state.x = -halfWidth;
      if (state.x > halfWidth) state.x = halfWidth;

      // Animasyon Durumu Belirleme (Saldırı yoksa ve yere inme/zıplama hazırlığı bitmişse)
      if (!state.isAttacking && !state.isLanding && !state.isPreparingJump) {
        if (state.isJumping) {
          changeState("jump");
        } else if (Math.abs(state.vx) > 10) {
          if (state.keys.shift && Math.abs(state.vx) > 200) {
            changeState("run");
          } else {
            changeState("walk");
          }
        } else {
          changeState("idle");
        }
      }
    };

    const updateAnimation = (dt: number) => {
      const config = ANIMATIONS[state.currentState];
      if (!config) return;

      // Havadayken (vy'ye bağlı özel mantık)
      if (state.currentState === "jump" && state.isJumping) {
        if (state.vy < -250) {
          // Yükselişte: 3, 4, 5. frameler (Index 2, 3, 4)
          state.frameTimer += dt;
          if (state.frameTimer >= (1 / config.frameRate)) {
            state.frameTimer = 0;
            if (state.frameIndex < 2) state.frameIndex = 2;
            else if (state.frameIndex < 4) state.frameIndex++;
          }
        } else if (state.vy > 250) {
          // Düşüşte: 7. frame (Index 6)
          state.frameIndex = 6;
        } else {
          // Zirve noktasında: 6. frame (Index 5)
          state.frameIndex = 5;
        }
        return; // Havadayken normal animasyon döngüsünü pas geç
      }

      const frameDuration = 1 / config.frameRate;
      state.frameTimer += dt;

      if (state.frameTimer >= frameDuration) {
        state.frameTimer = 0;
        
        if (state.currentState === "jump") {
          if (state.isPreparingJump) {
            // Yerdeki hazırlık evresi: ilk 2 kareyi oynat (Index 0 ve 1)
            state.frameIndex++;
            if (state.frameIndex === 2) {
              // 3. kareye (Index 2) geldiğinde tam zıplama gücünü uygula ve havaya kalk!
              state.isPreparingJump = false;
              state.isJumping = true;
              state.canDoubleJump = true; // Double jump hakkı verildi
              state.vy = PHYSICS.jumpForce;
            }
          } else if (state.isLanding) {
            // Yere değdik: 8'den 11'e kadar ilerle (Index 7'den 10'a)
            if (state.frameIndex < 10) {
              state.frameIndex++;
            } else {
              state.isLanding = false; // İniş animasyonu bitti
            }
          }
        } else {
          // Diğer animasyonlar için standart oynatma
          state.frameIndex++;

          // Animasyon bitişi kontrolü
          if (state.frameIndex >= config.frames) {
            if (config.loop) {
              state.frameIndex = 0;
            } else {
              state.frameIndex = config.frames - 1; // Son karede kal
              
              // Tek seferlik aksiyon bittiyse (saldırı vs.) normale dön
              if (state.isAttacking) {
                state.isAttacking = false;
                state.comboResetTimer = 0.5; // 0.5 saniye içinde tekrar tıklarsa kombo devam eder
              }
            }
          }
        }
      }
    };

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!state.loaded) return;

      const config = ANIMATIONS[state.currentState];
      const img = state.images[state.currentState];
      if (!img) {
        ctx.fillStyle = "red";
        ctx.font = "20px sans-serif";
        ctx.fillText(`Error: Missing image for state '${state.currentState}'`, 20, 40);
        return;
      }

      // Dinamik kaynak boyutu (Görsellerin çözünürlüğü farklı olabilir, örn: 512x512 veya 128x128)
      const sw = img.width / config.frames;
      const sh = img.height;
      const sx = state.frameIndex * sw;
      const sy = 0;

      // Ekrana çizilecek boyut (Tüm farklı çözünürlükleri sabit bir boyuta oturturuz)
      const baseSpriteSize = 128; // Orijinal referans boyut
      const dw = baseSpriteSize * SCALE;
      const dh = baseSpriteSize * SCALE;
      
      // Çizim koordinatları (Karakterin alt merkezi origin olacak şekilde)
      // footOffsetY: Sprite'taki şeffaf alt bölgeyi telafi ederek ayakları zemine oturtur
      const dx = (canvas.width / 2) + state.x - (dw / 2);
      const dy = canvas.height - dh + state.y + PHYSICS.footOffsetY;

      ctx.save();
      
      // Yön çevirme (Karakter sola bakıyorsa canvas'ı y ekseninde çevir)
      if (state.direction === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, -dx - dw, dy, dw, dh);
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      }

      ctx.restore();

      // Debug Log (Sağ üst köşe)
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.roundRect ? ctx.roundRect(canvas.width - 220, 20, 200, 110, 8) : ctx.rect(canvas.width - 220, 20, 200, 110);
      ctx.fill();
      
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      // X: 0 sol kenar, Y: 0 alt kenar olacak şekilde hesaplıyoruz
      const displayX = Math.round(canvas.width / 2 + state.x);
      const displayY = Math.round(-state.y);
      
      ctx.fillText(`X: ${displayX} px`, canvas.width - 200, 50);
      ctx.fillText(`Y: ${displayY} px`, canvas.width - 200, 80);
      
      if (state.autoPilotTarget) {
         ctx.fillStyle = "#a8e6cf";
         ctx.fillText(`Target: ${state.autoPilotTarget}`, canvas.width - 200, 110);
      }
      ctx.restore();
    };

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000; // Saniye cinsinden Delta Time
      lastTime = time;

      // Sabit ve pürüzsüz delta time için ufak bir cap (sekme engellemek için)
      const safeDt = Math.min(dt, 0.1);

      // Canvas boyutunu eşitle (Responsive)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          ctx.imageSmoothingEnabled = false; // Boyut değişince resetlenir
        }
      }

      updatePhysics(safeDt);
      updateAnimation(safeDt);
      render();

      // Squish değerlerini React state'e sync et (her karede)
      const sq = state.boxSquish;
      const hasSquish = sq.about !== 0 || sq.projects !== 0 || sq.cv !== 0;
      if (hasSquish || hadSquishLastFrame) {
        setSquishValues({ about: sq.about, projects: sq.projects, cv: sq.cv });
      }
      hadSquishLastFrame = hasSquish;

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Keyboard and Mouse Event Listeners
  useEffect(() => {
    const state = engineRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      // Otopilot aktifken mouse takibini devre dışı bırak
      if (state.autoPilotTarget) {
        state.mouseX = e.clientX;
        return;
      }
      if (Math.abs(state.mouseX - e.clientX) > 2) {
        state.inputType = "mouse";
      }
      state.mouseX = e.clientX;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Eğer tıklanan şey bir platform kutusu veya link/buton değilse zıpla
      if (!target.closest('.platform-box') && !target.closest('a') && !target.closest('button')) {
        // Double jump kontrolü (Klavye ile aynı mantık)
        if (!state.keys.jump) {
          const currentHeight = state.jumpOriginY - state.y;
          const maxJumpHeight = (PHYSICS.jumpForce * PHYSICS.jumpForce) / (2 * PHYSICS.gravity);
          const minDoubleJumpHeight = (PHYSICS.doubleJumpThreshold / Math.abs(PHYSICS.jumpForce)) * maxJumpHeight;
          
          if (
            state.isJumping &&
            state.canDoubleJump &&
            state.currentState === "jump" &&
            currentHeight >= minDoubleJumpHeight
          ) {
            state.canDoubleJump = false;
            state.jumpBuffered = false;
            state.jumpOriginY = state.y;
            state.vy = PHYSICS.jumpForce;
            state.frameIndex = 2;
            state.frameTimer = 0;
          }
          else if (state.isJumping || state.isLanding) {
            state.jumpBuffered = true;
          }
        }
        state.keys.jump = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      state.keys.jump = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.code;
      if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD", "ShiftLeft", "ShiftRight", "Space", "ArrowUp", "KeyW"].includes(key)) {
        state.inputType = "keyboard";
      }

      if (["ArrowLeft", "KeyA"].includes(key)) state.keys.left = true;
      if (["ArrowRight", "KeyD"].includes(key)) state.keys.right = true;
      if (["ShiftLeft", "ShiftRight"].includes(key)) state.keys.shift = true;
      if (["Space", "ArrowUp", "KeyW"].includes(key)) {
        if (!state.keys.jump) {
          const currentHeight = state.jumpOriginY - state.y; // Pozitif = yukarıda
          const maxJumpHeight = (PHYSICS.jumpForce * PHYSICS.jumpForce) / (2 * PHYSICS.gravity);
          const minDoubleJumpHeight = (PHYSICS.doubleJumpThreshold / Math.abs(PHYSICS.jumpForce)) * maxJumpHeight;
          
          if (
            state.isJumping && 
            state.canDoubleJump && 
            state.currentState === "jump" &&
            currentHeight >= minDoubleJumpHeight // Yükseklik eşiğinin üstünde mi?
          ) {
            // Double jump! Aynı güçle zıpla
            state.canDoubleJump = false;
            state.jumpBuffered = false;
            state.jumpOriginY = state.y;
            state.vy = PHYSICS.jumpForce; // Tam güçle zıpla
            state.frameIndex = 2;
            state.frameTimer = 0;
          }
          // Eşiğin altındaysa veya double jump hakkı yoksa → buffer
          else if (state.isJumping || state.isLanding) {
            state.jumpBuffered = true;
          }
        }
        
        state.keys.jump = true;
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
        }
      }
      if (key === "Enter") {
        if (state.activeBox) {
          const box = BOXES.find(b => b.id === state.activeBox);
          if (box) router.push(box.href);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.code;
      if (["ArrowLeft", "KeyA"].includes(key)) state.keys.left = false;
      if (["ArrowRight", "KeyD"].includes(key)) state.keys.right = false;
      if (["ShiftLeft", "ShiftRight"].includes(key)) state.keys.shift = false;
      if (["Space", "ArrowUp", "KeyW"].includes(key)) state.keys.jump = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [router]);

  return (
    <div className="fixed bottom-0 left-0 w-full h-screen pointer-events-none z-20">
      
      {/* Platform Kutuları */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {BOXES.map((box) => {
          const isActive = activeBox === box.id;
          const squishAmount = squishValues[box.id] || 0;

          // Sadece üstündeyken teal, değilse dark/light mode renkleri
          const bgColor = isActive
            ? '#a8e6cf'
            : (theme === 'dark' ? '#374151' : '#e5e7eb');
          const textColor = isActive
            ? '#134e4a'
            : (theme === 'dark' ? '#d1d5db' : '#1f2937');

          return (
            <div
              key={box.id}
              onClick={() => {
                if (isActive) {
                  router.push(box.href);
                } else {
                  engineRef.current.autoPilotTarget = box.id;
                  engineRef.current.autoPilotRoute = box.href;
                  engineRef.current.inputType = "none"; // Mouse takibini durdur
                }
              }}
              style={{
                left: "50%",
                transform: `translateX(calc(-50% + ${box.xOffset}px))`,
                width: `${box.width}px`,
                height: `${box.height - squishAmount}px`,
                backgroundColor: bgColor,
                color: textColor,
                transition: 'background-color 0.3s ease, color 0.3s ease',
              }}
              className="platform-box absolute bottom-0 flex items-center justify-center cursor-pointer font-medium pointer-events-auto"
            >
              {box.label}
            </div>
          );
        })}
      </div>

      <div ref={containerRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {/* Ana Render Alanı */}
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
