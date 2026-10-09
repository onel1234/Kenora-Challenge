import { NextResponse } from "next/server";
import { authorize, fail } from "@/lib/server";
import { workshopSchema } from "@/lib/validation";
export async function POST(req: Request) {
  try {
    const { db } = await authorize(req, ["manager"]);
    const input = workshopSchema.parse(await req.json());
    const { data, error } = await db.rpc("save_workshop", { p_input: input });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return fail(e);
  }
}
