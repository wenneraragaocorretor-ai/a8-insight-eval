import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar e Navegação virão aqui na Fase 2 */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b flex items-center px-6 justify-between glass sticky top-0 z-10">
          <div className="font-bold text-xl text-brand-blue">
            A8 <span className="text-brand-gold">Investimentos</span>
          </div>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
