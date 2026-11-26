import { describe, expect, it } from "vitest";
import { activeChips, buildAdvancedQuery as build, chipRemoveNames, escapeLike, filtersToEntries, parseAdvanced, type AdvancedFilters } from "./advanced";

/** Same contract as tsQuery() in src/lib/search.ts (that module is server-only, so it is mirrored here). */
const tsQuery = (q: string) => {
  const terms = q.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[\p{L}\p{N}]+/gu);
  return terms?.length ? terms.slice(0, 8).map((t) => `${t}:*`).join(" & ") : null;
};
const buildAdvancedQuery = (f: AdvancedFilters, userId?: number | null) => build(f, userId, tsQuery);

/** Mirrors Next.js searchParams: repeated keys become arrays. */
const parse = (qs: string) => {
  const sp = new URLSearchParams(qs);
  const raw: Record<string, string | string[]> = {};
  for (const k of new Set(sp.keys())) {
    const all = sp.getAll(k);
    raw[k] = all.length > 1 ? all : all[0];
  }
  return parseAdvanced(raw);
};

describe("parseAdvanced", () => {
  it("defaults to popularity ascending, page 1, no filters", () => {
    const f = parse("");
    expect(f.sort).toBe("popularity");
    expect(f.dir).toBe("asc");
    expect(f.page).toBe(1);
    expect(f.genres).toEqual([]);
    expect(f.yearFrom).toBeNull();
  });

  it("ignores unknown sort keys and invalid directions", () => {
    const f = parse("sort=drop%20table&dir=sideways");
    expect(f.sort).toBe("popularity");
    expect(f.dir).toBe("asc");
  });

  it("uses the natural direction of a sort when dir is absent", () => {
    expect(parse("sort=rating").dir).toBe("desc");
    expect(parse("sort=title").dir).toBe("asc");
    expect(parse("sort=rating&dir=asc").dir).toBe("asc");
  });

  it("drops malformed numbers and clamps ranges", () => {
    const f = parse("yearFrom=abc&yearTo=99999&ratingMin=0&ratingMax=11&page=-4");
    expect(f.yearFrom).toBeNull();
    expect(f.yearTo).toBeNull();
    expect(f.ratingMin).toBeNull();
    expect(f.ratingMax).toBeNull();
    expect(f.page).toBe(1);
  });

  it("swaps reversed ranges", () => {
    const f = parse("yearFrom=2000&yearTo=1990&pagesMin=500&pagesMax=100&ratingMin=8&ratingMax=6");
    expect([f.yearFrom, f.yearTo]).toEqual([1990, 2000]);
    expect([f.pagesMin, f.pagesMax]).toEqual([100, 500]);
    expect([f.ratingMin, f.ratingMax]).toEqual([6, 8]);
  });

  it("keeps only well-formed genre slugs, de-duplicated and capped", () => {
    const qs = ["genre=fantasy", "genre=fantasy", "genre=Bad Slug", "genre=sci-fi", "genre=x';--"].join("&");
    expect(parse(qs).genres).toEqual(["fantasy", "sci-fi"]);
  });

  it("validates language codes and strips control characters from text", () => {
    expect(parse("lang=ENG").language).toBe("eng");
    expect(parse("lang=english%3B").language).toBe("");
    expect(parse("title=%20%00dune%20").title).toBe("dune");
  });

  it("only treats list and unrated as on when set to 1", () => {
    expect(parse("list=1&unrated=1").list).toBe(true);
    expect(parse("list=yes").list).toBe(false);
  });
});

describe("buildAdvancedQuery", () => {
  it("returns a tautology with no filters", () => {
    const q = buildAdvancedQuery(parse(""));
    expect(q.where).toBe("1 = 1");
    expect(q.params).toEqual([]);
  });

  it("never interpolates user text into SQL", () => {
    const hostile = "x'); DROP TABLE books; --";
    const q = buildAdvancedQuery(parse(`title=${encodeURIComponent(hostile)}&author=${encodeURIComponent(hostile)}`));
    expect(q.where).not.toContain("DROP");
    expect(q.where).not.toContain("x'");
    expect(q.params).toContain(`%${hostile}%`);
  });

  it("escapes LIKE wildcards in user text", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
    const q = buildAdvancedQuery(parse("title=100%25"));
    expect(q.params).toContain("%100\\%%");
  });

  it("adds one placeholder per parameter, in order", () => {
    const f = parse("title=dune&yearFrom=1960&yearTo=1990&ratingMin=7&votesMin=100&pagesMax=800&lang=eng&genre=sf&genre=epic");
    const q = buildAdvancedQuery(f);
    const placeholders = (q.where.match(/\?/g) ?? []).length;
    expect(placeholders).toBe(q.params.length);
    expect(q.params).toEqual(["%dune%", "%dune%", "sf", "epic", 1960, 1990, 7, 100, 800, "eng"]);
  });

  it("requires every selected genre (AND), each as its own EXISTS", () => {
    const q = buildAdvancedQuery(parse("genre=sf&genre=epic"));
    expect(q.where.match(/EXISTS \(SELECT 1 FROM book_genres/g)?.length).toBe(2);
  });

  it("uses the tsvector index for keywords and ignores keywords that tokenise to nothing", () => {
    expect(buildAdvancedQuery(parse("kw=%21%21%21")).where).toBe("1 = 1");
    const q = buildAdvancedQuery(parse("kw=Dune%20herb"));
    expect(q.where).toContain("s.doc @@ to_tsquery('simple', ?)");
    expect(q.params).toEqual(["dune:* & herb:*"]);
  });

  it("applies personal filters only when a user is known", () => {
    const f = parse("list=1&unrated=1");
    expect(buildAdvancedQuery(f, null).where).toBe("1 = 1");
    const q = buildAdvancedQuery(f, 42);
    expect(q.where).toContain("shelf s");
    expect(q.where).toContain("NOT EXISTS (SELECT 1 FROM ratings");
    expect(q.params).toEqual([42, 42]);
  });

  it("orders by whitelisted expressions with nulls last", () => {
    expect(buildAdvancedQuery(parse("sort=pages&dir=desc")).orderBy).toBe("b.pages DESC NULLS LAST, b.id ASC");
    expect(buildAdvancedQuery(parse("sort=year")).orderBy).toBe("b.first_publish_year DESC NULLS LAST, b.id ASC");
    expect(buildAdvancedQuery(parse("sort=title")).orderBy).toBe("lower(b.title) ASC NULLS LAST, b.id ASC");
    expect(buildAdvancedQuery(parse("sort=bogus; DROP")).orderBy).toContain("b.popularity_rank ASC NULLS LAST");
  });

  it("matches text case-insensitively with ILIKE", () => {
    const q = buildAdvancedQuery(parse("title=dune&author=herbert&subject=desert"));
    expect(q.where).toContain("b.title ILIKE ? ESCAPE");
    expect(q.where).toContain("a.name ILIKE ? ESCAPE");
    expect(q.where).toContain("b.subjects ILIKE ? ESCAPE");
    expect(q.where).not.toMatch(/[^I]LIKE/);
  });
});

describe("chips and links", () => {
  it("produces one chip per active filter and removal names", () => {
    const f = parse("title=dune&genre=sf&yearFrom=1960&yearTo=1990&lang=eng");
    const chips = activeChips(f, () => "Science fiction");
    expect(chips.map((c) => c.label)).toEqual([
      "Title: dune",
      "Genre: Science fiction",
      "Year: 1960–1990",
      "Language: eng",
    ]);
    expect(chipRemoveNames("yearFrom")).toEqual(["yearFrom", "yearTo"]);
    expect(chipRemoveNames("genre")).toEqual(["genre"]);
  });

  it("round-trips non-default filters through the entries list", () => {
    const f = parse("title=dune&genre=sf&sort=rating&page=3");
    const entries = filtersToEntries(f);
    expect(entries).toEqual(expect.arrayContaining([["title", "dune"], ["genre", "sf"], ["page", "3"]]));
    expect(parseAdvanced(Object.fromEntries(entries.map(([k, v]) => [k, v])))).toMatchObject({ title: "dune", sort: "rating", page: 3 });
  });
});
