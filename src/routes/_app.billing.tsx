import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Printer, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_app/billing")({ component: BillingPage });

const itemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unit_price: z.number().min(0).max(1_000_000),
});

function BillingPage() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", filter],
    queryFn: async () => {
      let q = supabase.from("invoices")
        .select("id, invoice_number, total_amount, amount_paid, status, payment_method, paid_at, created_at, patients(full_name)")
        .order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-list"],
    queryFn: async () => (await supabase.from("patients").select("id, full_name").order("full_name")).data ?? [],
  });

  const stats = invoices.reduce((acc: any, i: any) => {
    const outstanding = Number(i.total_amount) - Number(i.amount_paid);
    acc.total += Number(i.total_amount);
    acc.outstanding += outstanding;
    if (i.status === "paid") acc.paidCount++;
    return acc;
  }, { total: 0, outstanding: 0, paidCount: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground text-sm">Issue invoices and track payments</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="bg-brand-gradient text-primary-foreground shadow-brand"><Plus className="h-4 w-4 mr-1" /> New invoice</Button>
          </DialogTrigger>
          <NewInvoiceDialog patients={patients} onClose={() => setOpenNew(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total billed</div><div className="text-xl font-bold">₱{stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-xl font-bold text-destructive">₱{stats.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Paid invoices</div><div className="text-xl font-bold text-success">{stats.paidCount}</div></Card>
      </div>

      <div className="flex gap-2">
        {(["all", "unpaid", "paid"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs rounded-full border capitalize ${filter === f ? "bg-brand-gradient text-primary-foreground border-transparent" : "hover:bg-accent"}`}>{f}</button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {invoices.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide">
              <tr><th className="text-left p-3">Invoice</th><th className="text-left p-3">Patient</th><th className="text-right p-3">Total</th><th className="text-right p-3">Paid</th><th className="p-3">Status</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((i: any) => (
                <tr key={i.id} className="hover:bg-accent/30 cursor-pointer" onClick={() => setViewing(i)}>
                  <td className="p-3 font-mono text-xs">{i.invoice_number}</td>
                  <td className="p-3">{i.patients?.full_name}</td>
                  <td className="p-3 text-right">₱{Number(i.total_amount).toFixed(2)}</td>
                  <td className="p-3 text-right">₱{Number(i.amount_paid).toFixed(2)}</td>
                  <td className="p-3 text-center"><InvoiceStatusBadge status={i.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{format(new Date(i.created_at), "MMM d")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && <InvoiceDetailDialog invoice={viewing} onClose={() => { setViewing(null); qc.invalidateQueries({ queryKey: ["invoices"] }); }} />}
      </Dialog>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/20 text-foreground",
    unpaid: "bg-destructive/15 text-destructive",
    partial: "bg-warning/25 text-warning-foreground",
  };
  return <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${map[status]}`}>{status}</span>;
}

function NewInvoiceDialog({ patients, onClose }: { patients: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState([{ description: "Consultation", quantity: 1, unit_price: 500 }]);

  const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  const submit = async () => {
    if (!patientId) return toast.error("Select a patient");
    for (const it of items) {
      const v = itemSchema.safeParse(it);
      if (!v.success) return toast.error(v.error.issues[0].message);
    }
    const invoice_number = `INV-${Date.now().toString(36).toUpperCase()}`;
    const { data: inv, error } = await supabase.from("invoices").insert({
      invoice_number, patient_id: patientId, total_amount: total,
    }).select().single();
    if (error || !inv) return toast.error(error?.message ?? "Failed");
    const { error: e2 } = await supabase.from("invoice_items").insert(items.map(it => ({ ...it, invoice_id: inv.id })));
    if (e2) return toast.error(e2.message);
    toast.success("Invoice created");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    onClose();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
            <SelectContent>{patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Line items</Label>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Input className="col-span-6" placeholder="Description" value={it.description} maxLength={200}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
              <Input className="col-span-2" type="number" min={1} value={it.quantity}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
              <Input className="col-span-3" type="number" min={0} step={0.01} value={it.unit_price}
                onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
              <Button size="icon" variant="ghost" className="col-span-1" onClick={() => setItems(items.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}>+ Add item</Button>
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-bold text-brand-gradient">₱{total.toFixed(2)}</span>
        </div>
        <Button className="w-full bg-brand-gradient text-primary-foreground" onClick={submit}>Create invoice</Button>
      </div>
    </DialogContent>
  );
}

function InvoiceDetailDialog({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState(Number(invoice.total_amount) - Number(invoice.amount_paid));
  const [method, setMethod] = useState("cash");

  const { data: items = [] } = useQuery({
    queryKey: ["invoice-items", invoice.id],
    queryFn: async () => (await supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id)).data ?? [],
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      const newPaid = Number(invoice.amount_paid) + amount;
      const status = newPaid >= Number(invoice.total_amount) ? "paid" : newPaid > 0 ? "partial" : "unpaid";
      const { error } = await supabase.from("invoices").update({
        amount_paid: newPaid,
        status,
        payment_method: method,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      }).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment recorded"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onClose(); },
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Invoice {invoice.invoice_number}</DialogTitle></DialogHeader>
      <div className="space-y-3 print:bg-white" id="invoice-print">
        <div className="flex justify-between text-sm">
          <div><div className="text-muted-foreground">Patient</div><div className="font-medium">{invoice.patients?.full_name}</div></div>
          <div className="text-right"><div className="text-muted-foreground">Issued</div><div>{format(new Date(invoice.created_at), "MMM d, yyyy")}</div></div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs"><tr><th className="text-left p-2">Item</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Price</th><th className="text-right p-2">Total</th></tr></thead>
            <tbody className="divide-y">
              {items.map((it: any) => (
                <tr key={it.id}><td className="p-2">{it.description}</td><td className="p-2 text-right">{it.quantity}</td><td className="p-2 text-right">₱{Number(it.unit_price).toFixed(2)}</td><td className="p-2 text-right font-medium">₱{(it.quantity * Number(it.unit_price)).toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between pt-2 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Total / Paid</div>
            <div className="font-medium">₱{Number(invoice.total_amount).toFixed(2)} <span className="text-success">/ ₱{Number(invoice.amount_paid).toFixed(2)}</span></div>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>

        {invoice.status !== "paid" && (
          paying ? (
            <div className="space-y-2 p-3 border rounded-lg bg-accent/30">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Amount</Label><Input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
                <div><Label className="text-xs">Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="gcash">GCash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full bg-brand-gradient text-primary-foreground" onClick={() => recordPayment.mutate()}>Confirm payment</Button>
            </div>
          ) : (
            <Button className="w-full" variant="outline" onClick={() => setPaying(true)}>Record payment</Button>
          )
        )}

        <div className="flex gap-2 print:hidden">
          <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete invoice?")) del.mutate(); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </DialogContent>
  );
}
