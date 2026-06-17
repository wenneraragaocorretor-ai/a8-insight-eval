import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../../integrations/supabase/client";
import { amIAdmin } from "../../lib/admin.functions";

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
  const fetchAdmin = useServerFn(amIAdmin);
  const queryClient = useQueryClient();
  const { data: adminStatus } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: fetchAdmin,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
  const isAdmin = !!adminStatus?.admin;

  // Invalida cache de admin quando a sessão muda (login/logout)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["am-i-admin"] });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center px-6 justify-between glass sticky top-0 z-10" translate="no">
          <Link to="/dashboard" className="font-bold text-xl text-brand-blue" translate="no">
            A8 <span className="text-brand-gold">Avalia</span>
          </Link>
          <nav className="flex items-center gap-5" translate="no">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-brand-blue" }}
              translate="no"
            >
              Painel
            </Link>
            <Link
              to="/perfil"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-brand-blue" }}
              translate="no"
            >
              Meu Perfil
            </Link>
            <Link
              to="/planos"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-sm font-medium text-brand-blue" }}
              translate="no"
            >
              Planos
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="text-sm font-medium text-brand-gold hover:text-brand-gold/80"
                activeProps={{ className: "text-sm font-medium text-brand-gold underline" }}
                translate="no"
              >
                Painel Admin
              </Link>
            )}

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              translate="no"
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
