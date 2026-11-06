import {
  DemoBadge,
  EmptyState,
  ErrorNotice,
  Field,
  LoadingBlock,
  PageHeader,
  RoleBadge,
  SectionCard,
  StatusBadge,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { describeError } from "@/lib/errors";
import { parseCsv } from "@/lib/format";
import { useAction, useMutation, useQuery } from "convex/react";
import { FileUp, Loader2, Plus, Search, UserCheck, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function AdminUsers() {
  const { t, pick, formatDate, lang } = useI18n();
  const structure = useQuery(api.academics.structure, {});
  const createManagedUser = useAction(api.accounts.createManagedUser);
  const setPassword = useAction(api.accounts.setPassword);
  const setUserRole = useMutation(api.admin.setUserRole);
  const setUserStatus = useMutation(api.admin.setUserStatus);
  const setUserLanguage = useMutation(api.admin.setUserLanguage);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const data = useQuery(api.admin.users, {
    search: search || undefined,
    role: role === "all" ? undefined : (role as never),
    status: status === "all" ? undefined : (status as never),
    page,
    pageSize: 20,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);

  const classes = structure?.classes ?? [];

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (message) toast.success(message);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("admin.users.title")}
        subtitle={t("admin.users.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Dialog open={openImport} onOpenChange={setOpenImport}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileUp className="size-4" aria-hidden />
                  {t("admin.users.import")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.users.import")}</DialogTitle>
                  <DialogDescription>{t("admin.users.import_hint")}</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const file = data.get("file");
                    if (!(file instanceof File)) return;
                    void run(async () => {
                      const parsed = parseCsv(await file.text());
                      const [header, ...body] = parsed;
                      const index = (name: string) =>
                        header.findIndex((cell) => cell.trim() === name);
                      let created = 0;
                      const failures: string[] = [];
                      for (const row of body) {
                        try {
                          await createManagedUser({
                            role: "student",
                            name: (row[index("name")] ?? "").trim(),
                            email: (row[index("email")] ?? "").trim(),
                            password: (row[index("password")] ?? "ChangeMe123!").trim(),
                            language: lang,
                            classId: (row[index("class_code")] ?? "").trim()
                              ? (classes.find(
                                  (cls) =>
                                    cls.joinCode.toUpperCase() ===
                                    (row[index("class_code")] ?? "").trim().toUpperCase(),
                                )?._id as never)
                              : undefined,
                          });
                          created += 1;
                        } catch {
                          failures.push((row[index("email")] ?? "").trim());
                        }
                      }
                      toast.success(
                        pick(
                          `${created} account(s) created, ${failures.length} skipped.`,
                          `تم إنشاء ${created} حساباً وتخطي ${failures.length}.`,
                        ),
                      );
                      setOpenImport(false);
                    });
                  }}
                >
                  <Field label="CSV" required>
                    <Input name="file" type="file" accept=".csv,text/csv" required />
                  </Field>
                  <DialogFooter>
                    <Button type="submit" disabled={busy}>
                      {t("admin.users.import")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" aria-hidden />
                  {t("admin.users.create")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("admin.users.create")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.users.temp_password_hint")}
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void run(async () => {
                      await createManagedUser({
                        role: (data.get("role") ?? "student") as never,
                        name: String(data.get("name") ?? "").trim(),
                        email: String(data.get("email") ?? "").trim(),
                        password: String(data.get("password") ?? ""),
                        language: (data.get("language") ?? lang) as never,
                        classId: (String(data.get("classId") ?? "") || undefined) as never,
                      });
                      setOpenCreate(false);
                    }, t("common.saved"));
                  }}
                >
                  <Field label={t("admin.users.role")} required>
                    <Select name="role" defaultValue="student">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">
                          {t("admin.users.create_student")}
                        </SelectItem>
                        <SelectItem value="teacher">
                          {t("admin.users.create_teacher")}
                        </SelectItem>
                        <SelectItem value="super_admin">
                          {t("roles.super_admin")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("common.name")} required>
                    <Input name="name" required minLength={2} />
                  </Field>
                  <Field label={t("common.email")} required>
                    <Input name="email" type="email" required />
                  </Field>
                  <Field
                    label={t("admin.users.temp_password")}
                    required
                    hint={t("admin.users.temp_password_hint")}
                  >
                    <Input name="password" type="text" minLength={8} required />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("admin.users.language")}>
                      <Select name="language" defaultValue={lang}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ar">العربية</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("admin.users.enroll_class")}>
                      <Select name="classId">
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.none")} />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls._id} value={cls._id}>
                              {pick(cls.nameEn, cls.nameAr)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={busy} className="gap-2">
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      {t("common.create")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {error ? <ErrorNotice error={error} /> : null}

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => {
                setPage(0);
                setSearch(event.target.value);
              }}
              placeholder={t("admin.users.search_placeholder")}
              className="ps-9"
            />
          </div>
          <Select
            value={role}
            onValueChange={(value) => {
              setPage(0);
              setRole(value);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("common.role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="student">{t("roles.student")}</SelectItem>
              <SelectItem value="teacher">{t("roles.teacher")}</SelectItem>
              <SelectItem value="super_admin">{t("roles.super_admin")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(0);
              setStatus(value);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("common.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="active">{t("status.active")}</SelectItem>
              <SelectItem value="suspended">{t("status.suspended")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {data === undefined ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title={t("admin.users.empty")} />
      ) : (
        <SectionCard
          title={t("admin.users.title")}
          description={t("common.showing", {
            count: rows.length,
            total: data.total,
          })}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="py-2 pe-3 text-start font-medium">{t("common.name")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.role")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.status")}</th>
                  <th className="py-2 pe-3 text-start font-medium">{t("common.classes")}</th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("admin.users.language")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("admin.audit.when")}
                  </th>
                  <th className="py-2 text-start font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b border-border/40">
                    <td className="py-3 pe-3">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        {row.isDemo ? <DemoBadge /> : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {row.email}
                      </span>
                    </td>
                    <td className="py-3 pe-3">
                      <Select
                        value={row.role}
                        onValueChange={(value) =>
                          void run(() =>
                            setUserRole({ userId: row.userId, role: value as never }),
                          )
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">{t("roles.student")}</SelectItem>
                          <SelectItem value="teacher">{t("roles.teacher")}</SelectItem>
                          <SelectItem value="super_admin">
                            {t("roles.super_admin")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pe-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {row.classNames.join(", ") || (row.teachingCount > 0 ? `${row.teachingCount} ${t("admin.classes")}` : "—")}
                    </td>
                    <td className="py-3 pe-3">
                      <Select
                        value={row.language}
                        onValueChange={(value) =>
                          void run(() =>
                            setUserLanguage({
                              userId: row.userId,
                              language: value as never,
                            }),
                          )
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="ar">العربية</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                setUserStatus({
                                  userId: row.userId,
                                  status:
                                    row.status === "active" ? "suspended" : "active",
                                }),
                              t("common.saved"),
                            )
                          }
                        >
                          {row.status === "active" ? (
                            <UserX className="size-3.5" aria-hidden />
                          ) : (
                            <UserCheck className="size-3.5" aria-hidden />
                          )}
                          {row.status === "active"
                            ? t("admin.users.suspend")
                            : t("admin.users.activate")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPasswordTarget(row.userId)}
                        >
                          {t("admin.users.reset_password")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            >
              {t("common.previous")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("common.page")} {page + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.hasMore}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </SectionCard>
      )}

      <Dialog
        open={passwordTarget !== null}
        onOpenChange={(open) => setPasswordTarget(open ? passwordTarget : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.users.reset_password")}</DialogTitle>
            <DialogDescription>{t("admin.users.temp_password_hint")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void run(async () => {
                await setPassword({
                  targetUserId: passwordTarget as never,
                  password: String(formData.get("password") ?? ""),
                });
                setPasswordTarget(null);
              }, t("common.saved"));
            }}
          >
            <Field label={t("admin.users.reset_password_new")} required>
              <Input name="password" type="text" minLength={8} required />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
          {error ? <ErrorNotice error={error} /> : null}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {describeError(null, t, lang) === t("error.title")
          ? pick(
              "Every role, status and password change is written to the audit log.",
              "كل تغيير في الدور أو الحالة أو كلمة المرور يُسجَّل في سجل التدقيق.",
            )
          : ""}
      </p>
    </>
  );
}
