export type Role = "admin" | "manager" | "staff";
export type Profile = { id: string; name: string; email: string; role: Role };
export type Workshop = {
  id: string;
  code: string;
  title: string;
  instructor: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  active_count: number;
  status: "scheduled" | "completed" | "cancelled";
  location: string;
  category: string;
  description: string;
};
export type Registration = {
  id: string;
  workshop_id: string;
  attendee_name: string;
  attendee_email: string;
  status: "active" | "cancelled";
  registered_at: string;
  registered_by_name: string;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
};
export type Audit = {
  id: string;
  actor_name: string;
  action: string;
  entity_id: string;
  created_at: string;
  details: Record<string, unknown>;
};
export type Data = {
  workshops: Workshop[];
  registrations: Registration[];
  users: Profile[];
  audit: Audit[];
};
