import { asc, desc, eq } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { revokeInvite } from "@/actions/invites";
import {
  InviteCreateForm,
  ResetPasswordButton,
  RevokeButton,
} from "@/components/invites/InviteManager";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "@/i18n/navigation";

// Module-scope so the current-time read isn't inside the component body.
function inviteStatus(
  usedBy: string | null,
  expiresAt: number,
): "used" | "expired" | "open" {
  if (usedBy) return "used";
  return expiresAt <= Date.now() ? "expired" : "open";
}

export default async function InvitesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect({ href: "/", locale: await getLocale() });
    return null;
  }

  const t = await getTranslations("invites");
  const format = await getFormatter();
  const rows = db
    .select({
      invite: invites,
      usedByName: users.displayName,
    })
    .from(invites)
    .leftJoin(users, eq(invites.usedBy, users.id))
    .orderBy(desc(invites.createdAt))
    .all();
  const allUsers = db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .orderBy(asc(users.displayName))
    .all();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("usersTitle")}</h2>
        <ul className="divide-y divide-line rounded-md border border-line bg-panel">
          {allUsers.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span>{u.displayName}</span>
                <span className="text-xs text-muted">
                  {u.email} · {u.role}
                </span>
              </div>
              <ResetPasswordButton userId={u.id} />
            </li>
          ))}
        </ul>
      </section>

      <InviteCreateForm />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("listTitle")}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-panel">
            {rows.map(({ invite, usedByName }) => {
              const status = inviteStatus(invite.usedBy, invite.expiresAt);
              return (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span>
                      {invite.email ?? t("anyEmail")}
                      {usedByName ? ` → ${usedByName}` : ""}
                    </span>
                    <span className="text-xs text-muted">
                      {t(`status.${status}`)}
                      {status === "open"
                        ? ` · ${t("expires", {
                            date: format.dateTime(new Date(invite.expiresAt), {
                              dateStyle: "medium",
                            }),
                          })}`
                        : ""}
                    </span>
                  </div>
                  {status === "open" ? (
                    <RevokeButton inviteId={invite.id} onRevoke={revokeInvite} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
