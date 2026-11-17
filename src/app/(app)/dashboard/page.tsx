import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import DispatcherDashboard from "@/components/dashboard/DispatcherDashboard";
import TechnicianDashboard from "@/components/dashboard/TechnicianDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import ManagerDashboard from "@/components/dashboard/ManagerDashboard";
import {
  getAdminDashboard,
  getClientDashboard,
  getDispatcherDashboard,
  getManagerDashboard,
  getTechnicianDashboard,
} from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

/**
 * Single entry point that renders the dashboard matching the signed-in
 * account's role. Authentication redirects here, so each user lands directly
 * on the workspace for their job.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;
  const userName = user.name ?? user.email ?? "";

  switch (user.role) {
    case "ADMIN":
      return <AdminDashboard data={await getAdminDashboard()} userName={userName} />;
    case "DISPATCHER":
      return <DispatcherDashboard data={await getDispatcherDashboard()} userName={userName} />;
    case "TECHNICIAN":
      return <TechnicianDashboard data={await getTechnicianDashboard(user)} userName={userName} />;
    case "CLIENT":
      return <ClientDashboard data={await getClientDashboard(user)} userName={userName} />;
    case "MANAGER":
      return <ManagerDashboard data={await getManagerDashboard()} userName={userName} />;
    default:
      redirect("/login");
  }
}
