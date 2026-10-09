import { NextResponse } from "next/server";
import { authorize, fail } from "@/lib/server";
import { registrationSchema } from "@/lib/validation";
export async function POST(req: Request) {
  try {
    const { db } = await authorize(req, ["manager", "staff"]);
    const input = registrationSchema.parse(await req.json());
    const { data, error } = await db.rpc("register_attendee", {
      p_workshop_id: input.workshop_id,
      p_name: input.attendee_name,
      p_email: input.attendee_email,
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
