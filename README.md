## Overview

This project uses the following tech stack:
- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager.

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.


# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:
```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.
- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.


## Landing Pages

You must always create good-looking designer-level styles to your application. 
- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.


### Other Items to animate
- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.


## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead. 

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.


## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```


## Common Convex Mistakes To Avoid

When using convex, make sure:
- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.

---

# Noqta | نُقطة — the product built on this template

A bilingual (Arabic/English) assessment and homework platform for middle-school
students aged 12–15, with three portals: **Student**, **Teacher** and **Super
Admin**. Everything below is implemented against the live Convex deployment in
this project — schema, authorization, grading, autosave, versioning and audit —
not mocked in the browser.

## Version 1 scope (the one flow that must work end to end)

1. A teacher builds a quiz from the question bank and publishes it.
2. Only assigned students can open it; the server enforces the deadline and the
   attempt limit.
3. A student answers (autosave + restore after refresh), submits, and objective
   questions are graded on the server.
4. The student sees their score; essays stay *pending* until a teacher grades
   them.
5. A teacher awards partial marks and feedback, releases the result, and sees
   analytics. An admin can see all of it and the audit trail.

Anything outside that path should be treated as beyond v1.

## Release 1.0 — what ships

**Authoring in one language.** Teachers are no longer forced to write a
question in both Arabic and English. A question (or assessment title or option)
needs *one* language and the server mirrors the filled side into the other
field (`src/convex/lib/bilingual.ts`), so the student runtime, analytics and
exports read the same wording in either language. Supplying both still works.

**Several questions per quiz, homework and exam.** The assessment builder has
two paths, both of which accept multiple questions at once:

- **Write a new question** — composes a question inline, writes it into the
title bank *and* attaches it to the current assessment in one mutation
  (`assessments.createAndAddQuestions`), and offers *Save and add another* so a
  whole worksheet can be typed without leaving the page.
- **From the question bank** — multi-selects existing questions, optionally from
  a shared bank.

**Floating WhatsApp contact, one number per class.** The contact number belongs
to the *class*, not to a teacher: in **Admin → Academics → Classes** an
administrator sets one number per class (e.g. the "Grade 7 – A" number, digits
plus country code) when creating the class or on the class row afterwards
(`academics.setClassWhatsapp`, stored on `classes.whatsapp`). Every student
enrolled in that class sees the same floating button, which opens the class
chat; the number is resolved by `student.myClassContact` from the student's
active enrolments. When a class has no number yet the button explains who to
ask instead of silently disappearing. Every set/clear is written to the audit
log.

**Motion and UI/UX.** Page transitions, staggered dashboard cards, hover lifts
on cards, animated answer-progress and question slides in the exam runtime, and
an animated navigation rail. All motion is suppressed by the existing
`prefers-reduced-motion` guard in `src/index.css`.

**No demo data ships.** This release was deployed with an *empty* database: all
sample accounts, classes, subjects, questions, assessments, attempts,
notifications and audit rows were deleted, and `demoDataLoaded` /
`demoAccountsEnabled` were reset to `false`. `/auth` therefore opens on the
Bootstrap panel and the first account created becomes the school's super admin;
the one-click demo sign-in panel and the public "load demo workspace" button are
gone from the sign-in page. The seeding actions
(`setup:seedDemoWorkspace`, `setup:loadDemoContent`) remain in the backend for
testing only — the first is an empty-deployment CLI tool that `selfTest:run`
needs, the second is an admin-only switch in **Settings**.

## Fresh install / demo sandbox

The live deployment has no users. To start a real school:

1. Open `/auth` and create the first account — it becomes the super admin.
2. In **Admin → Academics**, create the academic year, grades, subjects and
   classes (each class can carry its own WhatsApp number).
3. Create teachers in **Admin → Users**, then assign them to classes; create
   students with a class code or the CSV import.

To exercise the *fixture-dependent* half of the test suite instead, seed a dev
deployment first:

```bash
bunx convex run setup:seedDemoWorkspace   # only runs while the platform is empty
```

That loads a labelled demo dataset (1 admin, 2 teachers, 4 students, 2 classes,
a shared question bank and 3 assessments — `Fractions checkpoint quiz`,
`Algebra practice homework`, `Cells and organisms quiz`) and enables the
two-click sign-in panel on `/auth` (`Demo1234!` for every demo account, e.g.
`admin@demo.noor.school`, `sara@demo.noor.school`, `lina@demo.noor.school`).
Demo users are flagged `isDemo` and labelled everywhere; an administrator can
switch the sandbox off again in **Settings**.

There is no public marketing page: `/` redirects to `/dashboard` for signed-in
visitors and to `/auth` for everyone else, and `/auth` is the entry point (it
carries the sign-in, student registration and bootstrap panels).

### Inspecting

```bash
bunx convex run profiles:platformStatus      # counts + auth readiness
bunx convex run selfTest:run                 # server-side rule checks
```

## How to verify

```bash
bunx convex dev --once && bunx tsc -b --noEmit   # push functions + typecheck
bunx convex run selfTest:run                     # rule checks, 0 failures
```

`selfTest:run` (in `src/convex/selfTest.ts`) is the automated suite. It runs
against the deployed backend and asserts the rules that carry risk: objective
grading including Arabic answer normalization, class/assessment scoping, the
snapshot versioning guarantee, auto-submit on expiry, idempotent submission
(no duplicate answers or double scoring), essay → manual grading, result release
policy and audit logging — plus the 1.0 additions: accepting a question written
in either language (and mirroring it), rejecting an empty prompt, several
questions on one assessment with a total that matches the sum of their marks, a
choice option that carries no text being rejected, and the per-class WhatsApp
contact resolution.

On the shipped, empty deployment the suite reports **14 passed / 0 failed** and
lists one *skipped* reason: the class/assessment/contact checks need the demo
fixtures. Seed a dev deployment (`setup:seedDemoWorkspace`) to run the full
**58 checks, 0 failed**. Nothing is ever reported as passed when it was skipped.

## Where things live

| Area | Files |
| --- | --- |
| Schema + roles | `src/convex/schema.ts` |
| Auth/role guards | `src/convex/lib/guards.ts`, `src/convex/accounts.ts` |
| Assessment/question builder API | `src/convex/assessments.ts`, `src/convex/questionBank.ts` |
| Attempt engine (autosave, timer, submit, grading) | `src/convex/attempts.ts`, `src/convex/lib/grading.ts` |
| Immutable attempt snapshots | `src/convex/lib/snapshot.ts` |
| Student reads | `src/convex/student.ts` |
| Teacher reads/writes | `src/convex/teacher.ts` |
| Admin | `src/convex/admin.ts`, `src/convex/academics.ts` |
| Notifications/gamification | `src/convex/notifications.ts`, `src/convex/lib/notify.ts` |
| Expiry sweep | `src/convex/crons.ts` |
| i18n (EN/AR + RTL) | `src/i18n/dictionary.ts`, `src/i18n/index.tsx` |
| Theme tokens | `src/index.css` |
| Pages | `src/pages/{student,teacher,admin}/*`, `src/pages/*.tsx` |

## Integrity model

- `questions` / `question_banks` are the authoring side; `assessment_questions`
  hold a per-assessment copy (one assessment can carry many questions); each
  attempt stores a frozen `snapshot` of the question as
  it was shown, including options and marks. Editing a question later cannot
  change a past score.
- Attempts are created and submitted inside single mutations, so grading is
  transactional; `submit` is idempotent and returns the stored result.
- Deadlines use server timestamps. An expired in-progress attempt is finalized
  by `crons` (and by any read that notices it), never by trusting the client.
- Submitted answers are immutable outside the authorized reopen workflow, which
  writes an audit record.
- Browser controls are hardening, not prevention: randomization, policy
  settings, timing and audit records. No claim is made that a web exam can stop a
  determined student from cheating off-screen.

## Known limitations

- **Email:** sign-in codes go through the platform's OTP gateway and the
  password-reset path is *admin-sets-a-new-password* (`accounts.setPassword`).
  There is no outbound transactional email provider wired up, so
  assignment/deadline/result notifications are in-app only.
- **Charts and exports:** dashboards use real query data. CSV export writes a
  file in the browser; “PDF” export is the browser print dialog.
- **Tests** are server-side Convex checks (`selfTest:run`). There is no browser
  test runner in this template, so UI behaviour was verified by review and by the
  platform typecheck rather than by Playwright-style end-to-end tests.
- **CSV import** validates rows and reports per-row errors but is intentionally
  simple; very large imports should be chunked.
- Leaderboards are opt-in per platform settings and off by default, so
  individual scores stay private.
