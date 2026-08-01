"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { AuthShell } from "@/components/AuthShell";

export default function SignUpPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { display_name: displayName.trim() },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <AuthShell title="Check your inbox">
        <p className="text-parchment/80 text-sm">
          We sent a confirmation link to <strong>{email}</strong>. Follow it
          to activate your account, then sign in.
        </p>
        <Link href="/sign-in" className="text-gold text-sm mt-6 inline-block">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="display-name">Your name</Label>
          <Input
            id="display-name"
            required
            autoComplete="name"
            placeholder="How your beneficiaries know you"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="text-sm text-parchment/60 mt-6 text-center">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-gold">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
