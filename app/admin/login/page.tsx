"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "@/app/admin/login/actions";
import { Button, ErrorText, Input, Label } from "@/components/ui";

const initialState: AdminLoginState = {};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(adminLogin, initialState);

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <form action={formAction} className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-center mb-8">Admin access</h1>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required autoFocus />
        <ErrorText>{state?.error}</ErrorText>
        <Button type="submit" disabled={pending} className="w-full mt-6">
          {pending ? "Checking…" : "Enter"}
        </Button>
      </form>
    </div>
  );
}
