"use client";

import { useState, type ReactNode, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type DrawerView = {
  id: string;
  component: ReactNode;
  height: number;
};

type DrawerContextType = {
  changeView: (viewId: string) => void;
  closeDrawer: () => void;
  isAnimating: boolean;
  isOpen: boolean;
};

const DrawerContext = createContext<DrawerContextType>({
  changeView: () => {},
  closeDrawer: () => {},
  isAnimating: false,
  isOpen: false,
});

export const useDrawer = () => useContext(DrawerContext);

type AnimatedDrawerProps = {
  views: DrawerView[];
  initialViewId: string;
  trigger: ReactNode;
  onClose?: () => void;
};

export function AnimatedDrawer({
  views,
  initialViewId,
  trigger,
  onClose,
}: AnimatedDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentViewId, setCurrentViewId] = useState(initialViewId);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentView =
    views.find((view) => view.id === currentViewId) || views[0];

  const toggleDrawer = () => {
    if (isOpen) {
      setIsOpen(false);
      setTimeout(() => {
        setCurrentViewId(initialViewId);
        if (onClose) onClose();
      }, 300);
    } else {
      setIsOpen(true);
    }
  };

  const changeView = (viewId: string) => {
    if (isAnimating) return;
    const view = views.find((v) => v.id === viewId);
    if (!view) return;

    setIsAnimating(true);
    setCurrentViewId(viewId);
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  };

  const drawerContext = {
    changeView,
    closeDrawer: toggleDrawer,
    isAnimating,
    isOpen,
  };

  return (
    <DrawerContext.Provider value={drawerContext}>
      {/* Trigger element */}
      <div onClick={toggleDrawer} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
              onClick={toggleDrawer}
            />

            {/* Bottom Drawer Container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 24,
                stiffness: 340,
                mass: 0.6,
              }}
              className="fixed bottom-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
            >
              <div className="w-full max-w-xs mx-5 mb-6 pointer-events-auto">
                {/* Dynamic Height Morphing Card */}
                <motion.div
                  animate={{
                    height: currentView.height,
                  }}
                  transition={{
                    duration: 0.28,
                    ease: [0.24, 1.06, 0.64, 1],
                  }}
                  className="bg-[var(--bg-1)] border border-[var(--border)] rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.3)] overflow-hidden relative"
                  style={{ height: currentView.height }}
                >
                  <div className="absolute inset-0">
                    <AnimatePresence initial={false} mode="wait">
                      {views.map(
                        (view) =>
                          currentViewId === view.id && (
                            <motion.div
                              key={view.id}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ duration: 0.18, ease: "easeOut" }}
                              className="absolute inset-0 flex flex-col justify-between"
                            >
                              {view.component}
                            </motion.div>
                          )
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DrawerContext.Provider>
  );
}
