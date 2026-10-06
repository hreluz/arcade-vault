"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { validateContact, type ContactInput, type ContactState } from "@/lib/contact";
import { rateLimit } from "@/lib/rate-limit";

const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

// Sends the About page contact form to the team inbox through Resend. Never throws to the client.
export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const field = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const input: ContactInput = { name: field("name"), email: field("email"), message: field("message") };
  const name = input.name.trim();

  // Honeypot hit: pretend success so bots get no signal.
  if (field("company")) return { status: "success", name };

  if (Object.keys(validateContact(input)).length > 0) return { status: "error", reason: "invalid" };

  if (!rateLimit(await clientIp(), RATE_LIMIT, RATE_WINDOW_MS)) return { status: "error", reason: "rate-limited" };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error(`[contact] Missing env var: ${!apiKey ? "RESEND_API_KEY" : "CONTACT_TO_EMAIL"}`);
    return { status: "error", reason: "send-failed" };
  }

  const email = input.email.trim();
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM,
      to,
      replyTo: email,
      subject: `[Arcade Vault] New message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${input.message.trim()}`,
    });
    if (error) {
      console.error("[contact] Resend error:", error);
      return { status: "error", reason: "send-failed" };
    }
  } catch (err) {
    console.error("[contact] Resend threw:", err);
    return { status: "error", reason: "send-failed" };
  }

  return { status: "success", name };
}
