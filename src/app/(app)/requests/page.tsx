import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import RequestsBrowser from "@/components/requests/RequestsBrowser";

export default async function RequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Demandes d&rsquo;intervention</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des demandes : filtres, recherche et création.
        </p>
      </div>
      <RequestsBrowser role={session.user.role} />
    </div>
  );
}
