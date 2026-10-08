import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";

/** The admin is nobody else's to find: no index, no following its links. */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin pages use the system cursor: the site's custom cursor gets in the way
 * of text fields, drag handles and resize targets. `data-native-cursor` turns
 * off the global `cursor: none` rule (see globals.css); `display: contents`
 * keeps the wrapper out of the layout. Every page behind the sign-in (AdminGate).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-native-cursor className="contents">
      <AdminGate>{children}</AdminGate>
    </div>
  );
}
