import type { Metadata } from "next";
import ShaderGradientBackground from "@/components/design/ShaderGradientBackground";
import LiquidMetalLogo from "@/components/design/LiquidMetalLogo";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Connexion — IntervOCP",
};

const DEMO_ACCOUNTS = [
  { role: "Administrateur", email: "admin@intervocp.demo" },
  { role: "Répartiteur", email: "dispatcher1@intervocp.demo" },
  { role: "Technicien", email: "tech1@intervocp.demo" },
  { role: "Client", email: "client1@intervocp.demo" },
  { role: "Responsable", email: "manager@intervocp.demo" },
];

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden dark">
      {/* Animated shader gradient background */}
      <ShaderGradientBackground className="absolute inset-0" />
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      <div className="relative z-10 mx-4 flex w-full max-w-md flex-col items-center gap-8 py-12">
        <LiquidMetalLogo width={300} height={76} className="drop-shadow-2xl" />

        <section
          className="glass-panel w-full rounded-2xl p-8"
          aria-label="Connexion à IntervOCP"
        >
          <h1 className="mb-1 text-lg font-semibold text-white">
            Gestion des interventions
          </h1>
          <p className="mb-6 text-sm text-white/60">
            Service IT — Site de Khouribga
          </p>
          <LoginForm />
        </section>

        <section className="glass-panel-soft w-full rounded-xl p-4 text-xs text-white/70">
          <p className="mb-2 font-semibold uppercase tracking-wide text-white/80">
            Comptes de démonstration
          </p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-4">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex flex-col">
                <span className="text-white/85">{account.role}</span>
                <code className="text-[11px] text-emerald-300/90">{account.email}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-white/60">
            Mot de passe&nbsp;: <code className="text-emerald-300/90">Demo1234!</code>
          </p>
        </section>
      </div>
    </main>
  );
}
