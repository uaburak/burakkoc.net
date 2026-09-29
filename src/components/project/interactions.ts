"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { DesignComponent, Interaction, InteractionAnimation, InteractionEasing, InteractionTrigger } from "@/types/design";

/**
 * Playing a component's prototype (see Interaction): each instance — or each
 * item of one, by its key — shows the variant it turned into; a click, the
 * pointer, a press or a delay turn it into another, animated.
 *
 * The animation is CSS: while it plays, the instance's frame carries
 * `data-variant-motion` (and its duration and easing as custom properties) —
 * Smart animate transitions every property of it and its layers (the same
 * elements: variants' layers share their ids), dissolve fades the new one in
 * (see MOTION_CSS).
 */

/** Figma's easings as CSS curves — the springs as curves that overshoot. */
export const EASINGS: Record<InteractionEasing, { label: string; css: string }> = {
  linear: { label: "Doğrusal", css: "linear" },
  "ease-in": { label: "Yavaş başla", css: "cubic-bezier(0.42, 0, 1, 1)" },
  "ease-out": { label: "Yavaş bitir", css: "cubic-bezier(0, 0, 0.58, 1)" },
  "ease-in-out": { label: "Yavaş başla ve bitir", css: "cubic-bezier(0.42, 0, 0.58, 1)" },
  "ease-in-back": { label: "Geri çekilerek başla", css: "cubic-bezier(0.3, -0.05, 0.7, -0.5)" },
  "ease-out-back": { label: "Taşarak bitir", css: "cubic-bezier(0.45, 1.45, 0.8, 1)" },
  gentle: { label: "Yumuşak yay", css: "cubic-bezier(0.35, 1.25, 0.55, 1)" },
  bouncy: { label: "Zıplayan yay", css: "cubic-bezier(0.3, 1.8, 0.6, 0.9)" },
};

export const TRIGGERS: Record<InteractionTrigger, string> = {
  click: "Tıklayınca",
  hover: "Üzerine gelince",
  press: "Basılıyken",
  delay: "Bir süre sonra",
};

export const ANIMATIONS: Record<InteractionAnimation, string> = {
  instant: "Anında",
  dissolve: "Çözünerek",
  smart: "Akıllı animasyon",
};

/** The animations' CSS — put on the page with the design system (see DesignSystemStyle). */
export const MOTION_CSS = `
[data-variant-motion="smart"], [data-variant-motion="smart"] * { transition-property: all; transition-duration: var(--motion-duration); transition-timing-function: var(--motion-easing); }
[data-variant-motion="dissolve"] { animation: variant-dissolve var(--motion-duration) var(--motion-easing) both; }
@keyframes variant-dissolve { from { opacity: 0; } to { opacity: 1; } }
`;

type Motion = { animation: InteractionAnimation; easing: InteractionEasing; duration: number; key: number };
/** One instance's play: the variant it shows, the one the pointer leaving (or letting go) takes it back to, its animation. */
type Played = { shown?: string; back?: string; via?: "hover" | "press"; motion?: Motion };

/** What a played instance's frame gets: its handlers, its animation's attribute and properties. */
export interface PlayProps {
  onClick?: (e: React.MouseEvent) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  "data-variant-motion"?: InteractionAnimation;
  style?: CSSProperties;
}

/**
 * The prototypes of the instances drawn here, keyed (an instance, its items):
 * `components` are the variants they can be (their interactions), `enabled`
 * off where nothing plays (the editor's canvas).
 */
export function useVariantPlay(components: readonly DesignComponent[], enabled: boolean) {
  const [played, setPlayed] = useState<Record<string, Played>>({});

  const interactionsOf = useCallback((id?: string) => (enabled && id ? components.find((c) => c.id === id)?.interactions ?? [] : []), [components, enabled]);

  /** The variant `key` shows — `initial` until an interaction changed it. */
  const shownOf = (key: string, initial?: string) => played[key]?.shown ?? initial;

  /** Turns `key` into the interaction's target — going back to `back` later (the pointer leaving, letting go). */
  const change = useCallback((key: string, interaction: Interaction, back?: { id: string; via: "hover" | "press" }) => {
    if (!components.some((c) => c.id === interaction.target)) return;
    const motion = interaction.animation === "instant" ? undefined : { animation: interaction.animation, easing: interaction.easing, duration: interaction.duration, key: Date.now() };
    setPlayed((all) => ({ ...all, [key]: { shown: interaction.target, back: back?.id, via: back?.via, motion } }));
  }, [components]);

  /** Back to the variant it was before the pointer came (or pressed) — as it came, animated the same. */
  const goBack = useCallback((key: string, via?: "hover" | "press") => {
    setPlayed((all) => {
      const entry = all[key];
      if (!entry?.back || (via && entry.via !== via)) return all;
      return { ...all, [key]: { shown: entry.back, motion: entry.motion && { ...entry.motion, key: Date.now() } } };
    });
  }, []);

  // An animation over, its attribute goes (so nothing else animates, and the next one starts afresh).
  useEffect(() => {
    const timers = Object.entries(played).flatMap(([key, entry]) => {
      const motion = entry.motion;
      if (!motion) return [];
      return [
        window.setTimeout(() => setPlayed((all) => (all[key]?.motion?.key === motion.key ? { ...all, [key]: { ...all[key], motion: undefined } } : all)), motion.duration + 60),
      ];
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [played]);

  /** Its "after delay" interaction, when the variant it shows has one. */
  const delayOf = (id?: string) => interactionsOf(id).find((i) => i.trigger === "delay");

  /** The handlers, attribute and properties for `key`'s frame. */
  const propsOf = (key: string, initial?: string): PlayProps => {
    if (!enabled) return {};
    const current = shownOf(key, initial);
    const on = (trigger: InteractionTrigger) => interactionsOf(current).find((i) => i.trigger === trigger);
    const motion = played[key]?.motion;
    const click = on("click");
    return {
      onClick: click
        ? (e) => {
            e.stopPropagation();
            change(key, click);
          }
        : undefined,
      onPointerEnter: () => {
        const hover = on("hover");
        if (hover && current) change(key, hover, { id: current, via: "hover" });
      },
      onPointerLeave: () => goBack(key),
      onPointerDown: () => {
        const press = on("press");
        if (press && current) change(key, press, { id: current, via: "press" });
      },
      onPointerUp: () => goBack(key, "press"),
      "data-variant-motion": motion?.animation,
      style: {
        ...(motion ? ({ "--motion-duration": `${motion.duration}ms`, "--motion-easing": EASINGS[motion.easing].css } as CSSProperties) : {}),
        ...(click ? { cursor: "pointer" } : {}),
      },
    };
  };

  return { shownOf, propsOf, delayOf, change };
}

/** A new interaction of `from`: a click turning it into `target`, Smart animate, easing out, 300ms — Figma's usual start. */
export const newInteraction = (id: string, target: string): Interaction => ({ id, trigger: "click", target, animation: "smart", easing: "ease-out", duration: 300 });
