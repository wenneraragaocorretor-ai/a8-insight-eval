import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "../../integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center px-6 justify-between glass sticky top-0 z-10">
          <Link to="/dashboard" className="font-bold text-xl text-brand-blue">
            A8 <span className="text-brand-gold">Investimentos</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-brand-blue" }}
            >
              Painel
            </Link>
            <Link
              to="/planos"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-brand-blue" }}
            >
              Planos
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sair
            </button>
          </nav>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
