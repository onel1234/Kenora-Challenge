import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function authorize(request: Request, roles: string[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new ApiError(
      "Supabase is not configured. Contact the administrator.",
      503,
    );
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError("Please sign in.", 401);
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user)
    throw new ApiError("Your session has expired. Please sign in.", 401);
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || !roles.includes(profile.role))
    throw new ApiError("You do not have permission to do this.", 403);
  return { db, profile };
}
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ApiError("Account management is not configured.", 503);
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function fail(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message || "Invalid input." },
      { status: 400 },
    );
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  const e = error as { code?: string; message?: string };
  const safe = ["P0001", "23505", "23514", "42501"].includes(e.code || "");
  return NextResponse.json(
    {
      error: safe
        ? e.code === "23505"
          ? "That code or active registration already exists."
          : e.message
        : "Unable to complete the request. Please try again.",
    },
    {
      status:
        e.code === "42501" ? 403 : e.code === "23505" ? 409 : safe ? 400 : 500,
    },
  );
}
