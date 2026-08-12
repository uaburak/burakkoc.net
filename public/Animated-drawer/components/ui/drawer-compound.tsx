"use client"

import { createContext, useContext, useState, type ReactNode, Children, isValidElement } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Context için tipler
type DrawerContextType = {
  currentViewId: string
  changeView: (viewId: string) => void
  closeDrawer: () => void
  isAnimating: boolean
}

// Context oluşturma
const DrawerContext = createContext<DrawerContextType>({
  currentViewId: "",
  changeView: () => {},
  closeDrawer: () => {},
  isAnimating: false,
})

// Context hook'u
export const useDrawerContext = () => useContext(DrawerContext)

// View komponenti için tipler
type ViewProps = {
  id: string
  height: number
  children: ReactNode
}

// Ana Drawer komponenti için tipler
type DrawerCompoundProps = {
  children: ReactNode
  trigger: ReactNode
  initialViewId: string
  onClose?: () => void
}

// Compound component yapısı
const DrawerCompound = {
  Root: ({ children, trigger, initialViewId, onClose }: DrawerCompoundProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [currentViewId, setCurrentViewId] = useState(initialViewId)
    const [isAnimating, setIsAnimating] = useState(false)

    // View'ları ve yüksekliklerini toplama
    const viewsMap = new Map<string, number>()

    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === DrawerCompound.View) {
        viewsMap.set(child.props.id, child.props.height)
      }
    })

    // Drawer'ı aç/kapat
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

    // View değiştir
    const changeView = (viewId: string) => {
      if (isAnimating) return
      if (!viewsMap.has(viewId)) return

      setIsAnimating(true)
      setCurrentViewId(viewId)
      setTimeout(() => {
        setIsAnimating(false)
      }, 300)
    }

    // Context değeri
    const contextValue = {
      currentViewId,
      changeView,
      closeDrawer: toggleDrawer,
      isAnimating,
    }

    // Mevcut view'un yüksekliğini al
    const currentHeight = viewsMap.get(currentViewId) || 0

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
                      height: currentHeight,
                    }}
                    transition={{
                      duration: 0.15,
                      ease: [0.24, 1.06, 0.64, 1],
                    }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden relative"
                    style={{ height: currentHeight }}
                  >
                    <div className="absolute inset-0">
                      {/* Views */}
                      <DrawerContext.Provider value={contextValue}>
                        <AnimatePresence initial={false}>
                          {Children.map(children, (child) => {
                            if (
                              isValidElement(child) &&
                              child.type === DrawerCompound.View &&
                              child.props.id === currentViewId
                            ) {
                              return (
                                <motion.div
                                  key={child.props.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute inset-0"
                                >
                                  {child}
                                </motion.div>
                              )
                            }
                            return null
                          })}
                        </AnimatePresence>
                      </DrawerContext.Provider>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    )
  },

  View: ({ id, height, children }: ViewProps) => {
    return <div className="h-full overflow-auto">{children}</div>
  },
}

export { DrawerCompound }

