import type { Language } from "@freelance/shared";
import type { UserContext } from "./generator";

export function signature(user: UserContext, language: Language): string {
  if (user.signature && user.signature.trim()) return user.signature.trim();
  const isEs = language === "es";
  const closing = isEs ? "Un saludo," : "Best regards,";
  const name = user.fullName || user.businessName || "";
  const site = user.website ? `\n${user.website}` : "";
  return name ? `${closing}\n${name}${site}` : closing;
}
