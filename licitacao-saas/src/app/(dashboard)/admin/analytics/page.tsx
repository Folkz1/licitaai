import AdminAnalyticsDashboard from "@/components/dashboard/AdminAnalyticsDashboard";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminAnalyticsPage() {
  const session = await auth();

  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return <AdminAnalyticsDashboard />;
}
