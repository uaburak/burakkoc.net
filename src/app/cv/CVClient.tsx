"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ArrowLeftIcon } from "@/components/icons";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import ScrollReveal from "@/components/ScrollReveal";
import PageEntrance from "@/components/PageEntrance";
import { TopBar } from "@/components/TopBar";
import { listProjects } from "@/lib/firestore";
import { ProjectData } from "@/types/project";
import { ZoomableImage } from "@/components/ZoomableImage";

function getProjectCoverImage(proj?: ProjectData | null): string | null {
  if (!proj) return null;
  if (proj.coverImage) return proj.coverImage;
  for (const item of proj.items) {
    if (item.kind === "section") {
      const imgBlock = item.blocks.find((b) => b.type === "image" && b.src);
      if (imgBlock?.src) return imgBlock.src;
    }
  }
  return null;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const experience = [
  {
    year: "Jul 2024 — Present",
    company: "Anex Tour",
    role: "UX/UI Designer",
    description:
      "Designing user interfaces and experiences for one of Turkey's leading tour operators. Responsible for end-to-end UX design of digital touchpoints across web and mobile platforms.",
  },
  {
    year: "Dec 2022 — Apr 2024",
    company: "DGTLFACE | Technology Partner",
    role: "UX/UI Designer",
    description:
      "Designed digital products and interfaces for a technology partner studio. Worked across multiple client projects delivering high-fidelity UI designs, prototypes, and design systems.",
  },
  {
    year: "Jun 2022 — Nov 2022",
    company: "Ideapol Digital Media Agency",
    role: "Graphic Designer",
    description:
      "Created visual assets and design materials for digital media campaigns. Collaborated closely with creative and marketing teams to produce compelling brand communications.",
  },
  {
    year: "Aug 2016 — Nov 2021",
    company: "Turpaksan Ltd. Şti. Hobby House",
    role: "Graphic Designer",
    description:
      "Developed brand identities, print materials, and digital visuals. Managed multiple design projects simultaneously while maintaining consistent brand standards.",
  },
  {
    year: "Feb 2012 — ∞",
    company: "Freelance",
    role: "Graphic Designer",
    description:
      "Independent graphic design work for a diverse range of clients. Services include branding, visual identity, print design, and digital illustration.",
  },
];

const education = [
  {
    year: "2017 — 2019",
    institution: "Tokat Gazi Osman Paşa Üniversitesi",
    degree: "Turhal MYO — Grafik Tasarım Bölümü",
    description:
      "Associate degree in Graphic Design. Gained a strong foundation in visual communication, typography, and digital design tools.",
  },
  {
    year: "2010 — 2014",
    institution: "Tokat Otelcilik ve Turizm Meslek Lisesi",
    degree: "Yiyecek İçecek Hizmetleri Mutfak Bölümü",
    description:
      "Vocational high school with a focus on hospitality and food & beverage services.",
  },
];

const skillsList = [
  { name: "Figma", level: 95, iconType: "figma" },
  { name: "Illustrator", level: 95, iconType: "illustrator" },
  { name: "Photoshop", level: 90, iconType: "photoshop" },
  { name: "AI Models", level: 80, iconType: "ai" },
  { name: "Indesign", level: 45, iconType: "indesign" },
  { name: "Office", level: 60, iconType: "office" },
  { name: "After Effect", level: 55, iconType: "aftereffect" },
  { name: "HTML", level: 65, iconType: "html" },
  { name: "CSS", level: 80, iconType: "css" },
  { name: "Tailwind CSS", level: 35, iconType: "tailwind" },
];

function SkillIcon({ type }: { type: string }) {
  switch (type) {
    case "figma":
      return (
        <div className="w-6 h-6 rounded bg-[#111111] flex items-center justify-center select-none shrink-0">
          <svg viewBox="0 0 36 54" className="w-2.5 h-[15px] shrink-0">
            <path d="M9 0C4.03 0 0 4.03 0 9C0 13.97 4.03 18 9 18H18V0H9Z" fill="#F24E1E"/>
            <path d="M27 0C22.03 0 18 4.03 18 9V18H27C31.97 18 36 13.97 36 9C36 4.03 31.97 0 27 0Z" fill="#FF7262"/>
            <path d="M9 18C4.03 18 0 22.03 0 27C0 31.97 4.03 36 9 36C13.97 36 18 31.97 18 27V18H9Z" fill="#A259FF"/>
            <path d="M18 18H27C31.97 18 36 22.03 36 27C36 31.97 31.97 36 27 36C22.03 36 18 31.97 18 27V18Z" fill="#1ABC9C"/>
            <path d="M9 36C4.03 36 0 40.03 0 45C0 49.97 4.03 54 9 54C13.97 54 18 49.97 18 45V36H9Z" fill="#0ACF83"/>
          </svg>
        </div>
      );
    case "illustrator":
      return (
        <div className="w-6 h-6 rounded bg-[#261300] border border-[#ff9a00] text-[#ff9a00] font-bold text-[10px] flex items-center justify-center font-sans select-none shrink-0 leading-none">
          Ai
        </div>
      );
    case "photoshop":
      return (
        <div className="w-6 h-6 rounded bg-[#001c33] border border-[#00c8ff] text-[#00c8ff] font-bold text-[10px] flex items-center justify-center font-sans select-none shrink-0 leading-none">
          Ps
        </div>
      );
    case "ai":
      return (
        <div className="w-6 h-6 rounded bg-[#10a37f] text-white flex items-center justify-center select-none shrink-0">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M21.3 10.6a5.7 5.7 0 0 0-2.8-4.7 5.7 5.7 0 0 0-5.7-1.1 5.7 5.7 0 0 0-7.8 4 5.7 5.7 0 0 0 .5 5.8 5.7 5.7 0 0 0 2.8 4.7 5.7 5.7 0 0 0 5.7 1.1 5.7 5.7 0 0 0 7.8-4 5.7 5.7 0 0 0-.5-5.8zm-11 7.5a3.4 3.4 0 0 1-1.7-.5l3.2-1.9a1.1 1.1 0 0 0 .6-.9V10.2l2.6 1.5c0 .1.1.2.1.3v3.7a3.4 3.4 0 0 1-4.8 2.4zm-4.8-4.8a3.4 3.4 0 0 1 0-1.8l3.2 1.8a1.1 1.1 0 0 0 1.1 0l3.9-2.3v3a.7.7 0 0 0 .4.7l3.2 1.8a3.4 3.4 0 0 1-11.8-3.2zm-.9-6.3a3.4 3.4 0 0 1 1.7-.6v3.7a1.1 1.1 0 0 0 .6 1l3.9 2.2-2.6 1.5a.7.7 0 0 0-.4-.1H6a3.4 3.4 0 0 1-1.4-7.7zm8.3-.9a3.4 3.4 0 0 1 1.7.5l-3.2 1.9a1.1 1.1 0 0 0-.6.9V13.8l-2.6-1.5c0-.1-.1-.2-.1-.3v-3.7a3.4 3.4 0 0 1 4.8-2.4zM21 11.2l-3.2-1.8a1.1 1.1 0 0 0-1.1 0l-3.9 2.3v-3a.7.7 0 0 0-.4-.7L9.2 6.2a3.4 3.4 0 0 1 11.8 3.2v1.8zm-3.2.6a1.1 1.1 0 0 0-.6-1l-3.9-2.2 2.6-1.5c.2 0 .3.1.4.1h3.7a3.4 3.4 0 0 1 1.4 7.7l-3.6-3.1zM12 13.5l-1.5-.9-1.5.9V11.7l1.5-.9 1.5.9v1.8z"/>
          </svg>
        </div>
      );
    case "indesign":
      return (
        <div className="w-6 h-6 rounded bg-[#230018] border border-[#ff33a3] text-[#ff33a3] font-bold text-[10px] flex items-center justify-center font-sans select-none shrink-0 leading-none">
          Id
        </div>
      );
    case "office":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#eb3c00" className="w-5 h-5 shrink-0">
          <path d="M1 5.5L10 1.5v21l-9-4zM23 7.5L11.5 5.5v13l11.5 2z"/>
        </svg>
      );
    case "aftereffect":
      return (
        <div className="w-6 h-6 rounded bg-[#100026] border border-[#d1a3ff] text-[#d1a3ff] font-bold text-[10px] flex items-center justify-center font-sans select-none shrink-0 leading-none">
          Ae
        </div>
      );
    case "html":
      return (
        <svg viewBox="0 0 512 512" width="20" height="20" fill="#e34f26" className="w-5 h-5 shrink-0">
          <path d="M64 32l35 403 157 45 157-45 35-403h-384zm282.5 132.5h-152.2l4.8 54.3h147.4l-11.8 132.2-74.7 20.2-74.7-20.2-4.8-54.3h51.7l2.4 27.2 25.4 6.9 25.4-6.9 4.8-54.3h-161.7l-14.5-162.7h249.7l-9.7 107.5z"/>
        </svg>
      );
    case "css":
      return (
        <svg viewBox="0 0 512 512" width="20" height="20" fill="#1572b6" className="w-5 h-5 shrink-0">
          <path d="M64 32l35 403 157 45 157-45 35-403h-384zm282.5 132.5h-176.4l5.3 54.3h165.8l-11.8 132.2-79.3 22-79.3-22-5.3-54.3h51.7l2.9 31.8 30 8.2 30-8.2 5.3-54.3h-172.9l-16.1-162.7h234.9l-9.2 82.9z"/>
        </svg>
      );
    case "tailwind":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#38bdf8" className="w-5 h-5 shrink-0">
          <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 6.182 14.976 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.337 13.382 14.976 12 12.001 12z"/>
        </svg>
      );
    default:
      return null;
  }
}

const hobbies = [
  "Making / Listening to Music",
  "Computer Games",
  "Camping",
];

const contact = [
  { label: "Email", value: "info@burakkoc.net", href: "mailto:info@burakkoc.net" },
  { label: "Website", value: "www.burakkoc.net", href: "https://www.burakkoc.net" },
  { label: "Instagram", value: "/uaburak", href: "https://instagram.com/uaburak" },
  { label: "Behance", value: "/uaburak", href: "https://behance.net/uaburak" },
  { label: "LinkedIn", value: "/uaburak", href: "https://linkedin.com/in/uaburak" },
  { label: "Dribbble", value: "/burakkoc", href: "https://dribbble.com/burakkoc" },
];

// ── Icons ─────────────────────────────────────────────────────────────────────


function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M7 2h3v3M10 2L5.5 6.5M5 3H3C2.45 3 2 3.45 2 4v5c0 .55.45 1 1 1h5c.55 0 1-.45 1-1V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <TextScrollingEffect>
      <h2 className="w-full text-base font-medium leading-5 text-[var(--text-title)] mb-6 mt-2">
        {children}
      </h2>
    </TextScrollingEffect>
  );
}

// ── Timeline row ──────────────────────────────────────────────────────────────

function TimelineRow({
  year,
  title,
  subtitle,
  description,
}: {
  year: string;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <ScrollReveal>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-8 py-5 border-b border-[var(--border)]">
        <span className="text-sm font-light text-[var(--text-subtitle)] shrink-0 sm:w-[130px] sm:pt-px">
          {year}
        </span>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-base font-medium text-[var(--text-title)] leading-5">{title}</span>
          <span className="text-sm font-light text-[var(--text-subtitle)]">{subtitle}</span>
          <p className="text-sm font-light leading-6 text-[var(--text-p)] mt-1">{description}</p>
        </div>
      </div>
    </ScrollReveal>
  );
}

// ── Skill tag ─────────────────────────────────────────────────────────────────

function SkillTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm font-light text-[var(--text-p)] transition-colors duration-200 hover:border-[var(--border-hover)]">
      {children}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CVClient() {
  const leftSkills = skillsList.slice(0, 5);
  const rightSkills = skillsList.slice(5, 10);

  const [featuredProject, setFeaturedProject] = useState<ProjectData | null>(null);
  const footerCardRef = useRef<HTMLDivElement>(null);
  const footerImageRef = useRef<HTMLImageElement>(null);
  const [footerActiveImage, setFooterActiveImage] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then((projs) => {
        if (projs.length > 0) {
          setFeaturedProject(projs[0]);
        }
      })
      .catch((err) => console.error("Failed to fetch projects for CV footer:", err));
  }, []);

  const handleMouseEnterHome = () => {
    if (footerCardRef.current) {
      gsap.to(footerCardRef.current, {
        left: "0%",
        opacity: 0,
        scale: 0.95,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  };

  const handleMouseMoveHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!footerCardRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;

    gsap.to(footerCardRef.current, {
      left: "0%",
      x: relX * 20,
      rotation: relX * 6,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseEnterProjects = () => {
    let img = featuredProject?.coverImage || null;
    if (!img && featuredProject) {
      for (const item of featuredProject.items) {
        if (item.kind === "section") {
          const imgBlock = item.blocks.find((b) => b.type === "image" && b.src);
          if (imgBlock?.src) {
            img = imgBlock.src;
            break;
          }
        }
      }
    }
    if (img) setFooterActiveImage(img);

    if (footerCardRef.current) {
      gsap.to(footerCardRef.current, {
        left: "50%",
        opacity: img ? 1 : 0,
        scale: 1,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
    }
  };

  const handleMouseMoveProjects = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!footerCardRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;

    gsap.to(footerCardRef.current, {
      left: "50%",
      x: relX * 20,
      rotation: relX * 6,
      opacity: footerActiveImage ? 1 : 0,
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeaveFooter = () => {
    if (!footerCardRef.current) return;
    gsap.to(footerCardRef.current, {
      opacity: 0,
      scale: 0.95,
      x: 0,
      rotation: 0,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  useEffect(() => {
    if (footerActiveImage && footerImageRef.current) {
      gsap.fromTo(
        footerImageRef.current,
        { scale: 1.15 },
        { scale: 1, duration: 0.45, ease: "power2.out" }
      );
    }
  }, [footerActiveImage]);

  return (
    <PageEntrance className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative overflow-x-hidden">

      {/* ── Left sidebar (xl+) ── */}
      <div
        className="fixed top-[160px] w-[200px] flex-col items-start gap-3 z-20 hidden xl:flex"
        style={{ left: "calc(50% - 468px - var(--scrollbar-width, 0px) / 2)" }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <ArrowLeftIcon />
          </span>
          <span className="px-1">Home</span>
        </Link>
      </div>

      {/* ── Top bar (xl altı) — içerik sütunuyla aynı hizada ── */}
      <TopBar backHref="/" backLabel="Home" showThemeToggle={false} className="xl:hidden" />

      {/* ── Main content ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">

        {/* ─── Header ─── */}
        <section className="flex flex-col items-start w-full pt-[10px] pb-10 border-b border-[var(--border)]">
          <div className="flex flex-wrap items-center justify-between w-full gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-[72px] h-[72px] rounded-[20px] bg-[var(--bg-4)] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer">
                <ZoomableImage
                  src="/burak.png"
                  alt="Burak KOÇ"
                  className="w-full h-full object-cover"
                />
              </div>
              <TextScrollingEffect className="flex flex-col justify-center gap-0.5 min-w-0">
                <h1 className="w-full text-base font-medium leading-5 text-[var(--text-title)]">Burak KOÇ</h1>
                <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
                  UX/UI Designer
                </p>
              </TextScrollingEffect>
            </div>

            <a
              href="/CV-EN.pdf"
              download
              id="cv-download"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm font-medium text-[var(--text-title)] transition-all duration-200 hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] active:scale-95 shrink-0"
            >
              <DownloadIcon />
              Download CV
            </a>
          </div>
        </section>

        {/* ─── About ─── */}
        <section className="flex flex-col items-start w-full pt-10 pb-10 border-b border-[var(--border)]">
          <SectionLabel>About</SectionLabel>
          <TextScrollingEffect>
            <p className="text-base font-light leading-7 text-[var(--text-p)]">
              Hello, I was born in Tokat in 1996. Listening to music and playing instruments are
              great passions of mine. I enjoy exploring different genres and developing my skills
              with various instruments.
            </p>
            <p className="text-base font-light leading-7 text-[var(--text-p)] mt-4">
              I generally adopt a solution-oriented approach to life, which guides me in both my
              personal and professional life. Working in an office has always been my priority.
              When it comes to technology, I prefer using MacOS.
            </p>
          </TextScrollingEffect>
        </section>

        {/* ─── Experience ─── */}
        <section className="flex flex-col items-start w-full pt-10 pb-4">
          <SectionLabel>Experience</SectionLabel>
          <div className="flex flex-col w-full">
            {experience.map((item, i) => (
              <TimelineRow
                key={i}
                year={item.year}
                title={item.role}
                subtitle={item.company}
                description={item.description}
              />
            ))}
          </div>
        </section>

        {/* ─── Education ─── */}
        <section className="flex flex-col items-start w-full pt-10 pb-4">
          <SectionLabel>Education</SectionLabel>
          <div className="flex flex-col w-full">
            {education.map((item, i) => (
              <TimelineRow
                key={i}
                year={item.year}
                title={item.degree}
                subtitle={item.institution}
                description={item.description}
              />
            ))}
          </div>
        </section>

        {/* ─── Skills ─── */}
        <section className="flex flex-col items-start w-full pt-10 pb-10 border-b border-[var(--border)]">
          <SectionLabel>Skills</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-4 w-full">
            <div className="flex flex-col gap-4">
              {leftSkills.map((skill) => (
                <ScrollReveal key={skill.name}>
                  <div className="flex items-center justify-between py-1 w-full">
                    <div className="flex items-center gap-3.5">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        <SkillIcon type={skill.iconType} />
                      </div>
                      <span className="text-sm font-light text-[var(--text-p)]">{skill.name}</span>
                    </div>
                    <div className="w-[80px] sm:w-[120px] h-[5px] bg-[var(--progress-track)] rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-[var(--progress-fill)] rounded-full"
                        style={{
                          width: `${skill.level}%`,
                        }}
                      />
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {rightSkills.map((skill) => (
                <ScrollReveal key={skill.name}>
                  <div className="flex items-center justify-between py-1 w-full">
                    <div className="flex items-center gap-3.5">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        <SkillIcon type={skill.iconType} />
                      </div>
                      <span className="text-sm font-light text-[var(--text-p)]">{skill.name}</span>
                    </div>
                    <div className="w-[80px] sm:w-[120px] h-[5px] bg-[var(--progress-track)] rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-[var(--progress-fill)] rounded-full"
                        style={{
                          width: `${skill.level}%`,
                        }}
                      />
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Hobbies ─── */}
        <section className="flex flex-col items-start w-full pt-10 pb-10 border-b border-[var(--border)]">
          <SectionLabel>Hobbies</SectionLabel>
          <ScrollReveal>
            <div className="flex flex-wrap gap-2">
              {hobbies.map((hobby) => (
                <span
                  key={hobby}
                  className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm font-light text-[var(--text-p)] transition-colors duration-200 hover:border-[var(--border-hover)]"
                >
                  {hobby}
                </span>
              ))}
            </div>
          </ScrollReveal>
        </section>

        {/* ─── Contact ─── */}
        <section className="flex flex-col items-start w-full pt-10">
          <SectionLabel>Contact</SectionLabel>
          <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contact.map((item) => (
              <ScrollReveal key={item.label} className="h-full">
                <a
                  href={item.href}
                  target={item.href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="group flex h-full items-center justify-between gap-3 min-w-0 px-4 py-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] transition-all duration-200 hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] active:scale-[0.98]"
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-subtitle)]">
                      {item.label}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-title)] truncate">
                      {item.value}
                    </span>
                  </span>
                  <span className="shrink-0 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-title)]">
                    <ExternalLinkIcon />
                  </span>
                </a>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ─── Footer Navigation ─── */}
        <div
          className="flex flex-col gap-12 items-start pt-16 w-full"
          onMouseLeave={handleMouseLeaveFooter}
        >
          <div className="w-full h-px bg-[var(--border)]" />
          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-0 w-full">
            {/* Single Shared Footer Preview Card */}
            <div
              ref={footerCardRef}
              className="absolute pointer-events-none hidden md:block w-1/2 aspect-[16/9] origin-bottom rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-2)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] opacity-0 scale-95 will-change-transform z-30"
              style={{ bottom: "calc(100% + 12px)", left: "0%" }}
            >
              {footerActiveImage && (
                <img
                  ref={footerImageRef}
                  src={footerActiveImage}
                  alt="Project Preview"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <Link
              href="/"
              onMouseEnter={handleMouseEnterHome}
              onMouseMove={handleMouseMoveHome}
              className="relative group flex flex-col gap-0.5 justify-center flex-1 min-w-0 cursor-pointer p-3.5 sm:p-4 rounded-2xl transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-[0.98]"
            >
              <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-p)]">
                Back to
              </span>
              <span className="text-sm font-medium leading-5 text-[var(--text-title)] truncate">
                Home
              </span>
            </Link>

            <Link
              href="/projects"
              onMouseEnter={handleMouseEnterProjects}
              onMouseMove={handleMouseMoveProjects}
              className="relative group flex flex-col gap-0.5 items-start sm:items-end justify-center flex-1 min-w-0 cursor-pointer p-3.5 sm:p-4 rounded-2xl transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-[0.98]"
            >
              <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-p)]">
                Explore
              </span>
              <span className="text-sm font-medium leading-5 text-[var(--text-title)] truncate">
                Projects
              </span>
            </Link>
          </div>
        </div>

      </main>
    </PageEntrance>
  );
}
