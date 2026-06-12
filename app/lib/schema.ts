import { z } from "zod";

export const signInSchema = z.object({
  employeeId: z
    .string()
    .min(2, "Employee ID must be at least 2 characters")
    .max(50, "Employee ID must be at most 50 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type SignInSchema = z.infer<typeof signInSchema>;
