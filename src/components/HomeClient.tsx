"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FlyingImages, FlyingImagesRef } from "@/components/FlyingImages";
import { ProjectData } from "@/types/project";

export default function HomeClient({ initialProjects }: { initialProjects: ProjectData[] }) {
  const flyingImagesRef = useRef<FlyingImagesRef>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const handleMouseEnter = (category: string) => {
    setHoveredCategory(category);
    flyingImagesRef.current?.warpTo(category);
  };

  const handleMouseLeave = () => {
    setHoveredCategory(null);
  };

  const getButtonClass = (category: string) => {
    if (hoveredCategory === null) {
      return "from-[var(--text-title)] to-[var(--text-title)]";
    }
    if (hoveredCategory !== category) {
      return "from-[var(--text-p)] to-[var(--text-p)]";
    }
    
    switch (category) {
      case "Burak":
        return "from-[#ff8003] to-[#ff2a5f]";
      case "products":
        return "from-[#b224ef] to-[#7579ff]";
      case "brands":
        return "from-[#11998e] to-[#38ef7d]";
      case "websites":
        return "from-[#00c6ff] to-[#0072ff]";
      default:
        return "from-[var(--text-title)] to-[var(--text-title)]";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative overflow-hidden flex flex-col">
      {/* ── Dynamic 3D Flying Images Background ── */}
      <FlyingImages ref={flyingImagesRef} initialProjects={initialProjects} />

      {/* ── 720px Ana Kapsayıcı ── */}
      <div className="w-full max-w-[720px] mx-auto px-6 flex-1 flex flex-col relative z-20 pointer-events-none">
        
        {/* ── Hero (dikeyde ortalı, ortalanmış) ── */}
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-[26px] sm:text-[36px] md:text-[44px] leading-[38px] sm:leading-[50px] md:leading-[58px] font-light tracking-tight text-center pointer-events-auto select-none flex flex-col gap-1.5 md:gap-2">
            <span className="block">
              <span className="text-[var(--text-p)] transition-all duration-300">{`Hello, I'm `}</span>
              <Link
                href="/about"
                onMouseEnter={() => handleMouseEnter("Burak")}
                onMouseLeave={handleMouseLeave}
                className={`${getButtonClass("Burak")} bg-gradient-to-r bg-clip-text text-transparent font-semibold inline-block cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-title)] rounded px-1`}
                aria-label="View about page"
              >
                Burak
              </Link>
              <span className="text-[var(--text-p)] transition-all duration-300">{`. I design `}</span>
            </span>
            
            <span className="block">
              <Link
                href="/projects"
                onMouseEnter={() => handleMouseEnter("products")}
                onMouseLeave={handleMouseLeave}
                className={`${getButtonClass("products")} bg-gradient-to-r bg-clip-text text-transparent font-semibold inline-block cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-title)] rounded px-1`}
                aria-label="View products projects"
              >
                products
              </Link>
              <span className="text-[var(--text-p)] transition-all duration-300">{`, `}</span>

              <Link
                href="/projects"
                onMouseEnter={() => handleMouseEnter("brands")}
                onMouseLeave={handleMouseLeave}
                className={`${getButtonClass("brands")} bg-gradient-to-r bg-clip-text text-transparent font-semibold inline-block cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-title)] rounded px-1`}
                aria-label="View brands projects"
              >
                brands
              </Link>
              <span className="text-[var(--text-p)] transition-all duration-300">{` and `}</span>

              <Link
                href="/projects"
                onMouseEnter={() => handleMouseEnter("websites")}
                onMouseLeave={handleMouseLeave}
                className={`${getButtonClass("websites")} bg-gradient-to-r bg-clip-text text-transparent font-semibold inline-block cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-title)] rounded px-1`}
                aria-label="View websites projects"
              >
                websites
              </Link>
            </span>
            
            <span className="block">
              <span className="text-[var(--text-p)] transition-all duration-300">{`that people love.`}</span>
            </span>
          </h1>
        </div>

      </div>
    </div>
  );
}
