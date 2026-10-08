import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const metadata: Metadata = {
  title: "Giriş",
};

/** Where every admin page sends a visitor who isn't signed in (see AdminGate). */
export default function AdminLoginPage() {
  return <AdminLogin />;
}
