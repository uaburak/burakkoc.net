"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

import { GameState, ActionState } from "./types";
import { ANIMATIONS, PHYSICS } from "./constants";
import { getInitialState } from "./state";
import { setupInputs } from "./input";
import { updatePhysics } from "./physics";
import { updateAnimation } from "./animation";
import { renderGame } from "./renderer";
// PlatformBoxes — bileşen dosyası mevcut, kullanıma açmak için buraya import ekle:
// import { PlatformBoxes } from "./PlatformBoxes";

export default function SlimeController() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const router = useRouter();

  const engineRef = useRef<GameState>(getInitialState(theme));

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const darkStates = ["idle", "walk", "run", "jump"];
    const states = Object.keys(ANIMATIONS) as ActionState[];

    const imageLoadList: { themeKey: "light" | "dark"; stateKey: ActionState; src: string }[] = [];

    states.forEach((stateKey) => {
      const config = ANIMATIONS[stateKey];
      imageLoadList.push({ themeKey: "light", stateKey, src: config.src });

      if (darkStates.includes(stateKey)) {
        imageLoadList.push({ themeKey: "dark", stateKey, src: config.src.replace(".png", "-dark.png") });
      }
    });

    const totalImages = imageLoadList.length;
    const state = engineRef.current;

    imageLoadList.forEach(({ themeKey, stateKey, src }) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        state.images[themeKey][stateKey] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          states.forEach((s) => {
            if (!state.images.dark[s]) {
              state.images.dark[s] = state.images.light[s];
            }
          });
          state.loaded = true;
        }
      };
    });

    // Küpler — aktif etmek için:
    // state.cubes = Array.from({ length: 15 }).map((_, i) => ({
    //   x: (Math.random() - 0.5) * 800,
    //   y: -1000 - (i * 300) - Math.random() * 200,
    //   vx: 0, vy: 0,
    //   angle: Math.random() * Math.PI * 2,
    //   angularVelocity: 0,
    //   size: 48,
    //   active: true
    // }));
  }, []);

  // Sync theme
  useEffect(() => {
    engineRef.current.theme = theme;
  }, [theme]);

  // Main Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const safeDt = Math.min(dt, 0.1);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          ctx.imageSmoothingEnabled = false;
        }
      }

      updatePhysics(state, safeDt, canvas, router, changeState, () => {});
      updateAnimation(state, safeDt);
      renderGame(ctx, canvas, state);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [router]);

  // Inputs
  useEffect(() => {
    const state = engineRef.current;

    const triggerAttack = () => {
      if (state.isAttacking) return;
      if (state.currentState === "run" || state.currentState === "run_attack") {
        state.isAttacking = true;
        state.currentState = "run_attack";
        state.frameIndex = 0;
        state.frameTimer = 0;
      } else {
        state.isAttacking = true;
        state.attackCombo = (state.attackCombo % 3) + 1;
        state.comboResetTimer = 0.5;
        state.currentState = `attack${state.attackCombo}` as ActionState;
        state.frameIndex = 0;
        state.frameTimer = 0;
        state.vx = 0;
      }
    };

    const cleanupInputs = setupInputs(
      canvasRef.current!,
      state,
      triggerAttack,
      router,
      PHYSICS
    );

    return cleanupInputs;
  }, [router]);

  return (
    <div className="fixed bottom-0 left-0 w-full h-screen pointer-events-none z-20">
      <div ref={containerRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full block pointer-events-auto" />
      </div>
    </div>
  );
}
