// Contact form rules, shared by the client form and the Server Action (no server-only imports).

export const CONTACT_LIMITS = { name: 60, email: 254, message: 2000 } as const;

export type ContactInput = { name: string; email: string; message: string };

export type ContactFieldErrors = Partial<Record<keyof ContactInput, string>>;

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | { status: "error"; reason: "invalid" | "rate-limited" | "send-failed" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trims every field, then checks: all required, email format, and lengths ≤ CONTACT_LIMITS.
// Returns {} when valid.
export function validateContact(input: ContactInput): ContactFieldErrors {
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  const errors: ContactFieldErrors = {};

  if (!name) errors.name = "Required";
  else if (name.length > CONTACT_LIMITS.name) errors.name = `Max ${CONTACT_LIMITS.name} characters`;

  if (!email) errors.email = "Required";
  else if (email.length > CONTACT_LIMITS.email) errors.email = `Max ${CONTACT_LIMITS.email} characters`;
  else if (!EMAIL_RE.test(email)) errors.email = "Invalid email";

  if (!message) errors.message = "Required";
  else if (message.length > CONTACT_LIMITS.message) errors.message = `Max ${CONTACT_LIMITS.message} characters`;

  return errors;
}
