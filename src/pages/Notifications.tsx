import {
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { BellRing, CheckCheck } from "lucide-react";
import { Link } from "react-router";

export default function NotificationsPage() {
  const { t, pick, formatDate } = useI18n();
  const data = useQuery(api.notifications.list, {});
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);

  return (
    <>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!data || data.unread === 0}
            onClick={() => markAllRead({})}
          >
            <CheckCheck className="size-4" aria-hidden />
            {t("notifications.mark_all")}
          </Button>
        }
      />

      {data === undefined ? (
        <LoadingBlock />
      ) : data.rows.length === 0 ? (
        <EmptyState title={t("notifications.empty")} icon={BellRing} />
      ) : (
        <ul className="space-y-2">
          {data.rows.map((row) => {
            const title = pick(row.titleEn, row.titleAr);
            const body = pick(row.bodyEn ?? "", row.bodyAr ?? "");
            const content = (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm",
                      row.readAt ? "text-muted-foreground" : "font-semibold",
                    )}
                  >
                    {title}
                  </p>
                  {body ? (
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatDate(row.createdAt, true)} · {t(`status.${row.type}`) === `status.${row.type}` ? row.type : t(`status.${row.type}`)}
                  </p>
                </div>
                {!row.readAt ? (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
            );
            return (
              <li key={row._id} className="surface">
                <div className="p-4">
                  {row.link ? (
                    <Link
                      to={row.link}
                      onClick={() => void markRead({ notificationId: row._id })}
                      className="block"
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data === undefined ? <ErrorNotice error={null} /> : null}
    </>
  );
}
