import type { Session } from "next-auth";

export function isSuperAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === "SUPER_ADMIN";
}
