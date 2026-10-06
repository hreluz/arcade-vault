# SPEC 03 — About page and contact mailing

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-06
> **Objective:** Port the About + Contact page in `references/templates/home-about/about.jsx` to `/about` with English copy, and deliver its contact form to the team inbox through Resend.

## Why this spec exists

SPEC 02 ported the landing page and deliberately left `about.jsx` for its own spec, because the contact form needs validation, success and failure states. This spec adds the page, the "About" nav link, and a real send path: a Server Action that emails the team through Resend.

## Scope

**In:**

- A new page at `/about` with the sections of `about.jsx`, in order:
  1. Hero: kicker, title, mission paragraph and three highlight cards with pixel icons (HEART, BROWSER, PLANT).
  2. Divider banner: two bars and 24 blinking pixels. Revealed on scroll.
  3. Contact: intro (kicker, title, subtitle, three LED tips) and the contact form. Revealed on scroll.
- Contact form with three fields (name, email, message), the template's shake on invalid submit, a pending state, an inline error line, and the template's terminal success screen with "SEND ANOTHER MESSAGE".
- A Server Action that re-validates the input, applies a honeypot and an in-memory per-IP rate limit, and sends one notification email to the team inbox through the Resend SDK.
- Nav: "About" added as the last link on desktop and in the mobile drawer, active on `/about`.
- The About styles from `references/templates/home-about/styles.css` are ported into `app/globals.css`.
- `resend` added as a dependency, and a committed `.env.template` documenting the env vars.
- All copy translated to English (see the copy table).

**Out of scope (for future specs):**

- An auto-reply / confirmation email to the visitor.
- React Email templates or HTML email bodies. The email is plain text.
- A verified sending domain. The sender defaults to `onboarding@resend.dev`.
- Persisting messages (database, admin inbox, logs beyond `console.error`).
- A distributed / persistent rate limiter (Redis, Upstash, etc.) and CAPTCHA.
- A public API endpoint (`app/api/contact`).
- Auth. The form does not prefill name or email from a user.
- Automated tests (no test runner is configured).

## Data model

No persistent data. The only state is the in-memory rate-limit map, which is lost on restart.

`lib/contact.ts` — shared by the client form and the Server Action (no server-only imports):

```ts
export const CONTACT_LIMITS = { name: 60, email: 254, message: 2000 } as const;

export type ContactInput = { name: string; email: string; message: string };

export type ContactFieldErrors = Partial<Record<keyof ContactInput, string>>;

// Trims every field, then checks: all required, email matches /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
// and lengths ≤ CONTACT_LIMITS. Returns {} when valid.
export function validateContact(input: ContactInput): ContactFieldErrors;

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }   // trimmed name, shown upper-cased in the terminal
  | { status: "error"; reason: "invalid" | "rate-limited" | "send-failed" };
```

`lib/rate-limit.ts` — server only:

```ts
// Sliding window: allows `limit` hits per `windowMs` per key. Stored in a module-level Map<string, number[]>.
// Expired timestamps are pruned on each call.
export function rateLimit(key: string, limit: number, windowMs: number): boolean; // true = allowed
```

The contact action uses `rateLimit(ip, 3, 10 * 60 * 1000)`. The IP is the first entry of the `x-forwarded-for` header, else `x-real-ip`, else `"unknown"` (read with `headers()` from `next/headers`).

`app/about/actions.ts` — `"use server"`:

```ts
export async function sendContactMessage(prev: ContactState, formData: FormData): Promise<ContactState>;
```

Form field names: `name`, `email`, `message`, and the honeypot `company`.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | yes | — | Resend API key |
| `CONTACT_TO_EMAIL` | yes | — | Team inbox that receives the messages |
| `CONTACT_FROM_EMAIL` | no | `Arcade Vault <onboarding@resend.dev>` | Sender. `onboarding@resend.dev` only delivers to the Resend account owner's address |

`.env.template` lists the three with empty/placeholder values. Real values go in `.env.local` (already git-ignored by `.env*`).

## Server Action behavior

`sendContactMessage` runs these steps in order and never throws to the client:

1. Read `company`. If it is non-empty (honeypot hit), return `{ status: "success", name }` **without** sending and without touching the rate limit.
2. Build `ContactInput` from `formData` (missing fields become `""`) and run `validateContact`. If any error, return `{ status: "error", reason: "invalid" }`.
3. Call `rateLimit(ip, 3, 600_000)`. If not allowed, return `{ status: "error", reason: "rate-limited" }`.
4. If `RESEND_API_KEY` or `CONTACT_TO_EMAIL` is missing, `console.error` the missing variable name and return `{ status: "error", reason: "send-failed" }`. The `Resend` client is created inside the action, after this check.
5. Call `resend.emails.send` with:
   - `from`: `CONTACT_FROM_EMAIL` or the default
   - `to`: `CONTACT_TO_EMAIL`
   - `replyTo`: the visitor's email
   - `subject`: `[Arcade Vault] New message from <name>`
   - `text`: `Name: <name>\nEmail: <email>\n\n<message>`
6. If the SDK returns an `error` (or throws), `console.error` it and return `{ status: "error", reason: "send-failed" }`. Otherwise return `{ status: "success", name }`.

## Form behavior (client)

- `components/contact-form.tsx` is a client component using `useActionState(sendContactMessage, { status: "idle" })`.
- Inputs are controlled (as in the template) so typed text survives an error. Each input has `maxLength` from `CONTACT_LIMITS`; the email input is `type="email"`.
- On submit, the form runs `validateContact` first. If invalid, it prevents the submit and shakes (`.shake` for 400 ms). No request is made.
- While pending: inputs and button are disabled and the button reads `▶ TRANSMITTING…`.
- On `error`: the form shakes and shows one line above the submit button (`.contact-error`, red, `role="alert"`) with the message from the error table.
- On `success`: the form content is replaced by the terminal success screen. "SEND ANOTHER MESSAGE" clears the fields and returns to the empty form. The action state is reset by remounting the inner form with a new `key`.
- The honeypot `company` input is visually hidden off-screen (`.hp-field`), `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden="true"`.

| Reason | Error line |
| --- | --- |
| `invalid` | CHECK THE FIELDS AND TRY AGAIN. |
| `rate-limited` | TOO MANY MESSAGES. WAIT A FEW MINUTES. |
| `send-failed` | TRANSMISSION FAILED. TRY AGAIN. |

## Files

| File | Kind | Purpose |
| --- | --- | --- |
| `app/about/page.tsx` | new, server | The About page: hero, highlights, divider, contact intro and `<ContactForm />`. Exports `metadata` |
| `app/about/actions.ts` | new, server action | `sendContactMessage` |
| `components/contact-form.tsx` | new, client | Form, pending/error states and terminal success screen |
| `components/highlight-icon.tsx` | new, server | Pixel icons HEART / BROWSER / PLANT |
| `components/reveal.tsx` | modified | Optional `as?: "section" \| "div"` prop (default `"section"`) so the divider renders as a `<div>` |
| `lib/contact.ts` | new | Limits, types and `validateContact` |
| `lib/rate-limit.ts` | new | In-memory sliding-window limiter |
| `components/nav.tsx` | modified | `about` section, "About" link last on desktop and drawer |
| `app/globals.css` | modified | ABOUT PAGE block, `.contact-error`, `.hp-field`, reduced-motion additions |
| `.env.template` | new | Documents the three env vars |
| `package.json` / `package-lock.json` | modified | `resend` dependency |

## English copy

| Template (ES) | About page (EN) |
| --- | --- |
| Acerca de (nav) | About |
| ▸ ACERCA DE | ▸ ABOUT |
| ACERCA DE ARCADE VAULT | ABOUT ARCADE VAULT |
| ARCADE VAULT nació del amor por los videojuegos clásicos… | ARCADE VAULT was born from a love of classic video games. Our mission is to preserve and celebrate the arcades that defined a generation, making them accessible to everyone, anywhere, at no cost. |
| HECHO CON ❤️ PARA JUGADORES | MADE WITH ❤️ FOR PLAYERS |
| JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR | HTML GAMES — RUN IN ANY BROWSER |
| PROYECTO EN CONSTANTE CRECIMIENTO | A PROJECT THAT KEEPS GROWING |
| ▸ CONTACTO | ▸ CONTACT |
| CONTÁCTANOS | CONTACT US |
| ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar? Escríbenos. | Got a suggestion, want to propose a game, or just want to say hi? Write to us. |
| RESPUESTA EN 24-48H | REPLY IN 24-48H |
| SUGERENCIAS BIENVENIDAS | SUGGESTIONS WELCOME |
| SIN SPAM, JAMÁS | NO SPAM, EVER |
| NOMBRE / placeholder `px_kai` | NAME / `px_kai` |
| CORREO ELECTRÓNICO / `jugador@vault.gg` | EMAIL / `player@vault.gg` |
| MENSAJE / Cuéntanos qué tienes en mente… | MESSAGE / Tell us what's on your mind… |
| ▶ ENVIAR MENSAJE | ▶ SEND MESSAGE |
| [OK] Conectando con servidor… | [OK] Connecting to server… |
| [OK] Validando contenido… | [OK] Validating content… |
| [OK] Transmitiendo paquete… | [OK] Transmitting packet… |
| > MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NAME}. | > MESSAGE RECEIVED. WE'LL GET BACK TO YOU SOON. THANKS, {NAME}. |
| ENVIAR OTRO MENSAJE | SEND ANOTHER MESSAGE |

`VAULT-OS // TERMINAL`, `vault@arcade:~$ ./send_message --to=team` stay as is.

## Implementation plan

Before each step that touches a Next.js API (Server Actions, `useActionState`, `headers()`, `metadata`), check `node_modules/next/dist/docs/` (`01-app/02-guides/server-actions.md`, `forms.md`, `environment-variables.md`). Follow the project rule of using the `/frontend-design` skill for UI work.

1. Port the ABOUT PAGE block (reference `styles.css` lines ~1071–1146) into `app/globals.css`, in the same layer as the existing component classes. Skip rules that already exist (`.field`, `.field label`, `.field input`, `blink`, `caret`). Add `@keyframes shake` and `@keyframes pxblink` only if missing. Add `.contact-error`, `.hp-field`, and extend the `prefers-reduced-motion: reduce` rule to stop `.div-pixels span` and `.contact-form.shake`. Verify: `npm run build` passes and existing pages look unchanged.
2. Add the `as` prop to `components/reveal.tsx`. Verify: `/` still renders exactly as before.
3. Create `components/highlight-icon.tsx` and `app/about/page.tsx` with the hero, highlights, divider (`<Reveal as="div" className="about-divider">`) and the contact intro, plus a static placeholder where the form goes. Add `metadata` in the style of the other pages. Verify: `/about` matches the reference above the form.
4. Update `components/nav.tsx`: `about` section for `/about`, "About" as the last link on desktop and in the drawer. Verify: "About" is active only on `/about`.
5. Create `lib/contact.ts` and `lib/rate-limit.ts`. Verify: `npx tsc --noEmit` passes.
6. `npm install resend`. Create `.env.template`. Create `app/about/actions.ts` following the Server Action behavior section. Verify: `npx tsc --noEmit` passes.
7. Create `components/contact-form.tsx` following the Form behavior section and mount it in `app/about/page.tsx`. Verify manually against the acceptance criteria below.
8. Run `npm run lint` and `npm run build` and fix any issues.

## Acceptance criteria

- [ ] `npm run build` completes with no type or lint errors.
- [ ] `npm run lint` reports no errors.
- [ ] `resend` is in `dependencies` and `.env.template` lists `RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `CONTACT_FROM_EMAIL`.
- [ ] `/about` renders hero, divider and contact sections in order, with no console errors and no hydration warnings.
- [ ] The divider and contact sections start hidden and fade in when scrolled into view.
- [ ] The nav shows Home · Library · Hall of Fame · About on desktop and in the drawer. "About" is active only on `/about`.
- [ ] Submitting with any field empty shakes the form and sends no network request.
- [ ] With valid env vars, submitting a valid form shows `▶ TRANSMITTING…` while pending, then the terminal screen ending in `THANKS, <NAME>.` in upper case, and one email arrives at `CONTACT_TO_EMAIL` with the subject `[Arcade Vault] New message from <name>` and reply-to set to the visitor's email.
- [ ] "SEND ANOTHER MESSAGE" returns to an empty form.
- [ ] With `RESEND_API_KEY` unset, a valid submit shakes the form, shows `TRANSMISSION FAILED. TRY AGAIN.`, keeps the typed text, and the server log names the missing variable.
- [ ] A fourth valid submit within 10 minutes from the same IP shows `TOO MANY MESSAGES. WAIT A FEW MINUTES.` and sends no email.
- [ ] Filling the hidden `company` field (via DevTools) and submitting shows the success screen but sends no email.
- [ ] A request crafted with an invalid email or a message over 2000 characters returns `{ status: "error", reason: "invalid" }` and sends no email.
- [ ] The honeypot field is not reachable with Tab and not announced by screen readers.
- [ ] With "prefers-reduced-motion: reduce" emulated, the divider and contact are visible without animation and the divider pixels do not blink.
- [ ] At 375px viewport width `/about` does not scroll horizontally and the contact grid is one column.
- [ ] No visible text on `/about` remains in Spanish.
- [ ] `RESEND_API_KEY` never appears in client bundles (`grep -r RESEND_API_KEY .next/static` finds nothing).

## Decisions

- **Yes:** Single combined page at `/about`, as in the template.
- **No:** Separate `/about` and `/contact` pages.
- **Yes:** Server Action (`"use server"`) called through `useActionState`.
- **No:** A Route Handler at `app/api/contact`. It would be a public endpoint with no extra benefit for a single form.
- **Yes:** One plain-text notification email to the team with `replyTo` set to the visitor, so the team answers by replying.
- **No:** Auto-reply to the visitor. It needs a verified domain and doubles the abuse surface.
- **No:** React Email / HTML body. Plain text avoids escaping user input into HTML.
- **Yes:** Hand-written validation in `lib/contact.ts`, shared by client and server. The server always re-validates.
- **No:** Zod. One small form does not justify a new dependency.
- **Yes:** Honeypot plus an in-memory per-IP rate limit (3 per 10 minutes).
- **No:** CAPTCHA or a persistent limiter. Out of proportion for now; see Risks.
- **Yes:** Honeypot hits return a fake success, so bots get no signal.
- **Yes:** Errors shown inline with the template's shake; typed text is kept.
- **No:** A terminal-style error screen. It would hide the user's input.
- **Yes:** `onboarding@resend.dev` as the default sender until a domain is verified; overridable with `CONTACT_FROM_EMAIL`.
- **Yes:** Missing env vars degrade to a `send-failed` error instead of crashing the page or build.
- **Yes:** "About" is the last nav link, as in the template.
- **Yes:** Extend `<Reveal>` with an `as` prop instead of the template's global `.reveal` query, consistent with SPEC 02.
- **Yes:** Reuse the template's CSS classes ported into `app/globals.css`, as SPEC 01 and 02 did.

## Risks

| Risk | Mitigation |
| --- | --- |
| In-memory rate limit resets on restart and is per instance in serverless deploys | Accepted for now. The honeypot covers simple bots. A persistent limiter is its own spec. |
| `x-forwarded-for` can be spoofed when not behind a trusted proxy | Accepted. Only the first entry is used; worst case a spammer evades the limit, not the honeypot or validation. |
| `onboarding@resend.dev` only delivers to the Resend account owner's address | `CONTACT_TO_EMAIL` must be that address until a domain is verified. Documented in `.env.template`. |
| The API key leaks to the client | Only read inside `app/about/actions.ts`, never with a `NEXT_PUBLIC_` prefix. Checked by the bundle grep criterion. |
| Duplicate `.field` rules or `@keyframes` when porting CSS | Step 1 lists the rules to skip. Check the login form visually before/after. |
| The template's `.contact-form textarea` styles depend on `.field input` styles already in `globals.css` | Port the textarea rules as-is and compare side by side with the reference. |

## What is **not** in this spec

- Auto-reply email, HTML/React Email templates, verified sending domain.
- Message persistence or an admin inbox.
- Persistent/distributed rate limiting or CAPTCHA.
- A public contact API endpoint.
- Authentication.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
