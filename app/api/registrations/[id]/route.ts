import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, fail } from "@/lib/server";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await authorize(req, ["manager", "staff"]);
    const { id } = await params;
    z.uuid().parse(id);
    const { data, error } = await db.rpc("cancel_registration", { p_id: id });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return fail(e);
  }
}
