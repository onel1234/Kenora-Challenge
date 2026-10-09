import { NextResponse } from "next/server";
import { authorize, serviceClient, fail } from "@/lib/server";
import { userSchema, roleSchema } from "@/lib/validation";
export async function POST(req: Request) {
  try {
    const { db } = await authorize(req, ["admin"]);
    const input = userSchema.parse(await req.json());
    const service = serviceClient();
    const { data, error } = await service.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (error) throw error;
    const { error: profileError } = await db.rpc("provision_profile", {
      p_id: data.user.id,
      p_name: input.name,
      p_email: input.email,
      p_role: input.role,
    });
    if (profileError) {
      await service.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return NextResponse.json({ id: data.user.id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(req: Request) {
  try {
    const { db } = await authorize(req, ["admin"]);
    const input = roleSchema.parse(await req.json());
    const { error } = await db.rpc("change_role", {
      p_id: input.id,
      p_role: input.role,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
