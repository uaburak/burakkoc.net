/**
 * A project's slug — its address, /projects/<slug>: lower-case Latin
 * letters, digits and hyphens only. A title's Turkish letters become their
 * Latin ones ("Şablon Çalışması" → "sablon-calismasi").
 */

const TURKISH: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u", â: "a", î: "i", û: "u" };

/** A title as a slug: Turkish letters made Latin, every other character a hyphen (one at a time, none at the ends). */
export function slugify(text: string): string {
  return text
    .replace(/[çğıİöşüÇĞÖŞÜâîû]/g, (c) => TURKISH[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** What a typed slug may hold — a-z, 0-9, hyphens; null when it is fine, else what is wrong with it. */
export function slugProblem(slug: string): string | null {
  if (!slug) return "Slug boş olamaz.";
  if (/[^a-z0-9-]/.test(slug)) return "Slug yalnızca küçük harf (a–z), rakam ve tire içerebilir — Türkçe karakter, boşluk ya da büyük harf olmaz.";
  if (/^-|-$/.test(slug)) return "Slug tire ile başlayamaz ya da bitemez.";
  if (/--/.test(slug)) return "Slug'da art arda iki tire olmaz.";
  return null;
}
