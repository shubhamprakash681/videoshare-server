import { z } from "zod";

export const resetPasswordValidator = z.object({
  token: z.string().min(1, { message: "Reset Password Token is required" }),

  password: z
    .string()
    .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/gm, {
      message:
        "Password must have at least 8 characters.\nMust contain at least 1 uppercase letter, 1 lowercase letter, and 1 number.\nCan contain special characters",
    }),
});
