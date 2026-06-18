"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, memo } from "react";
import { listProjects } from "@/lib/firestore";
import { ProjectData } from "@/types/project";

interface ImageItem {
  url: string;
  projectSlug: string;
}

interface FlyingImage {
  id: number;
  url: string;
  projectSlug: string;
  x3d: number;
  y3d: number;
  z3d: number;
  speed: number;
  rotation: number;
  seed: number;
  aspectRatio: number; // width / height
  scaleMult: number;
  inFront?: boolean;
  lastBlur?: number;
}

export interface FlyingImagesRef {
  warpTo: (category: string) => void;
  setSlowMotion: (isSlow: boolean) => void;
}

const NUM_ITEMS = 16; // 16 active items for a rich starfield
const CONSTANT_SPEED = 95; // Fast linear speed

// Geometric slots covering all 360-degree directions (Left, Right, Top, Bottom, and Diagonals)
const GEOMETRIC_SLOTS = [
  // Left and Right Principal Axes
  { x3d: -75, y3d: 0,   scaleMult: 1.25, aspectRatio: 0.85 }, // Far Left
  { x3d: 75,  y3d: 0,   scaleMult: 1.25, aspectRatio: 0.85 }, // Far Right
  
  // Top and Bottom Principal Axes (Increased y3d from 55 to 75 to match horizontal velocity)
  { x3d: 0,   y3d: -75, scaleMult: 1.2,  aspectRatio: 1.33 }, // Far Top Center
  { x3d: 0,   y3d: 75,  scaleMult: 1.2,  aspectRatio: 1.0  }, // Far Bottom Center

  // Diagonals (Corners) (Increased x3d and y3d to stretch fully to the corners at high speed)
  { x3d: -65, y3d: -55, scaleMult: 1.1,  aspectRatio: 1.33 }, // Top Left Diagonal
  { x3d: 65,  y3d: -55, scaleMult: 1.1,  aspectRatio: 1.33 }, // Top Right Diagonal
  { x3d: -65, y3d: 55,  scaleMult: 1.1,  aspectRatio: 1.0  }, // Bottom Left Diagonal
  { x3d: 65,  y3d: 55,  scaleMult: 1.1,  aspectRatio: 1.0  }, // Bottom Right Diagonal

  // Medium Left/Right Offsets
  { x3d: -65, y3d: -18, scaleMult: 0.95, aspectRatio: 0.75 }, // Left-Top-Left
  { x3d: 65,  y3d: -18, scaleMult: 0.95, aspectRatio: 0.75 }, // Right-Top-Right
  { x3d: -65, y3d: 18,  scaleMult: 0.95, aspectRatio: 0.75 }, // Left-Bottom-Left
  { x3d: 65,  y3d: 18,  scaleMult: 0.95, aspectRatio: 0.75 }, // Right-Bottom-Right
  
  // Medium Top/Bottom Offsets (Increased y3d from 48 to 65 to make vertical bias stronger)
  { x3d: -30, y3d: -65, scaleMult: 1.0,  aspectRatio: 1.33 }, // Top-Top-Left
  { x3d: 30,  y3d: -65, scaleMult: 1.0,  aspectRatio: 1.33 }, // Top-Top-Right
  { x3d: -30, y3d: 65,  scaleMult: 1.0,  aspectRatio: 0.85 }, // Bottom-Bottom-Left
  { x3d: 30,  y3d: 65,  scaleMult: 1.0,  aspectRatio: 0.85 }  // Bottom-Bottom-Right
];

// Helper to collect all unique images from a list of projects
const collectImagesFromProjects = (projects: ProjectData[]): ImageItem[] => {
  const urls: ImageItem[] = [];
  projects.forEach((project) => {
    if (project.coverImage) {
      urls.push({ url: project.coverImage, projectSlug: project.slug });
    }
    project.items?.forEach((item) => {
      if (item.kind === "section" && item.blocks) {
        item.blocks.forEach((block) => {
          if (block.type === "image" && block.src) {
            urls.push({ url: block.src, projectSlug: project.slug });
          } else if (block.figmaCover) {
            urls.push({ url: block.figmaCover, projectSlug: project.slug });
          } else if (block.figmaWorkspaceCover) {
            urls.push({ url: block.figmaWorkspaceCover, projectSlug: project.slug });
          }
        });
      }
    });
  });
  return urls.filter((item, index, self) => self.findIndex((t) => t.url === item.url) === index);
};

// Filter images based on category strings
const filterImagesByCategory = (category: string, projects: ProjectData[]): ImageItem[] => {
  const allUrls = collectImagesFromProjects(projects);
  if (category === "Burak") {
    return allUrls;
  }

  const categoryLower = category.toLowerCase();
  const filteredProjects = projects.filter((project) => {
    const projCat = (project.category || "").toLowerCase();
    if (categoryLower === "products") {
      return projCat.includes("product") || projCat.includes("ürün");
    }
    if (categoryLower === "brands") {
      return projCat.includes("brand") || projCat.includes("marka") || projCat.includes("identity");
    }
    if (categoryLower === "websites") {
      return projCat.includes("web") || projCat.includes("site") || projCat.includes("ui");
    }
    if (categoryLower === "mobile app") {
      return projCat.includes("mobile") || projCat.includes("app") || projCat.includes("mobil") || projCat.includes("ios") || projCat.includes("android");
    }
    return false;
  });

  const urls = collectImagesFromProjects(filteredProjects);
  if (urls.length === 0) {
    return allUrls; // Fallback to all if none match
  }
  return urls;
};

// Custom depth-based opacity curve
const getOpacityForZ = (z: number): number => {
  if (z > 400) {
    // Fade in very faintly from 0 (at z=1000) to 0.12 (at z=400)
    return Math.max(0, ((1000 - z) / 600) * 0.12);
  }
  if (z >= 130) {
    // Once it passes the text depth (z <= 400), opacity rises rapidly to 0.9
    // Range: 400 to 130 (270 units), scaling from 0.12 to 0.9
    const val = 0.12 + ((400 - z) / 270) * 0.78;
    return Math.min(0.9, val);
  }
  // Fade out completely as it exits past z=130 to z=90
  return Math.max(0, ((z - 90) / 40) * 0.9);
};

interface FlyingImagesProps {
  initialProjects?: ProjectData[];
}

export const FlyingImages = memo(forwardRef<FlyingImagesRef, FlyingImagesProps>((props, ref) => {
  const [imagePool, setImagePool] = useState<ImageItem[]>(() => {
    if (props.initialProjects && props.initialProjects.length > 0) {
      return collectImagesFromProjects(props.initialProjects);
    }
    return [];
  });
  const projectsRef = useRef<ProjectData[]>(props.initialProjects || []);
  const poolRef = useRef<ImageItem[]>(
    props.initialProjects && props.initialProjects.length > 0
      ? collectImagesFromProjects(props.initialProjects)
      : []
  );

  const itemsRef = useRef<FlyingImage[]>([]);
  const domRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const isMobileRef = useRef(false);

  useEffect(() => {
    isMobileRef.current = window.innerWidth < 768;
  }, []);

  // Scroll and simulated scroll interaction references
  const wheelAccumulatorRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const scrollInjectRemainingRef = useRef(0);

  // Slow motion references
  const isSlowMotionRef = useRef(false);
  const currentBaseSpeedMultRef = useRef(1.0);

  // Helper to create a single particle
  const createItem = (id: number, pool: ImageItem[], randomZ = false): FlyingImage => {
    // For mount/initial state, select deterministically to match JSX paint. For resets, select randomly!
    const poolItem = randomZ
      ? (pool[id % pool.length] || pool[0])
      : (pool[Math.floor(Math.random() * pool.length)] || pool[0]);
      
    const slot = GEOMETRIC_SLOTS[id % GEOMETRIC_SLOTS.length];
    const z3d = randomZ ? 100 + id * (900 / NUM_ITEMS) : 1000;

    return {
      id,
      url: poolItem.url,
      projectSlug: poolItem.projectSlug,
      x3d: slot.x3d,
      y3d: slot.y3d,
      z3d,
      speed: CONSTANT_SPEED,
      rotation: 0,
      seed: 0,
      aspectRatio: slot.aspectRatio,
      scaleMult: slot.scaleMult,
      inFront: z3d < 250
    };
  };

  // Expose warpTo and setSlowMotion methods to parent components
  useImperativeHandle(ref, () => ({
    warpTo(category: string) {
      // 1. Immediately swap the image pool reference (extremely cheap, 0ms execution)
      const filteredPool = filterImagesByCategory(category, projectsRef.current);
      poolRef.current = filteredPool;

      // 2. Set the target to inject scroll delta gradually over multiple frames
      // This perfectly simulates a smooth manual scroll swipe, stretched out for longer travel feel
      scrollInjectRemainingRef.current = 1600;
    },
    setSlowMotion(isSlow: boolean) {
      isSlowMotionRef.current = isSlow;
    }
  }));

  // Load projects from database on mount if not provided as initial props
  useEffect(() => {
    if (props.initialProjects && props.initialProjects.length > 0) {
      // If we got initial projects, we don't query Firestore on mount
      return;
    }
    let active = true;
    listProjects()
      .then((projects) => {
        if (!active) return;
        projectsRef.current = projects;

        const uniqueUrls = collectImagesFromProjects(projects);
        if (uniqueUrls.length > 0) {
          poolRef.current = uniqueUrls;
          setImagePool(uniqueUrls); // Triggers render and animation loop once loaded
        }
      })
      .catch((err) => {
        console.error("Failed to load project images:", err);
      });

    return () => {
      active = false;
    };
  }, [props.initialProjects]);

  // Setup the animation loop (runs once when imagePool is loaded)
  useEffect(() => {
    if (imagePool.length === 0) return;

    // Initialize items with the loaded image pool
    const items = Array.from({ length: NUM_ITEMS }).map((_, i) => createItem(i, imagePool, true));
    itemsRef.current = items;

    // Set initial values on the DOM nodes (aspect ratio only; src matches the HTML paint)
    items.forEach((item, index) => {
      const el = domRefs.current[index];
      if (el) {
        el.style.aspectRatio = String(item.aspectRatio);
      }
    });

    const handleWheel = (e: WheelEvent) => {
      wheelAccumulatorRef.current += e.deltaY * 0.8;
    };

    window.addEventListener("wheel", handleWheel, { passive: true });

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const safeDt = Math.min(dt, 0.1);

      // Inject simulated scroll momentum gradually over multiple frames for buttery smooth build-up (reduced rate for longer travel)
      if (scrollInjectRemainingRef.current > 0) {
        const injectAmount = Math.min(scrollInjectRemainingRef.current, 80);
        wheelAccumulatorRef.current += injectAmount;
        scrollInjectRemainingRef.current -= injectAmount;
      }

      // Interpolate the base speed multiplier for smooth slow-motion transition
      const targetBaseSpeedMult = isSlowMotionRef.current ? 0.12 : 1.0; // 0.12x speed in slow motion
      currentBaseSpeedMultRef.current += (targetBaseSpeedMult - currentBaseSpeedMultRef.current) * 0.08;

      // Smooth interpolation of scroll velocity
      scrollVelocityRef.current += (wheelAccumulatorRef.current - scrollVelocityRef.current) * 0.1;
      // Exponential decay of the accumulator to return to resting state
      wheelAccumulatorRef.current *= 0.92;

      // Clamp velocity to absolute 0 if it gets extremely small
      if (Math.abs(scrollVelocityRef.current) < 0.05) {
        scrollVelocityRef.current = 0;
      }

      // Calculate the global warp speed multiplier based on current velocity and base speed
      const baseSpeedSample = CONSTANT_SPEED * currentBaseSpeedMultRef.current;
      const speedMultiplier = (baseSpeedSample + Math.abs(scrollVelocityRef.current * 2.2)) / CONSTANT_SPEED;

      itemsRef.current.forEach((item, index) => {
        const el = domRefs.current[index];
        if (!el) return;

        // Displacement: (base speed + scroll velocity) * safeDt
        const baseSpeed = item.speed * currentBaseSpeedMultRef.current;
        const dz = (baseSpeed + scrollVelocityRef.current * 2.2) * safeDt;
        item.z3d -= dz;

        // Reset logic
        if (dz >= 0) {
          if (item.z3d <= 90) {
            const newItem = createItem(item.id, poolRef.current, false);
            itemsRef.current[index] = newItem;

            const imgEl = imgRefs.current[index];
            if (imgEl) imgEl.src = newItem.url;
            el.style.aspectRatio = String(newItem.aspectRatio);
          }
        } else {
          if (item.z3d >= 1000) {
            const newItem = createItem(item.id, poolRef.current, false);
            newItem.z3d = 90;
            itemsRef.current[index] = newItem;

            const imgEl = imgRefs.current[index];
            if (imgEl) imgEl.src = newItem.url;
            el.style.aspectRatio = String(newItem.aspectRatio);
          }
        }

        const currentItem = itemsRef.current[index];
        const z = currentItem.z3d;

        // Perspective Projection Math (constant FOV of 130 to keep scale and position in perfect mathematical sync)
        const fov = 130;
        const posX = (currentItem.x3d / z) * fov;
        const posY = (currentItem.y3d / z) * fov;

        // Scale (clamped to a maximum of 1.8 to prevent layout overflow during extreme warp spikes)
        const scale = Math.min(1.8, (110 / z) * currentItem.scaleMult);

        // Opacity
        const opacity = getOpacityForZ(z);

        // Blur: far away images are blurry, close are sharp. Speed adds motion blur.
        const warpBlur = (speedMultiplier - 1.0) * 0.4;
        const baseBlur = Math.max(0, ((z - 300) / 700) * 4) + warpBlur;
        const blur = isMobileRef.current ? 0 : baseBlur;

        // Apply styles directly (optimized to avoid layout thrashing and unnecessary writes)
        el.style.transform = `translate(-50%, -50%) translate3d(${posX}vw, ${posY}vh, 0) scale(${scale})`;
        el.style.opacity = String(opacity);

        // Throttle blur filter updates to avoid heavy rendering layout calculations on fractional changes
        const roundedBlur = Math.round(blur * 10) / 10;
        if (currentItem.lastBlur !== roundedBlur) {
          currentItem.lastBlur = roundedBlur;
          if (roundedBlur > 0.05) {
            el.style.filter = `blur(${roundedBlur}px)`;
          } else {
            el.style.filter = "";
          }
        }

        // Layer z-index optimization
        const inFront = z < 250;
        if (currentItem.inFront !== inFront) {
          currentItem.inFront = inFront;
          el.style.zIndex = inFront ? "30" : "5";
        }
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [imagePool]);

  // Wait until imagePool loads from Firestore so we have valid URLs to render in JSX
  if (imagePool.length === 0) {
    return <div className="absolute inset-0 pointer-events-none select-none z-10 w-full h-full" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10 w-full h-full">
      {Array.from({ length: NUM_ITEMS }).map((_, index) => {
        const slot = GEOMETRIC_SLOTS[index % GEOMETRIC_SLOTS.length];
        const initialZ = 100 + index * (900 / NUM_ITEMS);
        const initialFov = 130;
        const initialPosX = (slot.x3d / initialZ) * initialFov;
        const initialPosY = (slot.y3d / initialZ) * initialFov;
        const initialScale = (110 / initialZ) * slot.scaleMult;
        
        const initialOpacity = getOpacityForZ(initialZ);

        const initialBlur = Math.max(0, ((initialZ - 300) / 700) * 4);

        // Select initial image deterministically to guarantee HTML matches loop state exactly
        const initialImgItem = imagePool[index % imagePool.length] || imagePool[0];

        return (
          <div
            key={index}
            ref={(el) => {
              domRefs.current[index] = el;
            }}
            className="absolute select-none pointer-events-none rounded-lg border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden w-[150px] md:w-[200px] shadow-md"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate3d(${initialPosX}vw, ${initialPosY}vh, 0) scale(${initialScale})`,
              opacity: initialOpacity,
              filter: initialBlur > 0.05 ? `blur(${initialBlur}px)` : undefined,
              willChange: "transform, opacity",
            }}
          >
            <img
              ref={(el) => {
                imgRefs.current[index] = el;
              }}
              src={initialImgItem?.url}
              alt="portfolio work"
              className="w-full h-full object-cover select-none pointer-events-none"
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}));

FlyingImages.displayName = "FlyingImages";
