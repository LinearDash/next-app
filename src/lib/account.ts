import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { supabaseConfig } from "./config";

export async function readAccount() {
  if (!supabaseConfig()) return null;
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error && (!error.status || error.status >= 500))
    throw new Error("Account service unavailable");
  if (!data.user) return null;
  return { client, user: data.user };
}

export async function requireAccount() {
  const account = await readAccount();
  if (!account) redirect("/login");
  return account;
}
