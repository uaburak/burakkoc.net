"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import ScrollReveal from "@/components/ScrollReveal";

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

const skills = {
  Design: [
    "Figma",
    "UX•UI Design",
    "Illustrator",
    "Photoshop",
    "Indesign",
    "After Effect",
    "AI Models",
  ],
  Development: [
    "HTML",
    "CSS",
    "Tailwind CSS",
  ],
  Tools: [
    "Office",
  ],
};

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

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
      <p className="text-xs font-medium tracking-widest uppercase text-[var(--text-subtitle)] mb-6 mt-2">
        {children}
      </p>
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
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">

      {/* ── Left sidebar (xl+) ── */}
      <div className="fixed top-[160px] left-[calc(50%-468px)] w-[200px] flex-col items-start gap-3 z-20 hidden xl:flex">
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <ArrowLeftIcon />
          </span>
          <span className="px-1">Home</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* ── Mobile top bar ── */}
      <div className="flex xl:hidden items-center justify-between px-5 pt-8 pb-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-full font-medium text-sm text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)]"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Home</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* ── Main content ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 py-10 xl:px-6 xl:py-[160px]">

        {/* ─── Header ─── */}
        <section className="flex flex-col items-start w-full pt-[10px] pb-10 border-b border-[var(--border)]">
          <div className="flex items-start justify-between w-full gap-4">
            <TextScrollingEffect>
              <h1 className="text-base font-medium text-[var(--text-title)] leading-5">Burak Koç</h1>
              <p className="text-base font-normal text-[var(--text-subtitle)] mt-0.5">
                UX/UI Designer
              </p>
              <p className="text-sm font-light text-[var(--text-subtitle)] mt-1">
                Kepez / Antalya, Turkey
              </p>
            </TextScrollingEffect>

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
        <section className="flex flex-col items-start w-full pt-10 pb-4 border-b border-[var(--border)]">
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
        <section className="flex flex-col items-start w-full pt-10 pb-4 border-b border-[var(--border)]">
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
          <div className="flex flex-col gap-6 w-full">
            {(Object.entries(skills) as [string, string[]][]).map(([category, items]) => (
              <ScrollReveal key={category}>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium text-[var(--text-subtitle)]">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((skill) => (
                      <SkillTag key={skill}>{skill}</SkillTag>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            ))}
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
          <div className="flex flex-col w-full gap-0">
            {contact.map((item) => (
              <ScrollReveal key={item.label}>
                <a
                  href={item.href}
                  target={item.href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between py-4 border-b border-[var(--border)] transition-all duration-200 hover:opacity-60"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)]">
                      {item.label}
                    </span>
                    <span className="text-base font-medium text-[var(--text-title)]">
                      {item.value}
                    </span>
                  </div>
                  <ExternalLinkIcon />
                </a>
              </ScrollReveal>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
