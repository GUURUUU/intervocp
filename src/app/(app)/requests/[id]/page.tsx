import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RequestDetail from "@/components/requests/RequestDetail";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  return (
    <RequestDetail id={id} role={session.user.role} userId={session.user.id} />
  );
}
