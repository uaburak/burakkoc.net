"use client"

import { motion } from "framer-motion"
import { Drawer, useDrawer, type DrawerView } from "@/components/ui/drawer"
import { Settings, User, Bell, Moon, HelpCircle, X } from "lucide-react"

// Settings Menu View
function SettingsMenuView() {
  const { changeView, closeDrawer } = useDrawer()

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold">Settings</h3>
        <motion.button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full" whileTap={{ scale: 0.9 }}>
          <X className="w-5 h-5 text-gray-500" />
        </motion.button>
      </div>
      <div className="p-2">
        <motion.button
          onClick={() => changeView("profile")}
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <User className="w-5 h-5 text-gray-500" />
          <span className="font-medium">Burak</span>
        </motion.button>
        <motion.button
          onClick={() => changeView("notifications")}
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="font-medium">Notifications</span>
        </motion.button>
        <motion.button
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <Moon className="w-5 h-5 text-gray-500" />
          <span className="font-medium">Appearance</span>
        </motion.button>
        <motion.button
          className="flex w-full items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <HelpCircle className="w-5 h-5 text-gray-500" />
          <span className="font-medium">Help & Support</span>
        </motion.button>
      </div>
    </>
  )
}

// Profile Settings View
function ProfileSettingsView() {
  const { changeView, closeDrawer } = useDrawer()

  return (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <User className="w-6 h-6 text-gray-500 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Profile Settings</h3>
            <p className="text-gray-500 text-sm">Update your personal information and preferences</p>
          </div>
          <motion.button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full" whileTap={{ scale: 0.9 }}>
            <X className="w-5 h-5 text-gray-500" />
          </motion.button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Display Name</label>
          <input type="text" className="w-full p-2 border border-gray-200 rounded-lg" placeholder="Your name" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input type="email" className="w-full p-2 border border-gray-200 rounded-lg" placeholder="Your email" />
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 flex gap-3">
        <motion.button
          onClick={() => changeView("settings")}
          className="flex-1 px-6 py-2.5 rounded-full bg-gray-100 font-medium"
          whileTap={{ scale: 0.95 }}
        >
          Cancel
        </motion.button>
        <motion.button
          className="flex-1 px-6 py-2.5 rounded-full bg-blue-500 text-white font-medium"
          whileTap={{ scale: 0.95 }}
        >
          Save
        </motion.button>
      </div>
    </>
  )
}

// Notifications Settings View
function NotificationsSettingsView() {
  const { changeView, closeDrawer } = useDrawer()

  return (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <Bell className="w-6 h-6 text-gray-500 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Notifications</h3>
            <p className="text-gray-500 text-sm">Manage your notification preferences</p>
          </div>
          <motion.button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full" whileTap={{ scale: 0.9 }}>
            <X className="w-5 h-5 text-gray-500" />
          </motion.button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Push Notifications</span>
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input type="checkbox" id="push" className="sr-only" />
            <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
            <div className="absolute w-6 h-6 bg-white rounded-full shadow inset-y-0 left-0"></div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Email Notifications</span>
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input type="checkbox" id="email" className="sr-only" />
            <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
            <div className="absolute w-6 h-6 bg-white rounded-full shadow inset-y-0 left-0"></div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">SMS Notifications</span>
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input type="checkbox" id="sms" className="sr-only" />
            <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
            <div className="absolute w-6 h-6 bg-white rounded-full shadow inset-y-0 left-0"></div>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 flex gap-3">
        <motion.button
          onClick={() => changeView("settings")}
          className="flex-1 px-6 py-2.5 rounded-full bg-gray-100 font-medium"
          whileTap={{ scale: 0.95 }}
        >
          Cancel
        </motion.button>
        <motion.button
          className="flex-1 px-6 py-2.5 rounded-full bg-blue-500 text-white font-medium"
          whileTap={{ scale: 0.95 }}
        >
          Save
        </motion.button>
      </div>
    </>
  )
}

export function SettingsDrawer() {
  // Define drawer views
  const drawerViews: DrawerView[] = [
    {
      id: "settings",
      component: <SettingsMenuView />,
      height: 280,
    },
    {
      id: "profile",
      component: <ProfileSettingsView />,
      height: 380,
    },
    {
      id: "notifications",
      component: <NotificationsSettingsView />,
      height: 300,
    },
  ]

  // Trigger button
  const triggerButton = (
    <motion.button
      className="bg-gray-800 hover:bg-gray-900 text-white font-medium px-6 py-3 rounded-full flex items-center justify-center gap-2 shadow-md"
      whileTap={{ scale: 0.9 }}
    >
      <Settings className="w-5 h-5" />
      Settings
    </motion.button>
  )

  return <Drawer views={drawerViews} initialViewId="settings" trigger={triggerButton} />
}

