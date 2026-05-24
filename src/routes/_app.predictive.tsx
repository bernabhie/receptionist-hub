import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { addDays, addHours, format, startOfDay } from "date-fns";
import { trainDecisionTree, seedTrainingData, rankSlots, predictNoShow, type TrainingRow } from "@/lib/predict";

export const Route = createFileRoute("/_app/predictive")({ component: PredictivePage });

const PROCEDURES = ["checkup", "cleaning", "filling", "extraction", "root_canal", "consultation"];

function PredictivePage() {
  const [procedure, setProcedure] = useState("checkup");
  const [searchDate, setSearchDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));

  // Pull historical appointments to train the decision tree
  const { data: history = [] } = useQuery({
    queryKey: ["appt-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_at, procedure_type, status, created_at")
        .in("status", ["completed", "no_show", "cancelled"])
        .limit(500);
      return data ?? [];
    },
  });

  const { tree, trainingSize, realRows, noShowRate } = useMemo(() => {
    const realRows: TrainingRow[] = history.map((a: any) => {
      const sched = new Date(a.scheduled_at);
      const created = new Date(a.created_at);
      return {
        hour: sched.getHours(),
        dayOfWeek: sched.getDay(),
        procedure: a.procedure_type,
        leadDays: Math.max(0, Math.round((sched.getTime() - created.getTime()) / 86_400_000)),
        noShow: (a.status === "no_show" || a.status === "cancelled" ? 1 : 0) as 0 | 1,
      };
    });
    // Blend with seeded data so the model has a meaningful baseline on day one
    const rows = [...realRows, ...seedTrainingData()];
    const noShows = realRows.filter(r => r.noShow === 1).length;
    return {
      tree: trainDecisionTree(rows, 5, 4),
      trainingSize: rows.length,
      realRows: realRows.length,
      noShowRate: realRows.length > 0 ? (noShows / realRows.length) : 0,
    };
  }, [history]);

  // Build candidate slots: every 30 min from 8am-6pm on the selected date
  const candidates = useMemo(() => {
    const day = startOfDay(new Date(searchDate));
    const today = new Date();
    const out = [];
    for (let h = 8; h < 18; h++) {
      for (const m of [0, 30]) {
        const slot = new Date(day);
        slot.setHours(h, m, 0, 0);
        const leadDays = Math.max(0, Math.round((slot.getTime() - today.getTime()) / 86_400_000));
        out.push({ scheduledAt: slot, procedure, leadDays });
      }
    }
    return out;
  }, [searchDate, procedure]);

  const ranked = useMemo(() => rankSlots(tree, candidates), [tree, candidates]);

  // Risk for upcoming scheduled appointments
  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-risk"],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("id, scheduled_at, procedure_type, created_at, patients(full_name)")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at").limit(20);
      return data ?? [];
    },
  });

  const flagged = upcoming.map((a: any) => {
    const sched = new Date(a.scheduled_at);
    const created = new Date(a.created_at);
    const risk = predictNoShow(tree, {
      hour: sched.getHours(),
      dayOfWeek: sched.getDay(),
      procedure: a.procedure_type,
      leadDays: Math.max(0, Math.round((sched.getTime() - created.getTime()) / 86_400_000)),
    });
    return { ...a, risk };
  }).sort((a, b) => b.risk - a.risk);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-secondary" /> Predictive Scheduling
        </h1>
        <p className="text-muted-foreground text-sm">Decision Tree model predicts no-show risk and recommends safer slots.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-xs text-muted-foreground">Training samples</div><div className="text-2xl font-bold">{trainingSize}</div><div className="text-xs text-muted-foreground">{realRows} from your history</div></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground">Historical no-show rate</div><div className="text-2xl font-bold">{(noShowRate * 100).toFixed(1)}%</div></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground">Model</div><div className="text-2xl font-bold">Decision Tree</div><div className="text-xs text-muted-foreground">Gini split, depth 5</div></Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-3">Find best slots</h2>
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
          </div>
          <div>
            <Label>Procedure</Label>
            <Select value={procedure} onValueChange={setProcedure}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROCEDURES.map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ranked.slice(0, 8).map((s, i) => (
            <div key={i} className={`p-3 rounded-lg border ${i < 3 ? "bg-success/10 border-success/30" : "bg-card"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{format(s.scheduledAt, "h:mm a")}</div>
                {i < 3 ? <TrendingDown className="h-4 w-4 text-success" /> : <TrendingUp className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Risk: <span className="font-medium text-foreground">{(s.riskPct * 100).toFixed(0)}%</span></div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">Green = lowest predicted no-show risk for this date + procedure.</p>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-1">Upcoming appointments — risk analysis</h2>
        <p className="text-xs text-muted-foreground mb-4">Highest-risk bookings to consider following up on.</p>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No upcoming scheduled appointments.</p>
        ) : (
          <div className="divide-y">
            {flagged.map((a: any) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "EEE, MMM d · h:mm a")} · {a.procedure_type.replace("_", " ")}</div>
                </div>
                <RiskBadge risk={a.risk} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RiskBadge({ risk }: { risk: number }) {
  const pct = (risk * 100).toFixed(0);
  const tone = risk > 0.5 ? "bg-destructive/15 text-destructive" : risk > 0.3 ? "bg-warning/25 text-warning-foreground" : "bg-success/20 text-foreground";
  return <span className={`text-xs px-2 py-1 rounded font-medium ${tone}`}>{pct}% risk</span>;
}
