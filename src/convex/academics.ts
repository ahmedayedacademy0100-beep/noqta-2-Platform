import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  ERROR_CODES,
  assertClassAccess,
  classIdsForTeacher,
  deny,
  logAudit,
  requireProfile,
  requireRole,
  studentIdsForTeacher,
} from "./lib/guards";
import { normalizeWhatsapp } from "./lib/whatsapp";
import { generateJoinCodeValue } from "./profiles";
import { ROLES } from "./schema";

const STAFF = [ROLES.TEACHER, ROLES.SUPER_ADMIN] as const;

/* -------------------------------------------------------------------------- */
/* Structure                                                                  */
/* -------------------------------------------------------------------------- */

export const structure = query({
  args: {},
  handler: async (ctx) => {
    const { userId, profile } = await requireProfile(ctx);
    const [years, grades, subjects, topics] = await Promise.all([
      ctx.db.query("academic_years").collect(),
      ctx.db.query("grades").collect(),
      ctx.db.query("subjects").collect(),
      ctx.db.query("topics").collect(),
    ]);

    const allClasses = await ctx.db.query("classes").collect();
    let visibleClasses = allClasses.filter((c) => c.archivedAt === undefined);
    if (profile.role === ROLES.TEACHER) {
      const allowed = await classIdsForTeacher(ctx, userId);
      visibleClasses = visibleClasses.filter((c) => allowed.has(c._id as string));
    } else if (profile.role === ROLES.STUDENT) {
      const enrollments = await ctx.db
        .query("class_enrollments")
        .withIndex("by_student", (q) => q.eq("studentId", userId))
        .collect();
      const mine = new Set(
        enrollments
          .filter((e) => e.status === "active")
          .map((e) => e.classId as string),
      );
      visibleClasses = visibleClasses.filter((c) => mine.has(c._id as string));
    }

    const nameOfUser = async (id?: Id<"users">) => {
      if (!id) return undefined;
      const user = await ctx.db.get(id);
      return user?.name ?? user?.email ?? undefined;
    };

    const classes = await Promise.all(
      visibleClasses.map(async (cls) => {
        const enrollments = await ctx.db
          .query("class_enrollments")
          .withIndex("by_class", (q) => q.eq("classId", cls._id))
          .collect();
        const assignments = await ctx.db
          .query("teacher_assignments")
          .withIndex("by_class", (q) => q.eq("classId", cls._id))
          .collect();
        const grade = grades.find((g) => g._id === cls.gradeId);
        const subject = subjects.find((s) => s._id === cls.subjectId);
        return {
          _id: cls._id,
          nameEn: cls.nameEn,
          nameAr: cls.nameAr,
          joinCode: cls.joinCode,
          gradeId: cls.gradeId,
          gradeNameEn: grade?.nameEn,
          gradeNameAr: grade?.nameAr,
          subjectId: cls.subjectId,
          subjectNameEn: subject?.nameEn,
          subjectNameAr: subject?.nameAr,
          homeroomTeacherId: cls.homeroomTeacherId,
          homeroomTeacherName: await nameOfUser(cls.homeroomTeacherId),
          whatsapp: cls.whatsapp ?? "",
          studentCount: enrollments.filter((e) => e.status === "active").length,
          teacherNames: (
            await Promise.all(assignments.map((a) => nameOfUser(a.teacherId)))
          ).filter((n): n is string => Boolean(n)),
          academicYearId: cls.academicYearId,
        };
      }),
    );

    return {
      role: profile.role,
      years: years.sort((a, b) => b.startDate.localeCompare(a.startDate)),
      grades: grades.sort((a, b) => a.level - b.level),
      subjects: subjects.sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
      topics: topics.sort((a, b) => a.order - b.order),
      classes,
    };
  },
});

export const classDetail = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const { profile } = await requireProfile(ctx);
    await assertClassAccess(ctx, profile, args.classId);
    const enrollments = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    const students = await Promise.all(
      enrollments
        .filter((e) => e.status === "active")
        .map(async (e) => {
          const profileRow = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", e.studentId))
            .first();
          return {
            studentId: e.studentId,
            name: profileRow?.name ?? "—",
            email: profileRow?.email ?? "",
            isDemo: profileRow?.isDemo ?? false,
            points: profileRow?.points ?? 0,
          };
        }),
    );
    const assignmentRows = await ctx.db
      .query("teacher_assignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    const teachers = await Promise.all(
      assignmentRows.map(async (a) => {
        const subject = await ctx.db.get(a.subjectId);
        const user = await ctx.db.get(a.teacherId);
        return {
          assignmentId: a._id,
          teacherId: a.teacherId,
          teacherName: user?.name ?? user?.email ?? "—",
          subjectId: a.subjectId,
          subjectNameEn: subject?.nameEn ?? "—",
          subjectNameAr: subject?.nameAr ?? "—",
        };
      }),
    );
    return { students, teachers };
  },
});

/* -------------------------------------------------------------------------- */
/* Academic years, grades, subjects, topics                                   */
/* -------------------------------------------------------------------------- */

export const createAcademicYear = mutation({
  args: {
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    makeActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const name = args.name.trim();
    if (name.length < 4) {
      deny(ERROR_CODES.INVALID, "Enter a year name such as 2026–2027.", "أدخل اسم العام الدراسي مثل ٢٠٢٦–٢٠٢٧.");
    }
    const existing = await ctx.db.query("academic_years").collect();
    if (existing.some((y) => y.name === name)) {
      deny(ERROR_CODES.CONFLICT, "That academic year already exists.", "هذا العام الدراسي موجود بالفعل.");
    }
    if (args.makeActive) {
      for (const year of existing) {
        if (year.isActive) await ctx.db.patch(year._id, { isActive: false });
      }
    }
    const id = await ctx.db.insert("academic_years", {
      name,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: args.makeActive || existing.length === 0,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "academic_year.create",
      entity: "academic_years",
      entityId: id as string,
      summaryEn: `Created academic year ${name}.`,
      summaryAr: `تم إنشاء العام الدراسي ${name}.`,
    });
    return { id };
  },
});

export const setActiveYear = mutation({
  args: { yearId: v.id("academic_years") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const years = await ctx.db.query("academic_years").collect();
    for (const year of years) {
      const isActive = year._id === args.yearId;
      if (year.isActive !== isActive) {
        await ctx.db.patch(year._id, { isActive });
      }
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "academic_year.activate",
      entity: "academic_years",
      entityId: args.yearId as string,
      summaryEn: "Changed the active academic year.",
      summaryAr: "تم تغيير العام الدراسي النشط.",
    });
    return { ok: true };
  },
});

export const createGrade = mutation({
  args: {
    nameEn: v.string(),
    nameAr: v.string(),
    level: v.number(),
    academicYearId: v.id("academic_years"),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    if (!args.nameEn.trim()) {
      deny(ERROR_CODES.INVALID, "Grade name is required.", "اسم الصف مطلوب.");
    }
    const grades = await ctx.db
      .query("grades")
      .withIndex("by_year", (q) => q.eq("academicYearId", args.academicYearId))
      .collect();
    if (grades.some((g) => g.level === args.level)) {
      deny(ERROR_CODES.CONFLICT, "That grade level already exists for this year.", "هذا المستوى موجود بالفعل لهذا العام.");
    }
    const id = await ctx.db.insert("grades", {
      nameEn: args.nameEn.trim(),
      nameAr: args.nameAr.trim() || args.nameEn.trim(),
      level: args.level,
      academicYearId: args.academicYearId,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "grade.create",
      entity: "grades",
      entityId: id as string,
      summaryEn: `Created grade ${args.nameEn}.`,
      summaryAr: `تم إنشاء الصف ${args.nameAr || args.nameEn}.`,
    });
    return { id };
  },
});

export const createSubject = mutation({
  args: {
    nameEn: v.string(),
    nameAr: v.string(),
    code: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const code = args.code.trim().toUpperCase();
    if (!args.nameEn.trim() || code.length < 2) {
      deny(ERROR_CODES.INVALID, "Subject name and a 2+ character code are required.", "اسم المادة ورمز من حرفين على الأقل مطلوبان.");
    }
    const existing = await ctx.db
      .query("subjects")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) {
      deny(ERROR_CODES.CONFLICT, "A subject with that code already exists.", "توجد مادة بهذا الرمز بالفعل.");
    }
    const id = await ctx.db.insert("subjects", {
      nameEn: args.nameEn.trim(),
      nameAr: args.nameAr.trim() || args.nameEn.trim(),
      code,
      color: args.color ?? "#3b6ef6",
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "subject.create",
      entity: "subjects",
      entityId: id as string,
      summaryEn: `Created subject ${args.nameEn} (${code}).`,
      summaryAr: `تم إنشاء المادة ${args.nameAr || args.nameEn} (${code}).`,
    });
    return { id };
  },
});

export const createTopic = mutation({
  args: {
    subjectId: v.id("subjects"),
    gradeId: v.optional(v.id("grades")),
    nameEn: v.string(),
    nameAr: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    if (!args.nameEn.trim()) {
      deny(ERROR_CODES.INVALID, "Topic name is required.", "اسم الوحدة مطلوب.");
    }
    const siblings = await ctx.db
      .query("topics")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .collect();
    if (siblings.some((t) => t.nameEn.toLowerCase() === args.nameEn.trim().toLowerCase())) {
      deny(ERROR_CODES.CONFLICT, "That topic already exists for this subject.", "هذه الوحدة موجودة بالفعل لهذه المادة.");
    }
    const id = await ctx.db.insert("topics", {
      subjectId: args.subjectId,
      gradeId: args.gradeId,
      nameEn: args.nameEn.trim(),
      nameAr: args.nameAr.trim() || args.nameEn.trim(),
      order: siblings.length,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "topic.create",
      entity: "topics",
      entityId: id as string,
      summaryEn: `Created topic ${args.nameEn}.`,
      summaryAr: `تم إنشاء الوحدة ${args.nameAr || args.nameEn}.`,
    });
    return { id };
  },
});

/* -------------------------------------------------------------------------- */
/* Classes, enrolments, teacher assignments                                   */
/* -------------------------------------------------------------------------- */

export const createClass = mutation({
  args: {
    nameEn: v.string(),
    nameAr: v.string(),
    gradeId: v.id("grades"),
    academicYearId: v.id("academic_years"),
    subjectId: v.optional(v.id("subjects")),
    homeroomTeacherId: v.optional(v.id("users")),
    whatsapp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    if (!args.nameEn.trim()) {
      deny(ERROR_CODES.INVALID, "Class name is required.", "اسم الصف مطلوب.");
    }
    const whatsapp = normalizeWhatsapp(args.whatsapp ?? "");
    if (args.whatsapp?.trim() && !whatsapp) {
      deny(
        ERROR_CODES.INVALID,
        "Enter a WhatsApp number with 7–15 digits, including the country code.",
        "أدخل رقم واتساب من ٧ إلى ١٥ رقماً مع رمز الدولة.",
      );
    }
    if (profile.role === ROLES.TEACHER && args.homeroomTeacherId && args.homeroomTeacherId !== userId) {
      deny(ERROR_CODES.FORBIDDEN, "Teachers can only create their own classes.", "يمكن للمعلم إنشاء صفوفه فقط.");
    }
    const year = await ctx.db.get(args.academicYearId);
    if (!year) deny(ERROR_CODES.NOT_FOUND, "Academic year not found.", "لم يتم العثور على العام الدراسي.");
    const grade = await ctx.db.get(args.gradeId);
    if (!grade) deny(ERROR_CODES.NOT_FOUND, "Grade not found.", "لم يتم العثور على الصف الدراسي.");
    let joinCode = generateJoinCodeValue();
    while (
      await ctx.db
        .query("classes")
        .withIndex("by_join_code", (q) => q.eq("joinCode", joinCode))
        .first()
    ) {
      joinCode = generateJoinCodeValue();
    }
    const homeroomTeacherId =
      profile.role === ROLES.TEACHER ? userId : args.homeroomTeacherId;
    const id = await ctx.db.insert("classes", {
      nameEn: args.nameEn.trim(),
      nameAr: args.nameAr.trim() || args.nameEn.trim(),
      gradeId: args.gradeId,
      academicYearId: args.academicYearId,
      subjectId: args.subjectId,
      homeroomTeacherId,
      joinCode,
      whatsapp: whatsapp ?? undefined,
      createdAt: Date.now(),
    });
    if (homeroomTeacherId && args.subjectId) {
      await ctx.db.insert("teacher_assignments", {
        teacherId: homeroomTeacherId,
        classId: id,
        subjectId: args.subjectId,
        createdAt: Date.now(),
        createdBy: userId,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "class.create",
      entity: "classes",
      entityId: id as string,
      summaryEn: `Created class ${args.nameEn}.`,
      summaryAr: `تم إنشاء الصف ${args.nameAr || args.nameEn}.`,
    });
    return { id, joinCode };
  },
});

/**
 * The WhatsApp number a class's students can reach.
 *
 * Contact numbers are school policy, so only an administrator may set them
 * (teachers can create and run their own classes without changing this).
 */
export const setClassWhatsapp = mutation({
  args: { classId: v.id("classes"), whatsapp: v.string() },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const cls = await ctx.db.get(args.classId);
    if (!cls) {
      deny(ERROR_CODES.NOT_FOUND, "Class not found.", "لم يتم العثور على الصف.");
    }
    const normalized = normalizeWhatsapp(args.whatsapp);
    if (args.whatsapp.trim() && !normalized) {
      deny(
        ERROR_CODES.INVALID,
        "Enter a WhatsApp number with 7–15 digits, including the country code.",
        "أدخل رقم واتساب من ٧ إلى ١٥ رقماً مع رمز الدولة.",
      );
    }
    await ctx.db.patch(args.classId, { whatsapp: normalized ?? undefined });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: normalized ? "class.whatsapp_set" : "class.whatsapp_clear",
      entity: "classes",
      entityId: args.classId as string,
      summaryEn: normalized
        ? `Set the WhatsApp contact for ${cls.nameEn}.`
        : `Cleared the WhatsApp contact for ${cls.nameEn}.`,
      summaryAr: normalized
        ? `تم تعيين رقم واتساب لصف ${cls.nameAr}.`
        : `تم حذف رقم واتساب لصف ${cls.nameAr}.`,
    });
    return { ok: true, whatsapp: normalized };
  },
});

export const regenerateJoinCode = mutation({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireProfile(ctx);
    await assertClassAccess(ctx, profile, args.classId);
    let joinCode = generateJoinCodeValue();
    while (
      await ctx.db
        .query("classes")
        .withIndex("by_join_code", (q) => q.eq("joinCode", joinCode))
        .first()
    ) {
      joinCode = generateJoinCodeValue();
    }
    await ctx.db.patch(args.classId, { joinCode });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "class.rotate_join_code",
      entity: "classes",
      entityId: args.classId as string,
      summaryEn: "Rotated the class join code.",
      summaryAr: "تم تغيير رمز الانضمام للصف.",
    });
    return { joinCode };
  },
});

export const enrollStudent = mutation({
  args: { classId: v.id("classes"), studentId: v.id("users") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireProfile(ctx);
    await assertClassAccess(ctx, profile, args.classId);
    const studentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .first();
    if (!studentProfile || studentProfile.role !== ROLES.STUDENT) {
      deny(ERROR_CODES.INVALID, "That user is not a student.", "هذا المستخدم ليس طالباً.");
    }
    const existing = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", args.classId).eq("studentId", args.studentId),
      )
      .first();
    if (existing) {
      if (existing.status === "active") {
        deny(ERROR_CODES.CONFLICT, "The student is already enrolled.", "الطالب مسجل بالفعل في هذا الصف.");
      }
      await ctx.db.patch(existing._id, { status: "active", enrolledAt: Date.now() });
    } else {
      await ctx.db.insert("class_enrollments", {
        classId: args.classId,
        studentId: args.studentId,
        status: "active",
        enrolledAt: Date.now(),
        createdBy: userId,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "enrollment.add",
      entity: "class_enrollments",
      entityId: args.classId as string,
      summaryEn: `Enrolled ${studentProfile.name} in a class.`,
      summaryAr: `تم تسجيل ${studentProfile.name} في الصف.`,
      details: { studentId: args.studentId },
    });
    return { ok: true };
  },
});

export const removeStudentFromClass = mutation({
  args: { classId: v.id("classes"), studentId: v.id("users") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireProfile(ctx);
    await assertClassAccess(ctx, profile, args.classId);
    const existing = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", args.classId).eq("studentId", args.studentId),
      )
      .first();
    if (!existing) {
      deny(ERROR_CODES.NOT_FOUND, "Enrollment not found.", "لم يتم العثور على التسجيل.");
    }
    await ctx.db.patch(existing._id, { status: "removed" });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "enrollment.remove",
      entity: "class_enrollments",
      entityId: args.classId as string,
      summaryEn: "Removed a student from a class.",
      summaryAr: "تم إزالة طالب من الصف.",
      details: { studentId: args.studentId },
    });
    return { ok: true };
  },
});

export const transferStudent = mutation({
  args: {
    studentId: v.id("users"),
    fromClassId: v.id("classes"),
    toClassId: v.id("classes"),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    await assertClassAccess(ctx, profile, args.fromClassId);
    await assertClassAccess(ctx, profile, args.toClassId);
    if (args.fromClassId === args.toClassId) {
      deny(ERROR_CODES.INVALID, "Choose two different classes.", "اختر صفين مختلفين.");
    }
    const from = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", args.fromClassId).eq("studentId", args.studentId),
      )
      .first();
    if (from) await ctx.db.patch(from._id, { status: "removed" });
    const to = await ctx.db
      .query("class_enrollments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", args.toClassId).eq("studentId", args.studentId),
      )
      .first();
    if (to) {
      await ctx.db.patch(to._id, { status: "active", enrolledAt: Date.now() });
    } else {
      await ctx.db.insert("class_enrollments", {
        classId: args.toClassId,
        studentId: args.studentId,
        status: "active",
        enrolledAt: Date.now(),
        createdBy: userId,
      });
    }
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "enrollment.transfer",
      entity: "class_enrollments",
      entityId: args.toClassId as string,
      summaryEn: "Transferred a student between classes.",
      summaryAr: "تم نقل طالب بين صفين.",
      details: args,
    });
    return { ok: true };
  },
});

/**
 * Teacher picker used by the admin roster dialog.
 *
 * The roster only lists teachers who are *already* assigned to the class, so
 * the assign form had nothing to choose from. This returns every active
 * teacher account instead.
 */
export const teacherPicker = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const teachers = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", ROLES.TEACHER))
      .collect();
    return teachers
      .filter((row) => row.status === "active")
      .map((row) => ({
        userId: row.userId,
        name: row.name,
        email: row.email,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const assignTeacher = mutation({
  args: {
    teacherId: v.id("users"),
    classId: v.id("classes"),
    /** Falls back to the class's own subject when omitted. */
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const cls = await ctx.db.get(args.classId);
    if (!cls) {
      deny(ERROR_CODES.NOT_FOUND, "Class not found.", "لم يتم العثور على الصف.");
    }
    const teacherProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.teacherId))
      .first();
    if (!teacherProfile || teacherProfile.role !== ROLES.TEACHER) {
      deny(ERROR_CODES.INVALID, "That user is not a teacher.", "هذا المستخدم ليس معلماً.");
    }
    const subjectId = args.subjectId ?? cls.subjectId;
    if (!subjectId) {
      deny(
        ERROR_CODES.INVALID,
        "Pick a subject for this assignment.",
        "اختر مادة لهذا الإسناد.",
      );
    }
    const existing = await ctx.db
      .query("teacher_assignments")
      .withIndex("by_teacher_class_subject", (q) =>
        q
          .eq("teacherId", args.teacherId)
          .eq("classId", args.classId)
          .eq("subjectId", subjectId),
      )
      .first();
    if (existing) {
      deny(ERROR_CODES.CONFLICT, "That assignment already exists.", "هذا الإسناد موجود بالفعل.");
    }
    const id = await ctx.db.insert("teacher_assignments", {
      teacherId: args.teacherId,
      classId: args.classId,
      subjectId,
      createdAt: Date.now(),
      createdBy: userId,
    });
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "teacher.assign",
      entity: "teacher_assignments",
      entityId: id as string,
      summaryEn: `Assigned ${teacherProfile.name} to ${cls.nameEn}.`,
      summaryAr: `تم إسناد ${teacherProfile.name} إلى ${cls.nameAr}.`,
      details: { teacherId: args.teacherId, classId: args.classId, subjectId },
    });
    return { id };
  },
});

export const removeTeacherAssignment = mutation({
  args: { assignmentId: v.id("teacher_assignments") },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, [ROLES.SUPER_ADMIN]);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      deny(ERROR_CODES.NOT_FOUND, "Assignment not found.", "لم يتم العثور على الإسناد.");
    }
    await ctx.db.delete(args.assignmentId);
    await logAudit(ctx, {
      actor: { userId, name: profile.name, role: profile.role },
      action: "teacher.unassign",
      entity: "teacher_assignments",
      entityId: args.assignmentId as string,
      summaryEn: "Removed a teacher assignment.",
      summaryAr: "تم حذف إسناد معلم.",
    });
    return { ok: true };
  },
});

/* -------------------------------------------------------------------------- */
/* Teacher-facing student tools                                               */
/* -------------------------------------------------------------------------- */

export const myStudents = query({
  args: {
    search: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args) => {
    const { userId, profile } = await requireRole(ctx, STAFF);
    let classIds: string[];
    if (profile.role === ROLES.SUPER_ADMIN) {
      const classes = await ctx.db.query("classes").collect();
      classIds = classes.map((c) => c._id as string);
    } else {
      const allowed = await classIdsForTeacher(ctx, userId);
      classIds = [...allowed];
    }
    if (args.classId) {
      if (!classIds.includes(args.classId as string)) {
        deny(ERROR_CODES.FORBIDDEN, "You do not have access to this class.", "لا تملك صلاحية الوصول إلى هذا الصف.");
      }
      classIds = [args.classId as string];
    }
    const classRows = await Promise.all(
      classIds.map(async (id) => await ctx.db.get(id as Id<"classes">)),
    );
    const rows: {
      studentId: Id<"users">;
      name: string;
      email: string;
      isDemo: boolean;
      points: number;
      streak: number;
      classIds: Id<"classes">[];
      classNames: string[];
      averagePercent: number | null;
      attemptsCount: number;
    }[] = [];
    const seen = new Map<string, number>();
    const allowedStudentIds = await studentIdsForTeacher(ctx, profile);
    for (const cls of classRows) {
      if (!cls) continue;
      const enrollments = await ctx.db
        .query("class_enrollments")
        .withIndex("by_class", (q) => q.eq("classId", cls._id))
        .collect();
      for (const enrollment of enrollments) {
        if (enrollment.status !== "active") continue;
        // Defence in depth: never surface a student outside the caller's scope.
        if (!allowedStudentIds.has(enrollment.studentId as string)) continue;
        const profileRow = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", enrollment.studentId))
          .first();
        if (!profileRow) continue;
        if (seen.has(enrollment.studentId as string)) {
          const index = seen.get(enrollment.studentId as string)!;
          if (!rows[index].classIds.includes(cls._id)) {
            rows[index].classIds.push(cls._id);
            rows[index].classNames.push(cls.nameEn);
          }
          continue;
        }
        const attempts = await ctx.db
          .query("attempts")
          .withIndex("by_student", (q) => q.eq("studentId", enrollment.studentId))
          .collect();
        const graded = attempts.filter(
          (a) => a.status === "graded" || a.status === "submitted",
        );
        const average =
          graded.length === 0
            ? null
            : Math.round(
                (graded.reduce((sum, a) => sum + a.percentage, 0) / graded.length) *
                  100,
              ) / 100;
        seen.set(enrollment.studentId as string, rows.length);
        rows.push({
          studentId: enrollment.studentId,
          name: profileRow.name,
          email: profileRow.email,
          isDemo: profileRow.isDemo,
          points: profileRow.points,
          streak: profileRow.streak,
          classIds: [cls._id],
          classNames: [cls.nameEn],
          averagePercent: average,
          attemptsCount: attempts.length,
        });
      }
    }
    const search = args.search?.trim().toLowerCase();
    const filtered = search
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(search) ||
            r.email.toLowerCase().includes(search),
        )
      : rows;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const studentHistory = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, args) => {
    const { profile } = await requireRole(ctx, STAFF);
    const allowed = await studentIdsForTeacher(ctx, profile);
    if (!allowed.has(args.studentId as string)) {
      deny(
        ERROR_CODES.FORBIDDEN,
        "This student is not in your classes.",
        "هذا الطالب ليس في صفوفك.",
      );
    }
    const studentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .first();
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    const results = await Promise.all(
      attempts.map(async (attempt) => {
        const assessment = await ctx.db.get(attempt.assessmentId);
        const subject = assessment ? await ctx.db.get(assessment.subjectId) : null;
        return {
          attemptId: attempt._id,
          assessmentId: attempt.assessmentId,
          titleEn: assessment?.titleEn ?? "—",
          titleAr: assessment?.titleAr ?? "—",
          subjectNameEn: subject?.nameEn ?? "—",
          subjectNameAr: subject?.nameAr ?? "—",
          status: attempt.status,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          submittedAt: attempt.submittedAt,
          releasedAt: attempt.releasedAt,
          kind: assessment?.kind ?? "quiz",
        };
      }),
    );
    const achievements = await ctx.db
      .query("student_achievements")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();
    // Consent-safe: a teacher sees the history of the students they teach,
    // never other students' private scores.
    return {
      student: studentProfile
        ? {
            name: studentProfile.name,
            email: studentProfile.email,
            points: studentProfile.points,
            streak: studentProfile.streak,
            isDemo: studentProfile.isDemo,
          }
        : null,
      results: results.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0)),
      achievements,
    };
  },
});

/** Small helper used by admin screens: list of active students for pickers. */
export const studentPicker = query({
  args: { classId: v.optional(v.id("classes")) },
  handler: async (ctx, args) => {
    const { profile } = await requireRole(ctx, STAFF);
    if (args.classId) {
      await assertClassAccess(ctx, profile, args.classId);
      const enrollments = await ctx.db
        .query("class_enrollments")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
      const students = await Promise.all(
        enrollments
          .filter((e) => e.status === "active")
          .map(async (e) => {
            const row = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", e.studentId))
              .first();
            return row
              ? {
                  userId: row.userId,
                  name: row.name,
                  email: row.email,
                  classId: args.classId!,
                }
              : null;
          }),
      );
      return students.filter((s): s is NonNullable<typeof s> => s !== null);
    }
    try {
      const allowed = await studentIdsForTeacher(ctx, profile);
      const students = await Promise.all(
        [...allowed].map(async (id) => {
          const row = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", id as Id<"users">))
            .first();
          if (!row) return null;
          const enrollments = await ctx.db
            .query("class_enrollments")
            .withIndex("by_student", (q) => q.eq("studentId", row.userId))
            .collect();
          const active = enrollments.find((e) => e.status === "active");
          return {
            userId: row.userId,
            name: row.name,
            email: row.email,
            classId: active?.classId ?? null,
          };
        }),
      );
      return students
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      throw error;
    }
  },
});

export type ClassRow = Doc<"classes">;
