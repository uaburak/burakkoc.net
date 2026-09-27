"use client";

import type { ReactNode } from "react";
import type { ComponentDesigns } from "@/types/project";
import type { DesignAtom, DesignVariable } from "@/types/design";
import { ComponentDesignContext } from "./componentDesign";
import { DesignVariablesContext, useDesignVariables, variablesCss } from "./designVariables";
import { DesignAtomsContext, atomsCss, useDesignAtoms } from "./designAtoms";

/**
 * The site's design system — its variables, atoms and main components — for
 * everything rendered inside: the project page, the editor's canvas.
 */
export function DesignSystemProvider({ variables, atoms, designs, children }: {
  /** All of them, the starting ones included (withStartingVariables) */
  variables: DesignVariable[];
  /** All of them, the starting ones included (withStartingAtoms) */
  atoms: DesignAtom[];
  designs: ComponentDesigns;
  children: ReactNode;
}) {
  return (
    <DesignVariablesContext.Provider value={variables}>
      <DesignAtomsContext.Provider value={atoms}>
        <ComponentDesignContext.Provider value={designs}>{children}</ComponentDesignContext.Provider>
      </DesignAtomsContext.Provider>
    </DesignVariablesContext.Provider>
  );
}

/** Puts the variables and the atoms on the page: render it inside the element carrying `data-design-scope`. */
export function DesignSystemStyle() {
  const variables = useDesignVariables();
  const atoms = useDesignAtoms();
  return <style>{`${variablesCss(variables)}\n${atomsCss(atoms, variables)}`}</style>;
}
