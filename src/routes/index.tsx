import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gradient-soft">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  return <Navigate to={user ? "/dashboard" : "/login"} />;
}
