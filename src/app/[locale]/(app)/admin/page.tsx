import { asc, desc, eq } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { revokeInvite } from "@/actions/invites";
import {
  InviteCreateForm,
  ResetPasswordButton,
  RevokeButton,
} from "@/components/invites/InviteManager";
import { Avatar } from "@/components/ui/Avatar";
import {
  eyebrowClass,
  h1Class,
  h2Class,
  listClass,
} from "@/components/ui/classes";
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

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect({ href: "/", locale: await getLocale() });
    return null;
  }

  const t = await getTranslations("admin");
  const tInvites = await getTranslations("invites");
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
    <div className="flex max-w-3xl flex-col gap-10">
      <h1 className={h1Class}>{t("title")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className={h2Class}>{t("usersTitle")}</h2>
        <ul className={listClass}>
          {allUsers.map((u) => (
            <li key={u.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <Avatar name={u.displayName} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 font-bold">
                  <span className="truncate">{u.displayName}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role === "admin"
                        ? "bg-accent-soft text-accent-ink"
                        : "bg-faint text-muted"
                    }`}
                  >
                    {u.role}
                  </span>
                </span>
                <span className="truncate text-muted">{u.email}</span>
              </div>
              <ResetPasswordButton userId={u.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2Class}>{t("invitesTitle")}</h2>
        <InviteCreateForm />
        <h3 className={`${eyebrowClass} mt-2`}>{tInvites("listTitle")}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{tInvites("empty")}</p>
        ) : (
          <ul className={listClass}>
            {rows.map(({ invite, usedByName }) => {
              const status = inviteStatus(invite.usedBy, invite.expiresAt);
              return (
                <li
                  key={invite.id}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-semibold">
                      {invite.email ?? tInvites("anyEmail")}
                      {usedByName ? ` → ${usedByName}` : ""}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          status === "open"
                            ? "bg-accent-soft text-accent-ink"
                            : "bg-faint text-muted"
                        }`}
                      >
                        {tInvites(`status.${status}`)}
                      </span>
                      {status === "open"
                        ? tInvites("expires", {
                            date: format.dateTime(new Date(invite.expiresAt), {
                              dateStyle: "medium",
                            }),
                          })
                        : null}
                    </span>
                  </div>
                  <RevokeButton
                    inviteId={invite.id}
                    onRevoke={revokeInvite}
                    label={status === "open" ? undefined : tInvites("remove")}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
