import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Calendar, Users, Receipt, AlertTriangle } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const today = new Date();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [appts, patients, invoices, upcoming] = await Promise.all([
        supabase.from("appointments").select("id, status", { count: "exact", head: false })
          .gte("scheduled_at", startOfDay(today).toISOString())
          .lte("scheduled_at", endOfDay(today).toISOString()),
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("total_amount, amount_paid, status"),
        supabase.from("appointments")
          .select("id, scheduled_at, procedure_type, status, patients(full_name)")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at").limit(6),
      ]);
      const unpaid = (invoices.data ?? []).filter(i => i.status !== "paid")
        .reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0);
      return {
        todayCount: appts.data?.length ?? 0,
        patientCount: patients.count ?? 0,
        unpaidAmount: unpaid,
        upcoming: upcoming.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Today's Appointments", value: stats?.todayCount ?? 0, icon: Calendar, tint: "from-primary/20 to-primary/5" },
    { label: "Total Patients", value: stats?.patientCount ?? 0, icon: Users, tint: "from-secondary/30 to-secondary/5" },
    { label: "Outstanding Balance", value: `₱${(stats?.unpaidAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Receipt, tint: "from-warning/30 to-warning/5" },
    { label: "AI Predictions", value: "Active", icon: AlertTriangle, tint: "from-accent/40 to-accent/5" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Good day 👋</h1>
        <p className="text-muted-foreground">{format(today, "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className={`p-5 border-0 bg-gradient-to-br ${c.tint} shadow-soft`}>
            <c.icon className="h-5 w-5 mb-3 text-foreground/70" />
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Upcoming appointments</h2>
          <Link to="/schedule" className="text-sm text-primary hover:underline">View schedule →</Link>
        </div>
        {(stats?.upcoming ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No upcoming appointments.</p>
        ) : (
          <div className="divide-y">
            {stats?.upcoming.map((a: any) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{a.patients?.full_name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.procedure_type.replace("_", " ")}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{format(new Date(a.scheduled_at), "MMM d")}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "h:mm a")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
