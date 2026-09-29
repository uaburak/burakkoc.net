"use client";

import { createContext } from "react";

/**
 * Set by a grid cell whose height is Fill / Fixed (see sizeProps): images and
 * videos stretch to that height (from md up) instead of keeping their aspect ratio.
 */
export const FillHeightContext = createContext(false);
