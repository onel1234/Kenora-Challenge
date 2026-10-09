import type { Data, Profile, Role, Workshop, Registration } from "./types";
export const demoProfile = (role: Role): Profile => ({
  id:
    role === "admin"
      ? "00000000-0000-4000-8000-000000000001"
      : role === "manager"
        ? "00000000-0000-4000-8000-000000000002"
        : "00000000-0000-4000-8000-000000000003",
  name:
    role === "admin"
      ? "Alex Morgan"
      : role === "manager"
        ? "Jamie Chen"
        : "Sam Rivera",
  email: `${role}@gather.test`,
  role,
});
export function demoData(): Data {
  const samples = [
    [
      "POT-101",
      "The art of pottery",
      "Maya Thompson",
      "Creative",
      "Riverside Centre",
      16,
      11,
      "Shape something with your own hands. A gentle introduction to wheel throwing and clay.",
    ],
    [
      "CODE-201",
      "Your first website",
      "Daniel Park",
      "Technology",
      "Central Studio",
      12,
      8,
      "Turn an idea into a working website, with friendly guidance at every step.",
    ],
    [
      "FIT-102",
      "Mindful movement",
      "Sofia Patel",
      "Wellbeing",
      "Northside Hub",
      20,
      6,
      "Slow down, stretch, and find a little more balance in your week.",
    ],
    [
      "ART-103",
      "Watercolour mornings",
      "Eleanor Brooks",
      "Creative",
      "Central Studio",
      10,
      10,
      "Explore colour, light, and the joy of painting without the pressure.",
    ],
    [
      "COOK-104",
      "Seasonal kitchen",
      "Luca Bennett",
      "Food & Living",
      "Riverside Centre",
      8,
      5,
      "Good food, fresh ingredients, and a few new skills to bring home.",
    ],
    [
      "PHOTO-105",
      "See your city differently",
      "Noah Williams",
      "Creative",
      "Northside Hub",
      14,
      9,
      "A practical walk through the fundamentals of everyday photography.",
    ],
  ];
  const workshops = samples.map((s, i) => {
    const day = new Date();
    day.setDate(day.getDate() + i + 2);
    day.setHours(10, 0, 0, 0);
    return {
      id: `10000000-0000-4000-8000-00000000000${i}`,
      code: s[0],
      title: s[1],
      instructor: s[2],
      category: s[3],
      location: s[4],
      capacity: s[5],
      active_count: s[6],
      description: s[7],
      starts_at: day.toISOString(),
      duration_minutes: 90,
      status: "scheduled",
    } as Workshop;
  });
  const names = [
    "Avery Wilson",
    "Jordan Lee",
    "Taylor Hayes",
    "Morgan Ellis",
    "Casey Stone",
    "Riley Brooks",
    "Cameron Bell",
    "Drew Carter",
    "Parker Gray",
    "Quinn Walker",
    "Reese Davis",
  ];
  const registrations: Registration[] = workshops.flatMap((w) =>
    Array.from({ length: w.active_count }, (_, i) => ({
      id: crypto.randomUUID(),
      workshop_id: w.id,
      attendee_name: names[i % names.length],
      attendee_email: `${names[i % names.length].toLowerCase().replace(" ", ".")}@example.test`,
      status: "active" as const,
      registered_at: new Date(Date.now() - 86400000 * (i + 1)).toISOString(),
      registered_by_name: "Sam Rivera",
      cancelled_at: null,
      cancelled_by_name: null,
    })),
  );
  return {
    workshops,
    registrations,
    users: ["admin", "manager", "staff"].map((r) => demoProfile(r as Role)),
    audit: [],
  };
}
export function mutateDemo(
  data: Data,
  profile: Profile,
  path: string,
  input: Record<string, unknown>,
): Data {
  const next = structuredClone(data),
    now = new Date().toISOString();
  let action = "",
    entity = "";
  if (path === "/workshops") {
    if (profile.role !== "manager")
      throw new Error("Only managers can edit workshops.");
    const old = next.workshops.find((w) => w.id === input.id),
      w = {
        ...input,
        id: old?.id || crypto.randomUUID(),
        active_count: old?.active_count || 0,
      } as Workshop;
    if (w.capacity < w.active_count)
      throw new Error("Capacity cannot be lower than active registrations.");
    if (w.status === "cancelled" && w.active_count)
      throw new Error("Cancel active registrations first.");
    if (
      next.workshops.some(
        (x) => x.code.toUpperCase() === w.code.toUpperCase() && x.id !== w.id,
      )
    )
      throw new Error("That workshop code already exists.");
    next.workshops = old
      ? next.workshops.map((x) => (x.id === w.id ? w : x))
      : [...next.workshops, w];
    action = old ? "workshop_updated" : "workshop_created";
    entity = w.id;
  } else if (path === "/registrations") {
    if (profile.role === "admin")
      throw new Error("Managers and staff can register attendees.");
    const w = next.workshops.find((x) => x.id === input.workshop_id);
    if (!w) throw new Error("Workshop not found.");
    if (w.status !== "scheduled" || new Date(w.starts_at) <= new Date())
      throw new Error("Registration is closed.");
    if (w.active_count >= w.capacity)
      throw new Error("This workshop is full. No seat was booked.");
    if (
      next.registrations.some(
        (r) =>
          r.workshop_id === w.id &&
          r.status === "active" &&
          r.attendee_email.toLowerCase() ===
            String(input.attendee_email).toLowerCase(),
      )
    )
      throw new Error("This attendee is already registered.");
    const r: Registration = {
      id: crypto.randomUUID(),
      workshop_id: w.id,
      attendee_name: String(input.attendee_name),
      attendee_email: String(input.attendee_email).toLowerCase(),
      status: "active",
      registered_at: now,
      registered_by_name: profile.name,
      cancelled_at: null,
      cancelled_by_name: null,
    };
    next.registrations.unshift(r);
    w.active_count++;
    action = "attendee_registered";
    entity = r.id;
  } else if (path.startsWith("/registrations/")) {
    if (profile.role === "admin")
      throw new Error("Managers and staff can cancel registrations.");
    const r = next.registrations.find((x) => x.id === path.split("/")[2]);
    if (!r) throw new Error("Registration not found.");
    if (r.status === "cancelled") return next;
    r.status = "cancelled";
    r.cancelled_at = now;
    r.cancelled_by_name = profile.name;
    next.workshops.find((x) => x.id === r.workshop_id)!.active_count--;
    action = "registration_cancelled";
    entity = r.id;
  } else if (path === "/users") {
    if (profile.role !== "admin")
      throw new Error("Only admins can manage accounts.");
    if (input.id) {
      const user = next.users.find((u) => u.id === input.id)!;
      if (
        user.role === "admin" &&
        input.role !== "admin" &&
        next.users.filter((u) => u.role === "admin").length === 1
      )
        throw new Error("Keep at least one administrator.");
      user.role = input.role as Role;
      action = "role_changed";
      entity = user.id;
    } else {
      if (next.users.some((u) => u.email === input.email))
        throw new Error("An account with this email already exists.");
      const u = {
        id: crypto.randomUUID(),
        name: String(input.name),
        email: String(input.email),
        role: input.role as Role,
      };
      next.users.push(u);
      action = "account_created";
      entity = u.id;
    }
  }
  next.audit.unshift({
    id: crypto.randomUUID(),
    actor_name: profile.name,
    action,
    entity_id: entity,
    created_at: now,
    details: {},
  });
  return next;
}
