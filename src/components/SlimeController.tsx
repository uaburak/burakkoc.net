"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/context/ThemeContext";

const SPRITE_SIZE = 128;
const SCALE = 1.25; // Karakteri küçülttük (Pixel Art estetiği)

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
  idle: { src: "/Blue_Slime/Idle.png", frames: 8, frameRate: 10, loop: true },
  walk: { src: "/Blue_Slime/walk.png", frames: 8, frameRate: 12, loop: true },
  run: { src: "/Blue_Slime/Run.png", frames: 7, frameRate: 15, loop: true },
  jump: { src: "/Blue_Slime/Jump.png", frames: 13, frameRate: 15, loop: false },
  attack1: { src: "/Blue_Slime/Attack_1.png", frames: 4, frameRate: 12, loop: false },
  attack2: { src: "/Blue_Slime/Attack_2.png", frames: 4, frameRate: 12, loop: false },
  attack3: { src: "/Blue_Slime/Attack_3.png", frames: 5, frameRate: 12, loop: false },
  run_attack: { src: "/Blue_Slime/Run+Attack.png", frames: 10, frameRate: 15, loop: false },
  hurt: { src: "/Blue_Slime/Hurt.png", frames: 6, frameRate: 12, loop: false },
  dead: { src: "/Blue_Slime/Dead.png", frames: 3, frameRate: 8, loop: false },
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
    hasMouseMoved: false,
    isJumping: false,
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
      const moveSpeed = state.keys.shift ? 400 : 150; // px/s
      const acceleration = 1500; // px/s^2
      const friction = 1000; // px/s^2
      const gravity = 2000; // px/s^2
      const jumpForce = -700; // px/s

      // Combo Reset Timer
      if (state.comboResetTimer > 0) {
        state.comboResetTimer -= dt;
        if (state.comboResetTimer <= 0) {
          state.attackCombo = 0; // Kombo sıfırlanır
        }
      }

      // Mouse Takip Mantığı (Eğer mouse hareket ettiyse sanal tuşlara bas)
      if (state.hasMouseMoved) {
        const characterScreenX = (canvas.width / 2) + state.x;
        const diffX = state.mouseX - characterScreenX;
        
        // Uzaklığa göre yürüme veya koşma belirle
        if (Math.abs(diffX) > 150) {
          state.keys.left = diffX < 0;
          state.keys.right = diffX > 0;
          state.keys.shift = true; // Hızlı koş
        } else if (Math.abs(diffX) > 40) {
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
      const isLocked = state.isAttacking && state.currentState !== "run_attack";
      
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

      if (state.keys.jump && !state.isJumping && !isLocked) {
        state.vy = jumpForce;
        state.isJumping = true;
        changeState("jump");
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
        }
      }

      // Ekran Sınırları (Sağ / Sol)
      const halfWidth = (canvas.width / 2) - (SPRITE_SIZE * SCALE / 4);
      if (state.x < -halfWidth) state.x = -halfWidth;
      if (state.x > halfWidth) state.x = halfWidth;

      // Animasyon Durumu Belirleme (Saldırı yoksa)
      if (!state.isAttacking) {
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

  // Mouse Event Listeners
  useEffect(() => {
    const state = engineRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      state.mouseX = e.clientX;
      state.hasMouseMoved = true;
    };

    const handleAttack = () => {
      if (!state.loaded) return;
      if (state.currentState === "dead" || state.currentState === "hurt") return;

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

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseClick);

    return () => {
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
