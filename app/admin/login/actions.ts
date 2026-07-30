"use server";

import { redirect } from "next/navigation";
import { checkAdminPassword, setAdminCookie } from "@/lib/admin-auth";

export interface AdminLoginState {
  error?: string;
}

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const password = String(formData.get("password") || "");

  if (!checkAdminPassword(password)) {
    return { error: "Incorrect password." };
  }

  await setAdminCookie();
  redirect("/admin");
}
