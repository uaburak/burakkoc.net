import { WalletDrawer } from "@/components/wallet-drawer"
import { SettingsDrawer } from "@/components/settings-drawer"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black">
      <WalletDrawer />
      <SettingsDrawer />
    </main>
  )
}

