import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import {
  ShieldCheck,
  BarChart3,
  Users,
  Sparkles,
  Ticket,
  Handshake,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import { amIAdmin } from "../../lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const r = await amIAdmin();
      if (!r.admin) throw redirect({ to: "/dashboard" });
    } catch (e: any) {
      if (e && typeof e === "object" && "to" in e) throw e;
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Visão Geral", icon: BarChart3, exact: true },
  { to: "/admin/usuarios", label: "Usuários", icon: Users, exact: false },
  { to: "/admin/planos", label: "Redefinir plano", icon: CreditCard, exact: false },
  { to: "/admin/beta-testers", label: "Beta Testers", icon: Sparkles, exact: false },
  { to: "/admin/afiliados", label: "Afiliados", icon: Handshake, exact: false },
  { to: "/admin/test-ia", label: "Testar IA", icon: Sparkles, exact: false },
];

const SOON = [{ label: "Cupons", icon: Ticket }];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} /> Voltar ao dashboard
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-7 w-7 text-brand-gold" />
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gestão da plataforma A8 Avalia.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <aside className="space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-blue text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          <div className="pt-3 mt-3 border-t">
            <p className="px-3 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Em breve
            </p>
            {SOON.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground/60 cursor-not-allowed"
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
