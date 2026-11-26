const LANGS: Record<string, string> = {
  eng: "English", en: "English", fre: "French", fra: "French", fr: "French", ger: "German", deu: "German", de: "German",
  spa: "Spanish", es: "Spanish", ita: "Italian", it: "Italian", jpn: "Japanese", ja: "Japanese", rus: "Russian", ru: "Russian",
  por: "Portuguese", pt: "Portuguese", chi: "Chinese", zho: "Chinese", zh: "Chinese", dut: "Dutch", nld: "Dutch", nl: "Dutch",
  swe: "Swedish", sv: "Swedish", pol: "Polish", pl: "Polish", kor: "Korean", ko: "Korean", ara: "Arabic", ar: "Arabic",
  heb: "Hebrew", he: "Hebrew", hin: "Hindi", hi: "Hindi", gre: "Greek", ell: "Greek", el: "Greek", tur: "Turkish", tr: "Turkish",
  nor: "Norwegian", no: "Norwegian", dan: "Danish", da: "Danish", fin: "Finnish", fi: "Finnish", lat: "Latin", la: "Latin",
};

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  const k = code.trim().toLowerCase();
  if (LANGS[k]) return LANGS[k];
  if (k.length > 3) return code; // already a name
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(k) ?? code;
  } catch {
    return code;
  }
}

/** "978-0-14-118776-1" style grouping is publisher-specific; use the common 3-1-… split for readability. */
export function fmtIsbn(isbn: string | null | undefined): string | null {
  if (!isbn) return null;
  const d = isbn.replace(/[^0-9X]/gi, "");
  return d.length === 13 ? `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9, 12)}-${d.slice(12)}` : isbn;
}

export const olWorkUrl = (key: string) => `https://openlibrary.org/works/${key}`;
export const googleIsbnUrl = (isbn: string) => `https://www.google.com/search?tbm=bks&q=isbn:${encodeURIComponent(isbn)}`;
export const googleTitleUrl = (title: string, author?: string | null) =>
  `https://www.google.com/search?tbm=bks&q=${encodeURIComponent([title, author].filter(Boolean).join(" "))}`;

export function lifeSpan(birth: string | null, death: string | null): string | null {
  const y = (s: string | null) => s?.match(/\d{4}/)?.[0] ?? null;
  const b = y(birth), d = y(death);
  if (b && d) return `${b}–${d}`;
  if (b) return `Born ${b}`;
  return null;
}
