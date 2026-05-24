import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_app/appointments")({ component: AppointmentsPage });

const PROCEDURES = ["checkup", "cleaning", "filling", "extraction", "root_canal", "consultation"] as const;
const STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;

const apptSchema = z.object({
  patient_id: z.string().uuid("Select a patient"),
  scheduled_at: z.string().min(1, "Pick a date/time"),
  duration_minutes: z.number().min(10).max(240),
  procedure_type: z.enum(PROCEDURES),
  notes: z.string().max(500).optional(),
});

const patientSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
});

function AppointmentsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | typeof STATUSES[number]>("all");
  const [openAppt, setOpenAppt] = useState(false);
  const [openPatient, setOpenPatient] = useState(false);

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments", filter],
    queryFn: async () => {
      let q = supabase.from("appointments")
        .select("id, scheduled_at, duration_minutes, procedure_type, status, notes, patients(id, full_name, phone)")
        .order("scheduled_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name, phone").order("full_name");
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: typeof STATUSES[number] }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAppt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Deleted"); },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm">Create, update, and manage bookings</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={openPatient} onOpenChange={setOpenPatient}>
            <DialogTrigger asChild>
              <Button variant="outline">+ New patient</Button>
            </DialogTrigger>
            <PatientDialog onClose={() => setOpenPatient(false)} />
          </Dialog>
          <Dialog open={openAppt} onOpenChange={setOpenAppt}>
            <DialogTrigger asChild>
              <Button className="bg-brand-gradient text-primary-foreground shadow-brand"><Plus className="h-4 w-4 mr-1" /> New appointment</Button>
            </DialogTrigger>
            <AppointmentDialog patients={patients} onClose={() => setOpenAppt(false)} />
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-xs rounded-full border capitalize ${filter === s ? "bg-brand-gradient text-primary-foreground border-transparent" : "hover:bg-accent"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {appts.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No appointments yet.</p>
        ) : (
          <div className="divide-y">
            {appts.map((a: any) => (
              <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{a.patients?.full_name}</span>
                    <Badge variant="outline" className="capitalize">{a.procedure_type.replace("_", " ")}</Badge>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {format(new Date(a.scheduled_at), "EEE, MMM d, yyyy · h:mm a")} · {a.duration_minutes} min
                    {a.patients?.phone && <span className="ml-2">· 📞 {a.patients.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={a.status} onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v })}>
                    <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete appointment?")) deleteAppt.mutate(a.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-primary/15 text-primary",
    completed: "bg-success/20 text-foreground",
    cancelled: "bg-muted text-muted-foreground",
    no_show: "bg-destructive/15 text-destructive",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${map[status]}`}>{status.replace("_", " ")}</span>;
}

function PatientDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", date_of_birth: "", notes: "" });
  const submit = async () => {
    const v = patientSchema.safeParse(form);
    if (!v.success) return toast.error(v.error.issues[0].message);
    const { error } = await supabase.from("patients").insert({
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      date_of_birth: form.date_of_birth || null,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Patient added");
    qc.invalidateQueries({ queryKey: ["patients"] });
    onClose();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New patient</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} /></div>
          <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
        </div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
        <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></div>
        <Button className="w-full bg-brand-gradient text-primary-foreground" onClick={submit}>Save patient</Button>
      </div>
    </DialogContent>
  );
}

function AppointmentDialog({ patients, onClose }: { patients: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    patient_id: "",
    scheduled_at: format(new Date(Date.now() + 24 * 3600 * 1000), "yyyy-MM-dd'T'HH:mm"),
    duration_minutes: 30,
    procedure_type: "checkup" as typeof PROCEDURES[number],
    notes: "",
  });
  const submit = async () => {
    const v = apptSchema.safeParse(form);
    if (!v.success) return toast.error(v.error.issues[0].message);
    const { error } = await supabase.from("appointments").insert({
      patient_id: form.patient_id,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      procedure_type: form.procedure_type,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Appointment booked");
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["schedule"] });
    onClose();
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Patient</Label>
          <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
            <SelectContent>
              {patients.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">Add a patient first</div>}
              {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date & time</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
          <div><Label>Duration (min)</Label><Input type="number" min={10} max={240} step={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
        </div>
        <div>
          <Label>Procedure</Label>
          <Select value={form.procedure_type} onValueChange={(v) => setForm({ ...form, procedure_type: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROCEDURES.map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></div>
        <Button className="w-full bg-brand-gradient text-primary-foreground" onClick={submit}>Book appointment</Button>
      </div>
    </DialogContent>
  );
}
