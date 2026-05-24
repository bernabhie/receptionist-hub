import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/login")({ component: LoginPage });

const emailSchema = z.string().email("Invalid email");
const passwordSchema = z.string().min(6, "Min 6 characters");

function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const ev = emailSchema.safeParse(email); const pv = passwordSchema.safeParse(password);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!pv.success) return toast.error(pv.error.issues[0].message);
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Welcome back");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) return toast.error("Enter your full name");
    const ev = emailSchema.safeParse(email); const pv = passwordSchema.safeParse(password);
    if (!ev.success) return toast.error(ev.error.issues[0].message);
    if (!pv.success) return toast.error(pv.error.issues[0].message);
    setBusy(true);
    const { error } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Account created — check your email to confirm, then sign in.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-gradient-soft">
      <div className="absolute inset-0 -z-10 opacity-40" style={{
        backgroundImage: "radial-gradient(circle at 20% 20%, oklch(0.55 0.15 220 / 0.25), transparent 50%), radial-gradient(circle at 80% 80%, oklch(0.72 0.18 145 / 0.25), transparent 50%)",
      }} />
      <Card className="w-full max-w-md p-8 shadow-brand border-2">
        <div className="flex justify-center mb-6">
          <BrandLogo size={56} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">Receptionist Portal</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Sign in to manage appointments and billing
        </p>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={255} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={72} required />
              </div>
              <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground shadow-brand hover:opacity-95" disabled={busy}>
                {busy ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email2">Email</Label>
                <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd2">Password</Label>
                <Input id="pwd2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} required />
              </div>
              <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground shadow-brand hover:opacity-95" disabled={busy}>
                {busy ? "Creating…" : "Create Receptionist Account"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                New accounts get the receptionist role automatically.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
