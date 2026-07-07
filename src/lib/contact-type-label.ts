import type { ContactType } from "@/db/schema";

/**
 * Built-in types carry no name and resolve via the contactTypes i18n
 * namespace; custom types carry their own label.
 */
export function contactTypeLabel(
  type: Pick<ContactType, "id" | "name">,
  t: (key: string) => string,
): string {
  return type.name ?? t(type.id);
}
