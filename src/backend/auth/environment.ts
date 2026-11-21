import "server-only";
import { z } from "zod";

const Configuration = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  }),
  publicKey: z.string().min(1).refine((key) => !key.startsWith("sb_secret_")),
  secret: z.string().min(1),
});

export function supabaseConfiguration(url: unknown, publicKey: unknown, secret: unknown) {
  const result = Configuration.safeParse({ url, publicKey, secret });
  // Never include values or Zod's input in configuration errors.
  if (!result.success) throw new Error("Invalid Supabase environment configuration");
  if (typeof publicKey === "string" && publicKey.split(".").length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString());
      if (claims.role !== "anon") throw new Error();
    } catch { throw new Error("Public Supabase key must be publishable or anon"); }
  }
  return result.data;
}
