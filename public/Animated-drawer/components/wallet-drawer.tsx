"use client"

import { motion } from "framer-motion"
import { Drawer, useDrawer, type DrawerView } from "@/components/ui/drawer"
import { X, Lock, FileText, AlertTriangle, Share2, AlertCircle } from "lucide-react"

// Options View Component
function OptionsView() {
  const { changeView, closeDrawer } = useDrawer()

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold">Options</h3>
        <motion.button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full" whileTap={{ scale: 0.9 }}>
          <X className="w-5 h-5 text-gray-500" />
        </motion.button>
      </div>
      <div className="p-2">
        <motion.button
          onClick={() => changeView("privateKey")}
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <Lock className="w-5 h-5 text-gray-500" />
          <span className="font-medium">View Private Key</span>
        </motion.button>
        <motion.button
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <FileText className="w-5 h-5 text-gray-500" />
          <span className="font-medium">View Recovery Phase</span>
        </motion.button>
        <motion.button
          onClick={() => changeView("confirmRemove")}
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Remove Wallet</span>
        </motion.button>
      </div>
    </>
  )
}

// Private Key View Component
function PrivateKeyView() {
  const { changeView, closeDrawer } = useDrawer()

  return (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 text-gray-500 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Private Key</h3>
            <p className="text-gray-500 text-sm">
              Your Private Key is the key used to back up your wallet. Keep it secret and secure at all times.
            </p>
          </div>
          <motion.button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full" whileTap={{ scale: 0.9 }}>
            <X className="w-5 h-5 text-gray-500" />
          </motion.button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-gray-500" />
          <span className="text-gray-600">Keep your private key safe</span>
        </div>
        <div className="flex items-center gap-3">
          <Share2 className="w-5 h-5 text-gray-500" />
          <span className="text-gray-600">Don't share it with anyone else</span>
        </div>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-gray-500" />
          <span className="text-gray-600">If you lose it, we can't recover it</span>
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 flex gap-3">
        <motion.button
          onClick={() => changeView("options")}
          className="flex-1 px-6 py-2.5 rounded-full bg-gray-100 font-medium"
          whileTap={{ scale: 0.95 }}
        >
          Cancel
        </motion.button>
        <motion.button
          className="flex-1 px-6 py-2.5 rounded-full bg-blue-500 text-white font-medium"
          whileTap={{ scale: 0.95 }}
        >
          Reveal
        </motion.button>
      </div>
    </>
  )
}

// Confirm Remove View Component
function ConfirmRemoveView() {
  const { changeView, closeDrawer } = useDrawer()

  return (
    <>
      <div className="p-4">
        <div className="flex justify-end">
          <motion.button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full" whileTap={{ scale: 0.9 }}>
            <X className="w-5 h-5 text-gray-500" />
          </motion.button>
        </div>
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-center mb-2">Are you sure?</h3>
        <p className="text-gray-500 text-center mb-6">
          You haven't backed up your wallet yet. If you remove it, you could lose access forever.
        </p>
        <div className="flex gap-3">
          <motion.button
            onClick={() => changeView("options")}
            className="flex-1 px-6 py-2.5 rounded-full bg-gray-100 font-medium"
            whileTap={{ scale: 0.95 }}
          >
            Cancel
          </motion.button>
          <motion.button
            className="flex-1 px-6 py-2.5 rounded-full bg-red-500 text-white font-medium"
            whileTap={{ scale: 0.95 }}
          >
            Continue
          </motion.button>
        </div>
      </div>
    </>
  )
}

export function WalletDrawer() {
  // Define drawer views
  const drawerViews: DrawerView[] = [
    {
      id: "options",
      component: <OptionsView />,
      height: 230,
    },
    {
      id: "privateKey",
      component: <PrivateKeyView />,
      height: 340,
    },
    {
      id: "confirmRemove",
      component: <ConfirmRemoveView />,
      height: 280,
    },
  ]

  // Trigger button
  const triggerButton = (
    <motion.button
      className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-full flex items-center justify-center gap-2 shadow-md"
      whileTap={{ scale: 0.9 }}
    >
      Wallet Options
    </motion.button>
  )

  return <Drawer views={drawerViews} initialViewId="options" trigger={triggerButton} />
}

