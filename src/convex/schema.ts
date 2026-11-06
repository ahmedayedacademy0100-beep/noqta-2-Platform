import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

export const ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  SUPER_ADMIN: "super_admin",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.STUDENT),
  v.literal(ROLES.TEACHER),
  v.literal(ROLES.SUPER_ADMIN),
);
export type Role = Infer<typeof roleValidator>;

export const languageValidator = v.union(v.literal("en"), v.literal("ar"));
export type Language = Infer<typeof languageValidator>;

export const accountStatusValidator = v.union(
  v.literal("active"),
  v.literal("suspended"),
);

/* -------------------------------------------------------------------------- */
/* Assessments                                                                */
/* -------------------------------------------------------------------------- */

export const QUESTION_TYPES = {
  MCQ_SINGLE: "mcq_single",
  MCQ_MULTI: "mcq_multi",
  TRUE_FALSE: "true_false",
  SHORT_ANSWER: "short_answer",
  ESSAY: "essay",
  FILL_BLANK: "fill_blank",
  IMAGE: "image",
} as const;

export const questionTypeValidator = v.union(
  v.literal("mcq_single"),
  v.literal("mcq_multi"),
  v.literal("true_false"),
  v.literal("short_answer"),
  v.literal("essay"),
  v.literal("fill_blank"),
  v.literal("image"),
);
export type QuestionType = Infer<typeof questionTypeValidator>;

/** Types graded by the server without teacher input. */
export const AUTO_GRADED_TYPES: QuestionType[] = [
  "mcq_single",
  "mcq_multi",
  "true_false",
  "fill_blank",
  "image",
  "short_answer", // auto when an accepted answer list is provided, else manual
];

export const difficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

export const questionOptionValidator = v.object({
  key: v.string(),
  textEn: v.string(),
  textAr: v.string(),
  correct: v.boolean(),
});

/** A frozen copy of question content, embedded into an assessment. */
export const questionSnapshotValidator = v.object({
  type: questionTypeValidator,
  promptEn: v.string(),
  promptAr: v.string(),
  instructionsEn: v.optional(v.string()),
  instructionsAr: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  options: v.array(questionOptionValidator),
  acceptedAnswers: v.optional(v.array(v.string())),
  gradingMode: v.union(v.literal("auto"), v.literal("manual")),
  topicId: v.optional(v.id("topics")),
  topicLabelEn: v.optional(v.string()),
  topicLabelAr: v.optional(v.string()),
  feedbackEn: v.optional(v.string()),
  feedbackAr: v.optional(v.string()),
  difficulty: v.optional(difficultyValidator),
});

export const assessmentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("published"),
  v.literal("closed"),
  v.literal("archived"),
);

export const assessmentKindValidator = v.union(
  v.literal("quiz"),
  v.literal("exam"),
  v.literal("homework"),
);

export const releasePolicyValidator = v.union(
  v.literal("immediate"),
  v.literal("manual"),
  v.literal("on_close"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // mirrors profiles.role for template compatibility
    }).index("email", ["email"]), // index for the email. do not remove or modify

    /* ------------------------------- profiles ------------------------------ */
    profiles: defineTable({
      userId: v.id("users"),
      name: v.string(),
      email: v.string(),
      role: roleValidator,
      status: accountStatusValidator,
      language: languageValidator,
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
      isDemo: v.boolean(),
      points: v.number(),
      streak: v.number(),
      lastActiveDay: v.optional(v.string()), // YYYY-MM-DD
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_role", ["role"])
      .index("by_email", ["email"]),

    /* --------------------------- platform settings ------------------------- */
    platform_settings: defineTable({
      schoolNameEn: v.string(),
      schoolNameAr: v.string(),
      logoUrl: v.optional(v.string()),
      /** Uploaded logo stored in Convex file storage (takes precedence). */
      logoStorageId: v.optional(v.id("_storage")),
      taglineEn: v.optional(v.string()),
      taglineAr: v.optional(v.string()),
      /** Hex colors used for the brand gradient (e.g. #4169ff). */
      brandPrimary: v.optional(v.string()),
      brandAccent: v.optional(v.string()),
      /** Best-effort copy / screenshot deterrence for students and teachers. */
      contentProtectionEnabled: v.optional(v.boolean()),
      defaultLanguage: languageValidator,
      gradingScale: v.array(
        v.object({
          letter: v.string(),
          minPercent: v.number(),
          labelEn: v.string(),
          labelAr: v.string(),
        }),
      ),
      defaultPassThreshold: v.number(),
      defaultDurationMinutes: v.number(),
      gamificationEnabled: v.boolean(),
      leaderboardsEnabled: v.boolean(),
      notificationsEnabled: v.boolean(),
      demoDataLoaded: v.boolean(),
      demoAccountsEnabled: v.boolean(),
      /* Google AdSense — fully controlled by the super admin. */
      adsEnabled: v.optional(v.boolean()),
      adsensePublisherId: v.optional(v.string()),
      adsenseSlotId: v.optional(v.string()),
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }),

    /* --------------------------- academic structure ------------------------ */
    academic_years: defineTable({
      name: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_active", ["isActive"]),

    grades: defineTable({
      nameEn: v.string(),
      nameAr: v.string(),
      level: v.number(),
      academicYearId: v.id("academic_years"),
      createdAt: v.number(),
    }).index("by_year", ["academicYearId"]),

    subjects: defineTable({
      nameEn: v.string(),
      nameAr: v.string(),
      code: v.string(),
      color: v.string(),
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    topics: defineTable({
      subjectId: v.id("subjects"),
      gradeId: v.optional(v.id("grades")),
      nameEn: v.string(),
      nameAr: v.string(),
      order: v.number(),
      createdAt: v.number(),
    }).index("by_subject", ["subjectId"]),

    classes: defineTable({
      nameEn: v.string(),
      nameAr: v.string(),
      gradeId: v.id("grades"),
      academicYearId: v.id("academic_years"),
      subjectId: v.optional(v.id("subjects")),
      homeroomTeacherId: v.optional(v.id("users")),
      joinCode: v.string(),
      /** Contact number for this class, in international form
       *  (e.g. +201234567890). Set by an administrator; students in the class
       *  get a button that opens that WhatsApp chat. */
      whatsapp: v.optional(v.string()),
      createdAt: v.number(),
      archivedAt: v.optional(v.number()),
    })
      .index("by_year", ["academicYearId"])
      .index("by_grade", ["gradeId"])
      .index("by_join_code", ["joinCode"])
      .index("by_teacher", ["homeroomTeacherId"]),

    class_enrollments: defineTable({
      classId: v.id("classes"),
      studentId: v.id("users"),
      status: v.union(v.literal("active"), v.literal("removed")),
      enrolledAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_class", ["classId"])
      .index("by_student", ["studentId"])
      .index("by_class_student", ["classId", "studentId"]),

    teacher_assignments: defineTable({
      teacherId: v.id("users"),
      classId: v.id("classes"),
      subjectId: v.id("subjects"),
      createdAt: v.number(),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_teacher", ["teacherId"])
      .index("by_class", ["classId"])
      .index("by_teacher_class_subject", ["teacherId", "classId", "subjectId"]),

    /* ----------------------------- question bank --------------------------- */
    question_banks: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      visibility: v.union(v.literal("private"), v.literal("shared")),
      subjectId: v.optional(v.id("subjects")),
      createdAt: v.number(),
      archivedAt: v.optional(v.number()),
    })
      .index("by_owner", ["ownerId"])
      .index("by_visibility", ["visibility"]),

    questions: defineTable({
      bankId: v.id("question_banks"),
      ownerId: v.id("users"),
      type: questionTypeValidator,
      promptEn: v.string(),
      promptAr: v.string(),
      instructionsEn: v.optional(v.string()),
      instructionsAr: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      subjectId: v.optional(v.id("subjects")),
      topicId: v.optional(v.id("topics")),
      difficulty: difficultyValidator,
      defaultMarks: v.number(),
      options: v.array(questionOptionValidator),
      acceptedAnswers: v.optional(v.array(v.string())),
      gradingMode: v.union(v.literal("auto"), v.literal("manual")),
      feedbackEn: v.optional(v.string()),
      feedbackAr: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: v.optional(v.number()),
    })
      .index("by_bank", ["bankId"])
      .index("by_owner", ["ownerId"])
      .index("by_subject", ["subjectId"]),

    /* ------------------------------ assessments ---------------------------- */
    assessments: defineTable({
      ownerId: v.id("users"),
      kind: assessmentKindValidator,
      titleEn: v.string(),
      titleAr: v.string(),
      instructionsEn: v.optional(v.string()),
      instructionsAr: v.optional(v.string()),
      subjectId: v.id("subjects"),
      topicId: v.optional(v.id("topics")),
      status: assessmentStatusValidator,
      openAt: v.optional(v.number()),
      closeAt: v.optional(v.number()),
      durationMinutes: v.number(),
      attemptsAllowed: v.number(),
      passThreshold: v.number(),
      shuffleQuestions: v.boolean(),
      shuffleOptions: v.boolean(),
      allowLate: v.boolean(),
      releasePolicy: releasePolicyValidator,
      showAnswersToStudents: v.boolean(),
      maxScore: v.number(),
      version: v.number(),
      publishedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      resultsReleasedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: v.optional(v.number()),
    })
      .index("by_owner", ["ownerId"])
      .index("by_status", ["status"])
      .index("by_subject", ["subjectId"]),

    assessment_questions: defineTable({
      assessmentId: v.id("assessments"),
      questionId: v.optional(v.id("questions")),
      order: v.number(),
      marks: v.number(),
      /** Content version this row belongs to; attempts pin their version. */
      version: v.number(),
      snapshot: questionSnapshotValidator,
    })
      .index("by_assessment", ["assessmentId"])
      .index("by_assessment_version", ["assessmentId", "version"])
      .index("by_question", ["questionId"]),

    assessment_assignments: defineTable({
      assessmentId: v.id("assessments"),
      classId: v.id("classes"),
      assignedBy: v.id("users"),
      assignedAt: v.number(),
    })
      .index("by_assessment", ["assessmentId"])
      .index("by_class", ["classId"]),

    assessment_students: defineTable({
      assessmentId: v.id("assessments"),
      studentId: v.id("users"),
      source: v.union(v.literal("class"), v.literal("individual")),
      assignedBy: v.id("users"),
      assignedAt: v.number(),
    })
      .index("by_assessment", ["assessmentId"])
      .index("by_student", ["studentId"])
      .index("by_assessment_student", ["assessmentId", "studentId"]),

    /* -------------------------------- attempts ----------------------------- */
    attempts: defineTable({
      assessmentId: v.id("assessments"),
      studentId: v.id("users"),
      attemptNumber: v.number(),
      status: v.union(
        v.literal("in_progress"),
        v.literal("submitted"),
        v.literal("graded"),
        v.literal("expired"),
      ),
      startedAt: v.number(),
      expiresAt: v.number(),
      submittedAt: v.optional(v.number()),
      autoSubmitted: v.boolean(),
      score: v.number(),
      maxScore: v.number(),
      percentage: v.number(),
      passed: v.optional(v.boolean()),
      pendingManualCount: v.number(),
      gradedAt: v.optional(v.number()),
      gradedBy: v.optional(v.id("users")),
      releasedAt: v.optional(v.number()),
      snapshotVersion: v.number(),
      lastSavedAt: v.number(),
    })
      .index("by_assessment", ["assessmentId"])
      .index("by_student", ["studentId"])
      .index("by_assessment_student", ["assessmentId", "studentId"])
      .index("by_status", ["status"]),

    attempt_answers: defineTable({
      attemptId: v.id("attempts"),
      assessmentQuestionId: v.id("assessment_questions"),
      questionId: v.optional(v.id("questions")),
      response: v.object({
        selectedKeys: v.array(v.string()),
        text: v.optional(v.string()),
        blanks: v.optional(v.array(v.string())),
        booleanAnswer: v.optional(v.boolean()),
      }),
      flagged: v.boolean(),
      maxMarks: v.number(),
      awardedMarks: v.optional(v.number()),
      isCorrect: v.optional(v.boolean()),
      autoGraded: v.boolean(),
      needsManualGrading: v.boolean(),
      feedback: v.optional(v.string()),
      gradedAt: v.optional(v.number()),
      gradedBy: v.optional(v.id("users")),
      updatedAt: v.number(),
    })
      .index("by_attempt", ["attemptId"])
      .index("by_attempt_question", ["attemptId", "assessmentQuestionId"])
      .index("by_question", ["assessmentQuestionId"]),

    grading_records: defineTable({
      attemptId: v.id("attempts"),
      answerId: v.optional(v.id("attempt_answers")),
      actorId: v.optional(v.id("users")),
      kind: v.union(
        v.literal("auto_grade"),
        v.literal("manual_grade"),
        v.literal("correction"),
        v.literal("release"),
        v.literal("reopen"),
      ),
      previousMarks: v.optional(v.number()),
      newMarks: v.optional(v.number()),
      reason: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_attempt", ["attemptId"])
      .index("by_actor", ["actorId"]),

    /* ----------------------------- notifications --------------------------- */
    notifications: defineTable({
      userId: v.id("users"),
      type: v.union(
        v.literal("assignment"),
        v.literal("deadline"),
        v.literal("result"),
        v.literal("feedback"),
        v.literal("schedule"),
        v.literal("announcement"),
      ),
      titleEn: v.string(),
      titleAr: v.string(),
      bodyEn: v.optional(v.string()),
      bodyAr: v.optional(v.string()),
      link: v.optional(v.string()),
      readAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_read", ["userId", "readAt"]),

    /* ------------------------------ gamification --------------------------- */
    achievements: defineTable({
      code: v.string(),
      titleEn: v.string(),
      titleAr: v.string(),
      descriptionEn: v.string(),
      descriptionAr: v.string(),
      icon: v.string(),
      points: v.number(),
      active: v.boolean(),
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    student_achievements: defineTable({
      studentId: v.id("users"),
      achievementCode: v.string(),
      earnedAt: v.number(),
      meta: v.optional(v.string()),
    })
      .index("by_student", ["studentId"])
      .index("by_student_code", ["studentId", "achievementCode"]),

    /* -------------------------------- audit -------------------------------- */
    audit_logs: defineTable({
      actorId: v.optional(v.id("users")),
      actorName: v.optional(v.string()),
      actorRole: v.optional(roleValidator),
      action: v.string(),
      entity: v.string(),
      entityId: v.optional(v.string()),
      summaryEn: v.string(),
      summaryAr: v.string(),
      details: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_created", ["createdAt"])
      .index("by_actor", ["actorId"])
      .index("by_entity", ["entity", "entityId"]),

    /* ------------------------------- invites ------------------------------- */
    invite_codes: defineTable({
      code: v.string(),
      role: v.union(v.literal("student"), v.literal("teacher")),
      classId: v.optional(v.id("classes")),
      createdBy: v.id("users"),
      maxUses: v.number(),
      uses: v.number(),
      revoked: v.boolean(),
      createdAt: v.number(),
    }).index("by_code", ["code"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
