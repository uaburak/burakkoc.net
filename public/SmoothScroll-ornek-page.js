"use client";
import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PresentationHero from "@/components/sunum/PresentationHero";
import ContentSections from '@/components/sunum/ContentSections';
import { useAdmin } from '@/context/AdminContext';

gsap.registerPlugin(ScrollTrigger);

const colors = [
    "#ffffff", // Beyaz
    "#F5A915"  // Turuncu (TechnoChef Primary)
];

export default function SunumPage() {
    const { presentationSections, loading } = useAdmin();

    const activeSections = presentationSections || [];

    if (loading && presentationSections.length === 0) {
        return <div className="min-h-screen flex items-center justify-center bg-black text-white">Yükleniyor...</div>;
    }

    return (
        <main className="w-full relative">
            <PresentationHero />

            {activeSections.map((section, index) => {
                const variant = index % 2 === 0 ? 'left' : 'right';
                const scrollText = `${section.baslik} • `.repeat(4);
                const scrollTextEn = section.baslikEn ? `${section.baslikEn} • `.repeat(4) : null;

                // Index 1 (Orange) -> Text White, Index 0 (White) -> Text Black
                const isOrangeBg = index % colors.length === 1;
                const textColor = isOrangeBg ? "text-white" : "text-black";
                const subTextColor = isOrangeBg ? "text-white/90" : "text-gray-500";
                const sectionBgColor = colors[index % colors.length];

                return (
                    <section
                        key={index}
                        className="w-full relative"
                        style={{ backgroundColor: sectionBgColor }} // Sabit arkaplan rengi
                    >
                        <ContentSections
                            variant={variant}
                            data={{
                                backgroundColor: sectionBgColor,
                                textColor: textColor,
                                subTextColor: subTextColor,
                                scrollText: scrollText,
                                scrollTextEn: scrollTextEn,
                                intro: {
                                    title: <>{section.baslik}</>,
                                    paragraphs: section.aciklama.split('\n').filter(p => p.trim()),
                                    image: section.introImage || section.sloganlar[0]?.image || "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80",
                                    imageAlt: section.baslik
                                },
                                values: section.sloganlar.map((slogan, idx) => ({
                                    id: index * 10 + idx + 1,
                                    title: slogan.baslik,
                                    description: slogan.aciklama,
                                    image: slogan.image
                                })),
                                packages: section.paketler
                            }}
                        />
                    </section>
                );
            })}
        </main>
    );
}
