"use client";

import React, { useEffect, useRef, useState } from "react";
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
  walk: { src: "/Blue_Slime/walk.png", frames: 7, frameRate: 17, loop: true },
  run: { src: "/Blue_Slime/Run.png", frames: 7, frameRate: 25, loop: true },
  jump: { src: "/Blue_Slime/Jump.png", frames: 10, frameRate: 15, loop: false },
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
  walkDistancePerFrame: 5,  // Her yürüme karesinde 5 piksel
  runDistancePerFrame: 12,  // Her koşma karesinde 12 piksel

  acceleration: 2500,      // Hızlanma ivmesi (Çok daha tepkisel, anında hızlanır)
  friction: 2000,          // Yavaşlama/Sürtünme (Buzda kayma hissini yok eder, anında durur)
  gravity: 2400,           // Yerçekimi kuvveti (Daha tok ve gerçekçi düşüş)
  jumpForce: -850,         // Zıplama gücü (Tok yerçekimini yenecek tatlı bir zıplama)
  
  mouseRunDistance: 150,   // Fare ile karakter arasındaki mesafe bu değerden büyükse koşar
  mouseWalkDistance: 40,   // Fare ile karakter arasındaki mesafe bu değerden büyükse yürür (değilse durur)
};

export default function SlimeController() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const engineRef = useRef({
    images: {} as Record<string, HTMLImageElement>,
    loaded: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    direction: 1, // 1 = right, -1 = left
    currentState: "idle" as ActionState,
    frameIndex: 0,
    frameTimer: 0,
    keys: { left: false, right: false, shift: false, jump: false },
    mouseX: 0,
    inputType: "none" as "keyboard" | "mouse" | "none",
    isJumping: false,
    isPreparingJump: false,
    isLanding: false,
    isAttacking: false,
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

      const moveSpeed = state.keys.shift ? computedRunSpeed : computedWalkSpeed;
      const acceleration = PHYSICS.acceleration;
      const friction = PHYSICS.friction;
      const gravity = PHYSICS.gravity;
      const jumpForce = PHYSICS.jumpForce;

      // Combo Reset Timer
      if (state.comboResetTimer > 0) {
        state.comboResetTimer -= dt;
        if (state.comboResetTimer <= 0) {
          state.attackCombo = 0; // Kombo sıfırlanır
        }
      }

      // Mouse Takip Mantığı (Sadece Mouse Modundaysa)
      if (state.inputType === "mouse") {
        const characterScreenX = (canvas.width / 2) + state.x;
        const diffX = state.mouseX - characterScreenX;
        
        // Uzaklığa göre yürüme veya koşma belirle
        if (Math.abs(diffX) > PHYSICS.mouseRunDistance) {
          state.keys.left = diffX < 0;
          state.keys.right = diffX > 0;
          state.keys.shift = true; // Hızlı koş
        } else if (Math.abs(diffX) > PHYSICS.mouseWalkDistance) {
          state.keys.left = diffX < 0;
          state.keys.right = diffX > 0;
          state.keys.shift = false; // Yavaş yürü
        } else {
          // Hedefe yaklaştıysa dur
          state.keys.left = false;
          state.keys.right = false;
          state.keys.shift = false;
        }
      }

      // Horizontal Movement
      let moveDir = 0;
      if (state.keys.right) moveDir += 1;
      if (state.keys.left) moveDir -= 1;

      // Saldırı veya hasar alırken hareket engellensin (eğer run_attack değilse)
      const isLocked = (state.isAttacking && state.currentState !== "run_attack") || state.isLanding;
      
      if (!isLocked) {
        if (moveDir !== 0) {
          state.direction = moveDir;
          state.vx += moveDir * acceleration * dt;
          
          // Max hızı sınırla
          if (Math.abs(state.vx) > moveSpeed) {
            state.vx = Math.sign(state.vx) * moveSpeed;
          }
        } else {
          // Yavaşlama (Sürtünme)
          if (state.vx > 0) {
            state.vx = Math.max(0, state.vx - friction * dt);
          } else if (state.vx < 0) {
            state.vx = Math.min(0, state.vx + friction * dt);
          }
        }
      } else {
        // Kilitliyken hızla dur
        if (state.vx > 0) state.vx = Math.max(0, state.vx - friction * dt * 2);
        else if (state.vx < 0) state.vx = Math.min(0, state.vx + friction * dt * 2);
      }

      // Y ekseni (Yerçekimi ve Zıplama)
      state.vy += gravity * dt;

      if (state.keys.jump && !state.isJumping && !state.isPreparingJump && !isLocked) {
        state.isPreparingJump = true;
        changeState("jump"); // Zıplama animasyonunu başlat, ancak gücü sonra uygulayacağız
      }

      // Pozisyon Güncelleme
      state.x += state.vx * dt;
      state.y += state.vy * dt;

      // Ekran Sınırları (Yer düzlemi)
      const groundY = 0; // Kendi lokal eksenimizde yer
      if (state.y >= groundY) {
        state.y = groundY;
        state.vy = 0;
        
        if (state.isJumping) {
          state.isJumping = false;
          state.isLanding = true;
          // Yere inme başladı, zıplama animasyonunun son 4 karesine geç (index 6'dan 9'a)
          if (state.currentState === "jump") {
            state.frameIndex = 6;
            state.frameTimer = 0;
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

      const frameDuration = 1 / config.frameRate;
      state.frameTimer += dt;

      if (state.frameTimer >= frameDuration) {
        state.frameTimer = 0;
        
        if (state.currentState === "jump") {
          if (state.isPreparingJump) {
            // Yerdeki hazırlık evresi: ilk 3 kareyi oynat
            state.frameIndex++;
            if (state.frameIndex === 3) {
              // 3. kareye geldiğinde tam zıplama gücünü uygula ve havaya kalk!
              state.isPreparingJump = false;
              state.isJumping = true;
              state.vy = PHYSICS.jumpForce;
            }
          } else if (state.isJumping) {
            // Havadayız: 3'ten 5'e kadar ilerle ve 5'te havada asılı kal
            if (state.frameIndex < 5) {
              state.frameIndex++;
            }
          } else if (state.isLanding) {
            // Yere değdik: 6'dan 9'a kadar ilerle (Son 4 frame)
            if (state.frameIndex < 9) {
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
      if (!img) return;

      const sw = SPRITE_SIZE;
      const sh = SPRITE_SIZE;
      const sx = state.frameIndex * sw;
      const sy = 0;

      const dw = sw * SCALE;
      const dh = sh * SCALE;
      
      // Çizim koordinatları (Karakterin alt merkezi origin olacak şekilde)
      const dx = (canvas.width / 2) + state.x - (dw / 2);
      const dy = canvas.height - dh + state.y; // En alta hizala

      ctx.save();
      
      // Yön çevirme (Karakter sola bakıyorsa canvas'ı y ekseninde çevir)
      if (state.direction === -1) {
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, -dx - dw, dy, dw, dh);
      } else {
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
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

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Keyboard and Mouse Event Listeners
  useEffect(() => {
    const state = engineRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      // Sadece fareyi gerçekten oynattığında mouse moduna geç (ufak titremeleri yoksay)
      if (Math.abs(state.mouseX - e.clientX) > 2) {
        state.inputType = "mouse";
      }
      state.mouseX = e.clientX;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.code;
      // Tuşa basıldığında klavye moduna geç
      if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD", "ShiftLeft", "ShiftRight", "Space", "ArrowUp", "KeyW"].includes(key)) {
        state.inputType = "keyboard";
      }

      if (["ArrowLeft", "KeyA"].includes(key)) state.keys.left = true;
      if (["ArrowRight", "KeyD"].includes(key)) state.keys.right = true;
      if (["ShiftLeft", "ShiftRight"].includes(key)) state.keys.shift = true;
      if (["Space", "ArrowUp", "KeyW"].includes(key)) {
        state.keys.jump = true;
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault(); // Sayfa kaymasını engelle
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

    const handleAttack = () => {
      if (!state.loaded) return;
      if (state.currentState === "dead" || state.currentState === "hurt") return;

      state.isLanding = false; // İniş animasyonunu saldırı ile iptal et
      state.isPreparingJump = false; // Zıplama hazırlığını iptal et
      state.isAttacking = true;

      // Koşarken saldırı yapılıyorsa
      if (Math.abs(state.vx) > 200 && state.keys.shift && !state.isJumping) {
        state.currentState = "run_attack";
      } else {
        // Dururken veya yürürken kombo saldırılar
        state.attackCombo = (state.attackCombo % 3) + 1; // 1 -> 2 -> 3
        if (state.attackCombo === 1) state.currentState = "attack1";
        else if (state.attackCombo === 2) state.currentState = "attack2";
        else if (state.attackCombo === 3) state.currentState = "attack3";
      }

      state.frameIndex = 0;
      state.frameTimer = 0;
    };

    // Tüm ekranda tıklandığında saldırı animasyonu çalışsın (Linklere tıklamalar hariç)
    const handleMouseClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button")) return;
      handleAttack();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseClick);
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 w-full h-[180px] pointer-events-none z-20 flex flex-col items-center justify-center">
      <div ref={containerRef} className="w-full h-full">
        {/* Ana Render Alanı */}
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
