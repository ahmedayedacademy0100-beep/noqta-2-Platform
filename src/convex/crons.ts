import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Safety net for the timer: even if the student closes the tab (or loses the
// connection) exactly at the deadline, the attempt is submitted on the server.
crons.interval(
  "auto-submit expired attempts",
  { minutes: 5 },
  internal.attempts.autoSubmitExpired,
  {},
);

// "Release after the deadline" assessments publish their marks once closed.
crons.interval(
  "release attempts of closed assessments",
  { minutes: 10 },
  internal.attempts.releaseClosedAssessments,
  {},
);

export default crons;
