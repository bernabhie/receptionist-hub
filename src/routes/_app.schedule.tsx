import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfDay, endOfDay, startOfWeek, addHours, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/schedule")({ component: SchedulePage });

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8am - 6pm

function SchedulePage() {
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<"day" | "week">("week");

  const start = view === "day" ? startOfDay(anchor) : startOfWeek(anchor, { weekStartsOn: 1 });
  const end = view === "day" ? endOfDay(anchor) : endOfDay(addDays(start, 6));
  const days = view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const { data: appts = [] } = useQuery({
    queryKey: ["schedule", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, procedure_type, status, patients(full_name)")
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
  });

  const shift = (n: number) => setAnchor(addDays(anchor, view === "day" ? n : n * 7));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground text-sm">
            {format(start, "MMM d")} – {format(end, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-card overflow-hidden">
            <button onClick={() => setView("day")} className={cn("px-3 py-1.5 text-sm", view === "day" && "bg-brand-gradient text-primary-foreground")}>Day</button>
            <button onClick={() => setView("week")} className={cn("px-3 py-1.5 text-sm", view === "week" && "bg-brand-gradient text-primary-foreground")}>Week</button>
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="overflow-auto">
        <div className="min-w-[640px]">
          <div className="grid sticky top-0 bg-card z-10 border-b" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map(d => (
              <div key={d.toISOString()} className={cn("p-2 text-center border-l", isSameDay(d, new Date()) && "bg-brand-gradient-soft")}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{format(d, "EEE")}</div>
                <div className="font-semibold">{format(d, "d")}</div>
              </div>
            ))}
          </div>
          {HOURS.map(h => (
            <div key={h} className="grid border-b min-h-16" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
              <div className="p-2 text-xs text-muted-foreground text-right pr-3">{format(addHours(startOfDay(new Date()), h), "h a")}</div>
              {days.map(d => {
                const slotStart = addHours(startOfDay(d), h);
                const slotEnd = addHours(slotStart, 1);
                const items = appts.filter((a: any) => {
                  const t = new Date(a.scheduled_at);
                  return t >= slotStart && t < slotEnd;
                });
                return (
                  <div key={d.toISOString() + h} className="border-l p-1 space-y-1">
                    {items.map((a: any) => (
                      <div key={a.id} className={cn(
                        "rounded-md px-2 py-1 text-xs shadow-soft",
                        a.status === "cancelled" && "bg-muted text-muted-foreground line-through",
                        a.status === "completed" && "bg-success/20 text-foreground",
                        a.status === "no_show" && "bg-destructive/20 text-foreground",
                        a.status === "scheduled" && "bg-brand-gradient text-primary-foreground",
                      )}>
                        <div className="font-semibold truncate">{a.patients?.full_name}</div>
                        <div className="opacity-90 capitalize">{format(new Date(a.scheduled_at), "h:mm a")} · {a.procedure_type.replace("_", " ")}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
