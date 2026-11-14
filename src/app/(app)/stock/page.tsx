import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import StockBoard from "@/components/stock/StockBoard";

export default async function StockPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role === "CLIENT") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Gestion des stocks</h1>
        <p className="text-sm text-muted-foreground">
          Catalogue de pièces, niveaux de stock et alertes de réapprovisionnement.
        </p>
      </div>
      <StockBoard role={role} />
    </div>
  );
}
