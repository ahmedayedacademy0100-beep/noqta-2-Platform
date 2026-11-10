import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { assignedStudentIds } from "./assessments";
import { finalizeAttempt } from "./attempts";
import { autoGrade } from "./lib/grading";
import {
  isStudentAssigned,
  isTeacherOfClass,
  studentIdsForTeacher,
} from "./lib/guards";
import { bilingualPair, hasBilingualContent } from "./lib/bilingual";
import { normalizeWhatsapp } from "./lib/whatsapp";
import { normalizeQuestion, validateQuestion } from "./questionBank";
import type { QuestionSnapshot } from "./lib/grading";
import { ROLES } from "./schema";

/**
 * Server-side self-check.
 *
 * It runs against the demo dataset and exercises the rules that matter for
 * integrity: objective grading (including Arabic text normalization), class and
 * assessment scoping, snapshot/version consistency, auto-submit on expiry and
 * idempotent submission.
 *
 * Run with:  bunx convex run selfTest:run
 */

type CheckResult = { name: string; ok: boolean; detail?: string };

function snapshot(partial: Partial<QuestionSnapshot>): QuestionSnapshot {
  return {
    type: "mcq_single",
    promptEn: "prompt",
    promptAr: "سؤال",
    options: [],
    gradingMode: "auto",
    ...partial,
  } as QuestionSnapshot;
}

export const run = internalMutation({
  args: { verbose: v.optional(v.boolean()) },
  handler: async (ctx) => {
    const results: CheckResult[] = [];
    const check = (name: string, ok: boolean, detail?: string) => {
      results.push({ name, ok, detail });
    };
    const expect = (
      name: string,
      actual: unknown,
      expected: unknown,
    ) => {
      check(
        name,
        JSON.stringify(actual) === JSON.stringify(expected),
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    };

    /* ------------------------------ grading ------------------------------- */

    const single = snapshot({
      type: "mcq_single",
      options: [
        { key: "a", textEn: "a", textAr: "أ", correct: false },
        { key: "b", textEn: "b", textAr: "ب", correct: true },
      ],
    });
    expect(
      "grading: single choice correct earns full marks",
      autoGrade(single, 2, { selectedKeys: ["b"] }).awardedMarks,
      2,
    );
    expect(
      "grading: single choice wrong earns zero",
      autoGrade(single, 2, { selectedKeys: ["a"] }).awardedMarks,
      0,
    );
    expect(
      "grading: unanswered single choice is incorrect",
      autoGrade(single, 2, { selectedKeys: [] }).isCorrect,
      false,
    );

    const multi = snapshot({
      type: "mcq_multi",
      options: [
        { key: "a", textEn: "a", textAr: "أ", correct: true },
        { key: "b", textEn: "b", textAr: "ب", correct: true },
        { key: "c", textEn: "c", textAr: "ج", correct: true },
        { key: "d", textEn: "d", textAr: "د", correct: false },
      ],
    });
    expect(
      "grading: multiple choice awards partial credit",
      autoGrade(multi, 3, { selectedKeys: ["a"] }).awardedMarks,
      1,
    );
    expect(
      "grading: multiple choice full marks",
      autoGrade(multi, 3, { selectedKeys: ["a", "b", "c"] }).awardedMarks,
      3,
    );
    expect(
      "grading: multiple choice penalises wrong picks",
      autoGrade(multi, 3, { selectedKeys: ["a", "d"] }).awardedMarks,
      0,
    );

    const trueFalse = snapshot({
      type: "true_false",
      options: [
        { key: "true", textEn: "True", textAr: "صحيح", correct: true },
        { key: "false", textEn: "False", textAr: "خطأ", correct: false },
      ],
    });
    expect(
      "grading: true/false compares the boolean",
      autoGrade(trueFalse, 1, { selectedKeys: [], booleanAnswer: true }).awardedMarks,
      1,
    );
    expect(
      "grading: true/false wrong answer",
      autoGrade(trueFalse, 1, { selectedKeys: [], booleanAnswer: false }).awardedMarks,
      0,
    );

    // Questions written in the builder use ordinary a/b keys with True/False
    // labels; the marked option — not the key name — decides the answer.
    const letterKeyedTrueFalse = snapshot({
      type: "true_false",
      options: [
        { key: "a", textEn: "True", textAr: "صحيح", correct: true },
        { key: "b", textEn: "False", textAr: "خطأ", correct: false },
      ],
    });
    expect(
      "grading: labelled true/false honours the marked option",
      autoGrade(letterKeyedTrueFalse, 1, {
        selectedKeys: [],
        booleanAnswer: true,
      }).awardedMarks,
      1,
    );
    expect(
      "grading: labelled true/false rejects the unmarked answer",
      autoGrade(letterKeyedTrueFalse, 1, {
        selectedKeys: [],
        booleanAnswer: false,
      }).awardedMarks,
      0,
    );

    const fillBlank = snapshot({
      type: "fill_blank",
      acceptedAnswers: ["0.75", "0,75"],
      gradingMode: "auto",
    });
    expect(
      "grading: fill in the blank accepts the listed answer",
      autoGrade(fillBlank, 2, { selectedKeys: [], blanks: ["0,75"] }).awardedMarks,
      2,
    );
    const multiBlank = snapshot({
      type: "fill_blank",
      acceptedAnswers: ["1|١", "2|٢"],
      gradingMode: "auto",
    });
    expect(
      "grading: several blanks are graded positionally",
      autoGrade(multiBlank, 2, { selectedKeys: [], blanks: ["1", "2"] }).awardedMarks,
      2,
    );
    expect(
      "grading: several blanks award partial credit",
      autoGrade(multiBlank, 2, { selectedKeys: [], blanks: ["1", "9"] }).awardedMarks,
      1,
    );

    const shortAnswer = snapshot({
      type: "short_answer",
      acceptedAnswers: ["1/3", "١/٣"],
      gradingMode: "auto",
    });
    expect(
      "grading: Arabic-Indic digits normalize for short answers",
      autoGrade(shortAnswer, 1, { selectedKeys: [], text: "١/٣" }).awardedMarks,
      1,
    );
    expect(
      "grading: short answer with a typo scores zero",
      autoGrade(shortAnswer, 1, { selectedKeys: [], text: "1/4" }).awardedMarks,
      0,
    );

    const essay = snapshot({ type: "essay", options: [], gradingMode: "manual" });
    check(
      "grading: essays are sent to manual grading",
      autoGrade(essay, 4, { selectedKeys: [], text: "Because 3/4 of 1/2 is 3/8." })
        .needsManualGrading,
    );

    /* ---------------------------- demo fixtures --------------------------- */

    const profiles = await ctx.db.query("profiles").collect();
    const byEmail = (email: string) =>
      profiles.find((p) => p.email === email);
    const teacherMath = byEmail("sara@demo.noor.school");
    const teacherScience = byEmail("omar@demo.noor.school");
    const lina = byEmail("lina@demo.noor.school");
    const maryam = byEmail("maryam@demo.noor.school");
    const ali = byEmail("ali@demo.noor.school");

    // A production deployment ships *without* the demo dataset, so the
    // fixture-dependent checks are reported as skipped rather than failed:
    // nothing is claimed as verified when it could not run.
    const skipped: string[] = [];
    const stopWithSkips = (why: string) => {
      skipped.push(why);
      const failures = results.filter((r) => !r.ok);
      return {
        passed: results.length - failures.length,
        failed: failures.length,
        skipped,
        results,
      };
    };

    if (!teacherMath || !teacherScience || !lina || !maryam || !ali) {
      return stopWithSkips(
        "demo accounts are not present, so the class/assessment/contact checks were not run",
      );
    }

    const classes = await ctx.db.query("classes").collect();
    const classA = classes.find((c) => c.joinCode === "G8MATH");
    const classB = classes.find((c) => c.joinCode === "G7SCI");

    if (!classA || !classB) {
      return stopWithSkips("demo classes are not present, so the scoping checks were not run");
    }

    /* --------------------------- class scoping ---------------------------- */

    check(
      "authz: a teacher can access their own class",
      await isTeacherOfClass(ctx, teacherMath.userId, classA._id),
    );
    check(
      "authz: a teacher cannot access another teacher's class",
      (await isTeacherOfClass(ctx, teacherMath.userId, classB._id)) === false,
    );
    const mathStudents = await studentIdsForTeacher(ctx, teacherMath);
    check(
      "authz: teacher scope contains their own students",
      mathStudents.has(lina.userId as string),
    );
    check(
      "authz: teacher scope excludes other classes' students",
      mathStudents.has(ali.userId as string) === false,
    );

    /* ------------------------ assignment rules ---------------------------- */

    const assessments = await ctx.db.query("assessments").collect();
    const mathQuiz = assessments.find(
      (a) => a.titleEn === "Fractions checkpoint quiz",
    );
    const scienceQuiz = assessments.find(
      (a) => a.titleEn === "Cells and organisms quiz",
    );
    if (!mathQuiz || !scienceQuiz) {
      return stopWithSkips(
        "demo assessments are not present, so the assignment checks were not run",
      );
    }

    check(
      "assignment: an assigned student may access the assessment",
      await isStudentAssigned(ctx, mathQuiz._id, lina.userId),
    );
    check(
      "assignment: an unassigned student may not access the assessment (even by URL)",
      (await isStudentAssigned(ctx, mathQuiz._id, ali.userId)) === false,
    );
    check(
      "assignment: the science class sees the science quiz",
      await isStudentAssigned(ctx, scienceQuiz._id, ali.userId),
    );
    const assignedList = await assignedStudentIds(ctx, mathQuiz._id);
    check(
      "assignment: the class roster is expanded to students",
      assignedList.length === 3,
      `expected 3 assigned students, got ${assignedList.length}`,
    );

    /* ------------------------ snapshot consistency ------------------------ */

    const questions = await ctx.db
      .query("assessment_questions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", mathQuiz._id).eq("version", mathQuiz.version),
      )
      .collect();
    const expectedMax =
      Math.round(questions.reduce((sum, q) => sum + q.marks, 0) * 100) / 100;
    expect(
      "snapshot: stored max score equals the sum of question marks",
      mathQuiz.maxScore,
      expectedMax,
    );
    const gradedAttempt = await ctx.db
      .query("attempts")
      .withIndex("by_assessment_student", (q) =>
        q.eq("assessmentId", mathQuiz._id).eq("studentId", lina.userId),
      )
      .first();
    check("fixtures: the graded demo attempt exists", Boolean(gradedAttempt));
    if (gradedAttempt) {
      const answers = await ctx.db
        .query("attempt_answers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", gradedAttempt._id))
        .collect();
      const versionRows = await ctx.db
        .query("assessment_questions")
        .withIndex("by_assessment_version", (q) =>
          q
            .eq("assessmentId", mathQuiz._id)
            .eq("version", gradedAttempt.snapshotVersion),
        )
        .collect();
      const rowIds = new Set(versionRows.map((row) => row._id as string));
      check(
        "snapshot: every answer points at a question row of its own version",
        answers.every((a) => rowIds.has(a.assessmentQuestionId as string)),
      );
      check(
        "snapshot: released attempt keeps its recorded score",
        gradedAttempt.releasedAt !== undefined && gradedAttempt.score > 0,
        `score ${gradedAttempt.score}/${gradedAttempt.maxScore}`,
      );
      const records = await ctx.db
        .query("grading_records")
        .withIndex("by_attempt", (q) => q.eq("attemptId", gradedAttempt._id))
        .collect();
      check(
        "audit: the manual grade is recorded with its actor",
        records.some(
          (r) => r.kind === "manual_grade" && r.newMarks === 3 && r.actorId,
        ),
      );
    }

    /* ------------------- expiry auto-submit + idempotency ------------------ */

    const inProgress = await ctx.db
      .query("attempts")
      .withIndex("by_assessment_student", (q) =>
        q.eq("assessmentId", mathQuiz._id).eq("studentId", maryam.userId),
      )
      .first();

    if (!inProgress) {
      check("attempt: an in-progress demo attempt exists", false);
    } else {
      const before = await ctx.db
        .query("attempt_answers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", inProgress._id))
        .collect();
      await finalizeAttempt(ctx, inProgress._id, {
        auto: true,
        actor: null,
      });
      const after = await ctx.db.get(inProgress._id);
      // Submitting materialises one answer row per question (including the
      // blank ones), so the invariant is that a *second* submit adds nothing.
      const answersAfterFirstSubmit = await ctx.db
        .query("attempt_answers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", inProgress._id))
        .collect();
      check(
        "attempt: submitting records a row for every question",
        answersAfterFirstSubmit.length === 6,
        `${before.length} saved answers → ${answersAfterFirstSubmit.length} rows`,
      );
      check(
        "attempt: expiry auto-submits the attempt",
        after?.status === "graded" && after.autoSubmitted === true,
      );
      check(
        "attempt: objective answers are graded on submit",
        after !== null && after.score === 4,
        `expected 4/12 from two correct objective answers, got ${after?.score}`,
      );
      expect(
        "attempt: pass flag follows the pass threshold",
        after?.passed,
        false,
      );
      check(
        "release: immediate policy releases the marks",
        after?.releasedAt !== undefined,
      );
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", maryam.userId))
        .collect();
      check(
        "notifications: the student is told their result is out",
        notifications.some((n) => n.type === "result"),
      );

      const second = await finalizeAttempt(ctx, inProgress._id, {
        auto: false,
        actor: null,
      });
      const afterSecond = await ctx.db.get(inProgress._id);
      const answersAfter = await ctx.db
        .query("attempt_answers")
        .withIndex("by_attempt", (q) => q.eq("attemptId", inProgress._id))
        .collect();
      check(
        "idempotency: a duplicate submit returns the stored result",
        second.alreadySubmitted === true,
      );
      check(
        "idempotency: a duplicate submit does not change the score",
        afterSecond?.score === after?.score &&
          afterSecond?.submittedAt === after?.submittedAt,
      );
      check(
        "idempotency: a duplicate submit does not create extra answer rows",
        answersAfter.length === answersAfterFirstSubmit.length,
        `${answersAfterFirstSubmit.length} → ${answersAfter.length}`,
      );

      const audit = await ctx.db.query("audit_logs").collect();
      check(
        "audit: the automatic submission is logged",
        audit.some(
          (entry) =>
            entry.action === "attempt.auto_submit" &&
            entry.entityId === (inProgress._id as string),
        ),
      );
    }

    /* --------------------------- manual grading --------------------------- */

    const pendingAttempt = await ctx.db
      .query("attempts")
      .withIndex("by_assessment", (q) => q.eq("assessmentId", mathQuiz._id))
      .collect();
    const withPending = pendingAttempt.find((a) => a.pendingManualCount > 0);
    check(
      "grading: an essay submission stays pending until a teacher grades it",
      withPending !== undefined && withPending.status === "submitted",
    );
    const adminProfile = profiles.find((p) => p.role === ROLES.SUPER_ADMIN);
    check("authz: the demo platform has a super admin", adminProfile !== undefined);

    /* ------------------------ language-optional authoring ------------------ */

    // Teachers may write a question in *one* language; the other side is
    // mirrored so every reader sees the same wording.
    const arabicOnly = validateQuestion({
      type: "mcq_single",
      promptEn: "",
      promptAr: "ما ناتج ٣ × ٤؟",
      difficulty: "easy",
      defaultMarks: 1,
      options: [
        { key: "a", textEn: "", textAr: "١٢", correct: true },
        { key: "b", textEn: "", textAr: "٩", correct: false },
      ],
      gradingMode: "auto",
    });
    check("authoring: a question written only in Arabic is accepted", arabicOnly === null);

    const englishOnly = validateQuestion({
      type: "short_answer",
      promptEn: "Name the process plants use to make food.",
      promptAr: "",
      difficulty: "easy",
      defaultMarks: 1,
      options: [],
      acceptedAnswers: ["photosynthesis"],
      gradingMode: "auto",
    });
    check("authoring: a question written only in English is accepted", englishOnly === null);

    const emptyPrompt = validateQuestion({
      type: "essay",
      promptEn: "  ",
      promptAr: "",
      difficulty: "easy",
      defaultMarks: 1,
      options: [],
      gradingMode: "manual",
    });
    check("authoring: an empty prompt is still rejected", emptyPrompt === "promptRequired");

    // Guard for the inline composer: a choice option must carry text in the
    // language it was written in (true/false options are prefilled for this
    // reason), while an option left in the other language is fine.
    const blankOption = validateQuestion({
      type: "true_false",
      promptEn: "Water boils at 100 °C.",
      promptAr: "",
      difficulty: "easy",
      defaultMarks: 1,
      options: [
        { key: "a", textEn: "True", textAr: "", correct: true },
        { key: "b", textEn: "", textAr: "", correct: false },
      ],
      gradingMode: "auto",
    });
    check(
      "authoring: a choice option with no text is rejected",
      blankOption === "optionTextRequired",
    );
    const labelledTrueFalse = validateQuestion({
      type: "true_false",
      promptEn: "Water boils at 100 °C.",
      promptAr: "",
      difficulty: "easy",
      defaultMarks: 1,
      options: [
        { key: "a", textEn: "True", textAr: "", correct: true },
        { key: "b", textEn: "False", textAr: "", correct: false },
      ],
      gradingMode: "auto",
    });
    check(
      "authoring: a one-language true/false question is accepted",
      labelledTrueFalse === null,
    );

    const mirrored = normalizeQuestion({
      type: "mcq_single",
      promptEn: "",
      promptAr: "إلى كم قسم تنقسم الخلية؟",
      difficulty: "medium",
      defaultMarks: 2,
      options: [
        { key: "a", textEn: "", textAr: "قسمان", correct: true },
        { key: "b", textEn: "", textAr: "أربعة", correct: false },
      ],
      gradingMode: "auto",
    });
    expect(
      "authoring: the filled language is mirrored into the empty one",
      [mirrored.promptEn, mirrored.promptAr],
      ["إلى كم قسم تنقسم الخلية؟", "إلى كم قسم تنقسم الخلية؟"],
    );
    expect(
      "authoring: option text is mirrored the same way",
      [mirrored.options[0].textEn, mirrored.options[1].textAr],
      ["قسمان", "أربعة"],
    );
    expect(
      "authoring: both languages are preserved when supplied",
      bilingualPair("Cell", "خلية"),
      { en: "Cell", ar: "خلية" },
    );
    check(
      "authoring: a blank pair counts as empty content",
      hasBilingualContent("", "   ", 1) === false,
    );

    /* ---------------------- several questions per assessment --------------- */

    const mathRows = await ctx.db
      .query("assessment_questions")
      .withIndex("by_assessment_version", (q) =>
        q.eq("assessmentId", mathQuiz._id).eq("version", mathQuiz.version),
      )
      .collect();
    check(
      "assessment: one assessment holds several questions",
      mathRows.length > 1,
      `found ${mathRows.length}`,
    );
    check(
      "assessment: the stored total equals the sum of question marks",
      mathQuiz.maxScore ===
        Math.round(mathRows.reduce((sum, row) => sum + row.marks, 0) * 100) / 100,
    );
    check(
      "assessment: every question is snapshotted for version pinning",
      mathRows.every((row) => row.snapshot.promptEn.trim().length > 0),
    );

    /* ----------------------------- class contact --------------------------- */

    expect(
      "contact: a WhatsApp number keeps only its digits",
      normalizeWhatsapp("+20 100 000 0101"),
      "+201000000101",
    );
    expect("contact: a blank number clears the field", normalizeWhatsapp("  "), null);
    expect("contact: a too-short number is rejected", normalizeWhatsapp("12345"), null);
    expect(
      "contact: a number with letters is rejected",
      normalizeWhatsapp("call me maybe"),
      null,
    );
    check(
      "contact: every demo class carries its own contact number",
      Boolean(classA.whatsapp) && Boolean(classB.whatsapp),
    );
    check(
      "contact: two classes hold different numbers",
      classA.whatsapp !== classB.whatsapp,
    );

    // The student-facing query resolves a class number for an active enrolment.
    const linaEnrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_student", (q) => q.eq("studentId", lina.userId))
      .collect();
    const linaActiveClass = linaEnrollments.find((e) => e.status === "active");
    check(
      "contact: an enrolled student resolves a class with a number",
      linaActiveClass !== undefined &&
        (await ctx.db.get(linaActiveClass.classId))?.whatsapp !== undefined,
    );

    const failed = results.filter((r) => !r.ok);
    return {
      passed: results.length - failed.length,
      failed: failed.length,
      skipped,
      results,
    };
  },
});
