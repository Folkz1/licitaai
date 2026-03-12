import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!isSuperAdmin(session)) {
    redirect("/dashboard");
  }

  return children;
}
