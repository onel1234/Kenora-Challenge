import { z } from "zod";
export const workshopSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(120),
  instructor: z.string().trim().min(2).max(100),
  starts_at: z.iso.datetime({ offset: true }),
  duration_minutes: z.number().int().min(15).max(720),
  capacity: z.number().int().min(1).max(1000),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  location: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(50),
  description: z.string().trim().max(1000),
});
export const registrationSchema = z.object({
  workshop_id: z.uuid(),
  attendee_name: z.string().trim().min(2).max(100),
  attendee_email: z.email().max(254),
});
export const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["admin", "manager", "staff"]),
});
export const roleSchema = z.object({
  id: z.uuid(),
  role: z.enum(["admin", "manager", "staff"]),
});
