import {
  EmptyState,
  LoadingBlock,
  PageHeader,
  SectionCard,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { downloadCsv, toCsv } from "@/lib/format";
import { useQuery } from "convex/react";
import { Download, ScrollText } from "lucide-react";
import { useState } from "react";

export default function AdminAudit() {
  const { t, pick, formatDate } = useI18n();
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(0);
  const data = useQuery(api.admin.auditLogs, {
    action: action === "all" ? undefined : action,
    entity: entity === "all" ? undefined : entity,
    page,
    pageSize: 25,
  });

  if (data === undefined) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title={t("admin.audit.title")}
        subtitle={t("admin.audit.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  "audit-log.csv",
                  toCsv(
                    data.rows.map((row) => ({
                      created_at: new Date(row.createdAt).toISOString(),
                      actor: row.actorName ?? "system",
                      actor_role: row.actorRole ?? "",
                      action: row.action,
                      entity: row.entity,
                      entity_id: row.entityId ?? "",
                      summary_en: row.summaryEn,
                      summary_ar: row.summaryAr,
                      details: row.details ?? "",
                    })),
                  ),
                )
              }
            >
              <Download className="size-4" aria-hidden />
              {t("common.export")}
            </Button>
          </div>
        }
      />

      <SectionCard>
        <div className="flex flex-wrap gap-3">
          <Select
            value={action}
            onValueChange={(value) => {
              setPage(0);
              setAction(value);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("admin.audit.action")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {data.actions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={entity}
            onValueChange={(value) => {
              setPage(0);
              setEntity(value);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("admin.audit.entity")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {data.entities.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {data.rows.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} icon={ScrollText} />
      ) : (
        <SectionCard
          title={t("admin.audit.title")}
          description={t("common.showing", { count: data.rows.length, total: data.total })}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("admin.audit.when")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("admin.audit.actor")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("admin.audit.action")}
                  </th>
                  <th className="py-2 pe-3 text-start font-medium">
                    {t("admin.audit.entity")}
                  </th>
                  <th className="py-2 text-start font-medium">
                    {t("admin.audit.summary")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row._id} className="border-b border-border/40">
                    <td className="py-3 pe-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.createdAt, true)}
                    </td>
                    <td className="py-3 pe-3">
                      <span className="font-medium">{row.actorName ?? "system"}</span>
                      {row.actorRole ? (
                        <span className="block text-xs text-muted-foreground">
                          {t(`roles.${row.actorRole}`)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pe-3 font-mono text-xs">{row.action}</td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {row.entity}
                      {row.entityId ? (
                        <span className="block truncate font-mono text-[10px]">
                          {row.entityId}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3">{pick(row.summaryEn, row.summaryAr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
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

      <p className="text-xs text-muted-foreground">
        {pick(
          "The audit log is append-only: entries are never edited or removed from the interface.",
          "سجل التدقيق للإضافة فقط: لا يمكن تعديل القيود أو حذفها من الواجهة.",
        )}
      </p>
    </>
  );
}
