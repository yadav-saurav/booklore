import { describe, expect, it } from "vitest";
import { isBornOn, parseBirthDate } from "../../components/author/birthdate";

describe("parseBirthDate", () => {
  it("parses day-month-year text", () => {
    expect(parseBirthDate("22 August 1920")).toEqual({ year: 1920, month: 8, day: 22 });
    expect(parseBirthDate("22nd Aug. 1920")).toEqual({ year: 1920, month: 8, day: 22 });
  });

  it("parses month-day-year text", () => {
    expect(parseBirthDate("August 22, 1920")).toEqual({ year: 1920, month: 8, day: 22 });
    expect(parseBirthDate("Aug 22 1920")).toEqual({ year: 1920, month: 8, day: 22 });
  });

  it("parses ISO-like dates, including ones with a time", () => {
    expect(parseBirthDate("1920-08-22")).toEqual({ year: 1920, month: 8, day: 22 });
    expect(parseBirthDate("1920/8/22")).toEqual({ year: 1920, month: 8, day: 22 });
    expect(parseBirthDate("1920-08-22T00:00:00")).toEqual({ year: 1920, month: 8, day: 22 });
  });

  it("rejects year-only, month-only, approximate and impossible dates", () => {
    expect(parseBirthDate("1920")).toBeNull();
    expect(parseBirthDate("August 1920")).toBeNull();
    expect(parseBirthDate("circa 1850")).toBeNull();
    expect(parseBirthDate("February 30, 1900")).toBeNull();
    expect(parseBirthDate("1900-02-29")).toBeNull();
    expect(parseBirthDate("1904-02-29")).toEqual({ year: 1904, month: 2, day: 29 });
    expect(parseBirthDate("")).toBeNull();
    expect(parseBirthDate(null)).toBeNull();
  });

  it("matches the calendar day regardless of year", () => {
    expect(isBornOn("22 August 1920", 8, 22)).toBe(true);
    expect(isBornOn("1975-08-22", 8, 22)).toBe(true);
    expect(isBornOn("August 23, 1920", 8, 22)).toBe(false);
    expect(isBornOn("1920", 8, 22)).toBe(false);
  });
});
