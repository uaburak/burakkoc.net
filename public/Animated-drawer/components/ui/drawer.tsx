"use client"

import { useState, type ReactNode, createContext, useContext } from "react"
import { motion, AnimatePresence } from "framer-motion"

export type DrawerView = {
  id: string
  component: ReactNode
  height: number
}

type DrawerContextType = {
  changeView: (viewId: string) => void
  closeDrawer: () => void
  isAnimating: boolean
}

const DrawerContext = createContext<DrawerContextType>({
  changeView: () => {},
  closeDrawer: () => {},
  isAnimating: false,
})

export const useDrawer = () => useContext(DrawerContext)

type DrawerProps = {
  views: DrawerView[]
  initialViewId: string
  trigger: ReactNode
  onClose?: () => void
}

export function Drawer({ views, initialViewId, trigger, onClose }: DrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentViewId, setCurrentViewId] = useState(initialViewId)
  const [isAnimating, setIsAnimating] = useState(false)

  // Find current view
  const currentView = views.find((view) => view.id === currentViewId) || views[0]

  const toggleDrawer = () => {
    if (isOpen) {
      setIsOpen(false)
      setTimeout(() => {
        setCurrentViewId(initialViewId)
        if (onClose) onClose()
      }, 300)
    } else {
      setIsOpen(true)
    }
  }

  const changeView = (viewId: string) => {
    if (isAnimating) return
    const view = views.find((v) => v.id === viewId)
    if (!view) return

    setIsAnimating(true)
    setCurrentViewId(viewId)
    setTimeout(() => {
      setIsAnimating(false)
    }, 300)
  }

  // Context value
  const drawerContext = {
    changeView,
    closeDrawer: toggleDrawer,
    isAnimating,
  }

  return (
    <>
      {/* Trigger Button */}
      <div onClick={toggleDrawer} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black z-40"
              onClick={toggleDrawer}
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 20,
                stiffness: 350,
                mass: 0.6,
              }}
              className="fixed bottom-0 left-0 right-0 flex justify-center z-50"
            >
              <div className="w-full max-w-sm mx-6 mb-6">
                {/* Card */}
                <motion.div
                  animate={{
                    height: currentView.height,
                  }}
                  transition={{
                    duration: 0.29,
                    ease: [0.24, 1.06, 0.64, 1],
                  }}
                  className="bg-white rounded-3xl shadow-lg overflow-hidden relative"
                  style={{ height: currentView.height }}
                >
                  <div className="absolute inset-0 pb-6">
                    {/* Views */}
                    <AnimatePresence initial={false}>
                      {views.map(
                        (view) =>
                          currentViewId === view.id && (
                            <motion.div
                              key={view.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1, transition: { duration: 0.2, ease: [0.34, 1.56, 0.64, 1] } }}
                              transition={{ duration: 0.2 }}
                              className="absolute inset-0"
                              >
                              <DrawerContext.Provider value={drawerContext}>
                                {view.component}
                              </DrawerContext.Provider>
                            </motion.div>
                          ),
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

