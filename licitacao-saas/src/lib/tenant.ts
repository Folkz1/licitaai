import { cookies } from "next/headers";
import { auth } from "./auth";

/**
 * Gets the effective tenant ID for the current request.
 * For SUPER_ADMIN users, checks the x-tenant-override cookie.
 * For all other users, returns their own tenant ID.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getEffectiveTenantId(): Promise<{
  tenantId: string;
  isOverride: boolean;
  session: any;
}> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const userTenantId = session.user.tenantId;
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  if (isSuperAdmin) {
    const cookieStore = await cookies();
    const override = cookieStore.get("x-tenant-override")?.value;
    if (override && override !== userTenantId) {
      return { tenantId: override, isOverride: true, session };
    }
  }

  return { tenantId: userTenantId, isOverride: false, session };
}
