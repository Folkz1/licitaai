import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SalesDashboard from "@/components/dashboard/SalesDashboard";

export default async function AdminVendasPage() {
  const session = await auth();

  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return <SalesDashboard />;
}
