"use client";

import type { ReactNode } from "react";
import type { DesignComponent, DesignVariable, TextStyle } from "@/types/design";
import { DesignComponentsContext, withStartingComponents } from "./components";
import { DesignVariablesContext, useDesignVariables, variablesCss, withStartingVariables } from "./designVariables";
import { TextStylesContext, textStylesCss, useTextStyles, withStartingTextStyles } from "./textStyles";
import { MOTION_CSS } from "./interactions";

/**
 * The site's design system — its variables, text styles and components — for
 * everything rendered inside: the project page, the editor's canvas.
 */
export interface SiteDesign {
  variables: DesignVariable[];
  textStyles: TextStyle[];
  components: DesignComponent[];
}

/** The design system from what is stored: the starting variables, text styles and components added. */
export function fromStored(stored: SiteDesign): SiteDesign {
  return {
    variables: withStartingVariables(stored.variables),
    textStyles: withStartingTextStyles(stored.textStyles),
    components: withStartingComponents(stored.components),
  };
}

/** Takes all of them — the starting ones included (see fromStored). */
export function DesignSystemProvider({ variables, textStyles, components, children }: SiteDesign & { children: ReactNode }) {
  return (
    <DesignVariablesContext.Provider value={variables}>
      <TextStylesContext.Provider value={textStyles}>
        <DesignComponentsContext.Provider value={components}>{children}</DesignComponentsContext.Provider>
      </TextStylesContext.Provider>
    </DesignVariablesContext.Provider>
  );
}

/** Puts the variables, the text styles and the prototypes' animations on the page: render it inside the element carrying `data-design-scope`. */
export function DesignSystemStyle() {
  const variables = useDesignVariables();
  const textStyles = useTextStyles();
  return <style>{`${variablesCss(variables)}\n${textStylesCss(textStyles, variables)}\n${MOTION_CSS}`}</style>;
}
