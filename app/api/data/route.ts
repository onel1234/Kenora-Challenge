import { NextResponse } from "next/server";
import { authorize, fail } from "@/lib/server";
export async function GET(req: Request) {
  try {
    const { db, profile } = await authorize(req, ["admin", "manager", "staff"]);
    const tables =
      profile.role === "admin"
        ? ["profiles", "audit_log"]
        : ["workshops", "registrations", "audit_log"];
    const results = await Promise.all(
      tables.map(async (t) => {
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await db
            .from(t)
            .select("*")
            .order(
              t === "workshops"
                ? "starts_at"
                : t === "registrations"
                  ? "registered_at"
                  : t === "profiles"
                    ? "name"
                    : "created_at",
              { ascending: t === "workshops" || t === "profiles" },
            )
            .order("id")
            .range(offset, offset + 999);
          if (error) throw error;
          rows.push(...data);
          if (data.length < 1000) break;
        }
        return rows;
      }),
    );
    const rows = Object.fromEntries(tables.map((t, i) => [t, results[i]]));
    return NextResponse.json(
      {
        profile,
        workshops: rows.workshops || [],
        registrations: rows.registrations || [],
        users: rows.profiles || [],
        audit: rows.audit_log || [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
