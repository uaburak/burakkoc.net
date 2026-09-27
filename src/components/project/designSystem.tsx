"use client";

import type { ReactNode } from "react";
import type { ComponentDesigns } from "@/types/project";
import type { DesignAtom, DesignMolecule, DesignVariable } from "@/types/design";
import { ComponentDesignContext } from "./componentDesign";
import { DesignVariablesContext, useDesignVariables, variablesCss, withStartingVariables } from "./designVariables";
import { DesignAtomsContext, atomsCss, useDesignAtoms, withStartingAtoms } from "./designAtoms";
import { DesignMoleculesContext, migrateLegacyDesigns, withStartingMolecules } from "./designMolecules";

/**
 * The site's design system — its variables, atoms, molecules and main
 * components (organisms) — for everything rendered inside: the project page,
 * the editor's canvas.
 */
export interface SiteDesign {
  variables: DesignVariable[];
  atoms: DesignAtom[];
  molecules: DesignMolecule[];
  designs: ComponentDesigns;
}

/** The design system from what is stored: the starting variables, atoms and molecules added, older designs moved to their molecules. */
export function fromStored(stored: SiteDesign): SiteDesign {
  const { designs, molecules } = migrateLegacyDesigns(stored.designs, stored.molecules);
  return {
    variables: withStartingVariables(stored.variables),
    atoms: withStartingAtoms(stored.atoms),
    molecules: withStartingMolecules(molecules),
    designs,
  };
}

/** Takes all of them — the starting ones included (see fromStored). */
export function DesignSystemProvider({ variables, atoms, molecules, designs, children }: SiteDesign & { children: ReactNode }) {
  return (
    <DesignVariablesContext.Provider value={variables}>
      <DesignAtomsContext.Provider value={atoms}>
        <DesignMoleculesContext.Provider value={molecules}>
          <ComponentDesignContext.Provider value={designs}>{children}</ComponentDesignContext.Provider>
        </DesignMoleculesContext.Provider>
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
