"use client";

import "./shelf.css";
import Link from "next/link";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ShelfBook } from "@/lib/queries/home";
import { coverSrc } from "@/lib/covers";
import { compact } from "@/lib/util";
import { GeneratedCover } from "@/components/book/GeneratedCover";
import { setShelf } from "@/app/actions/engagement";
import { useAuthAction } from "@/components/book/useAuthAction";
import { SpineArt } from "./SpineArt";

/**
 * Curved archive shelf. Books stand on an arc that recedes into depth; the centre book turns 90° to show
 * its cover. One requestAnimationFrame loop drives geometry, spring, tilt, timeline dot and cursor; caption
 * swaps and the detail sheet use the Web Animations API. All reveals are mask slides, clips or scales.
 *
 * WHEEL POLICY (page must stay scrollable):
 *  - Horizontal-dominant deltas (trackpad swipes, shift+wheel) always scrub the shelf while over the hero.
 *  - Vertical wheel scrubs only while the pointer is over the shelf band AND the hero is fully in view
 *    (page scrolled to the top). Anywhere else in the hero (kanji, caption, timeline, footer) a vertical
 *    wheel scrolls the page, and the "Scroll / 続き" control in the footer jumps to the content. Because
 *    the band never covers the whole hero, a user is never trapped. Touch: vertical swipes scroll natively
 *    (touch-action: pan-y); horizontal drags scrub.
 */

const COPIES = 3;
const P = 1400;
const EASE = "cubic-bezier(.2,.8,.2,1)";
const SHEET_EASE = "cubic-bezier(.76,0,.18,1)";
const PW = 600; // detail poster viewBox (2:3)
const PH = 900;
const R_MAX = 760;
// Spec circles were laid out for a 474×900 poster: scale x to the 600-wide 2:3 poster.
const CIRCLES: [number, number, number][] = (
  [[150, 330, 0], [340, 600, 120], [250, 120, 220], [90, 760, 300], [400, 250, 360], [260, 860, 420], [230, 470, 180]] as const
).map(([x, y, d]) => [(x * PW) / 474, y, d]);

const mod = (a: number, n: number) => ((a % n) + n) % n;
const smooth = (x: number) => x * x * (3 - 2 * x);
const fitFor = (title: string) => Math.max(0.6, Math.min(1, 20 / Math.max(1, title.length)));

type Status = "want" | "reading" | "read" | null;

function Cover({ book, failed, onFail }: { book: ShelfBook; failed: boolean; onFail: (id: string) => void }) {
  const src = coverSrc(book, "L");
  if (!src || failed) return <GeneratedCover id={book.id} title={book.title} author={book.authorName} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      onError={() => onFail(book.id)}
      onLoad={(e) => { if (e.currentTarget.naturalWidth < 5) onFail(book.id); }}
    />
  );
}

function ShelfToggle({ bookId, status }: { bookId: string; status: Status }) {
  const [local, setLocal] = useState<Status>(status);
  const { run, pending } = useAuthAction();
  const on = local !== null;
  return (
    <button
      type="button"
      className="sh-d-btn lbl"
      data-on={on ? "1" : "0"}
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        const next: Status = on ? null : "want";
        setLocal(next);
        run(() => setShelf(bookId, next));
      }}
    >
      <span>{on ? (local === "want" ? "✓ Want to read" : local === "reading" ? "✓ Reading" : "✓ Read") : "+ Want to read"}</span>
      <span>読みたい</span>
    </button>
  );
}

export function ShelfHero({ books, statuses }: { books: ShelfBook[]; statuses: Record<string, string> }) {
  const N = books.length;
  const TOTAL = N * COPIES;
  const startIdx = Math.floor((N - 1) / 2);

  const heroRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tapeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dotRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const circleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const api = useRef<{ step: (d: number) => void; open: () => void; close: () => void; jumpYear: (x: number) => void } | null>(null);

  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [openIdx, setOpenIdx] = useState(startIdx);
  const onFail = useCallback((id: string) => setFailed((s) => (s.has(id) ? s : new Set(s).add(id))), []);

  // Timeline ruler
  const tl = useMemo(() => {
    const ys = books.map((b) => b.year);
    const y0 = Math.floor(Math.min(...ys) / 10) * 10;
    let y1 = Math.ceil(Math.max(...ys) / 10) * 10;
    if (y1 <= y0) y1 = y0 + 10;
    const span = y1 - y0;
    const major = span <= 80 ? 10 : 25;
    const minor = span <= 60 ? 1 : span <= 120 ? 2 : 5;
    const ticks: { y: number; major: boolean }[] = [];
    for (let y = y0; y <= y1; y += minor) ticks.push({ y, major: (y - y0) % major === 0 || y === y1 });
    const labels: number[] = [];
    for (let y = y0; y <= y1; y += major) labels.push(y);
    if (labels[labels.length - 1] !== y1) labels.push(y1);
    return { y0, y1, span, ticks, labels };
  }, [books]);

  const captionHtml = useMemo(() => {
    const b = books[startIdx];
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return [
      `<span class="sh-title" style="--fit:${fitFor(b.title)}">${esc(b.title)}</span>`,
      `<span class="sh-sub">${esc(b.authorName)} / ${esc(b.genreKanji)}</span>`,
      `<span class="sh-year">${b.year} — ${esc(b.genre)}</span>`,
    ];
  }, [books, startIdx]);

  useLayoutEffect(() => {
    const hero = heroRef.current!;
    const probe = probeRef.current!;
    const shelf = shelfRef.current!;
    const stage = stageRef.current!;
    const tapes = tapeRefs.current.slice(0, TOTAL) as HTMLDivElement[];
    const faces = tapes.map((t) => [t.children[0] as HTMLElement, t.children[1] as HTMLElement] as const);
    const play = playRef.current!;
    const dot = dotRef.current!;
    const cursor = cursorRef.current!;
    const sheet = sheetRef.current!;
    const years = books.map((b) => b.year);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (fine) { hero.classList.add("sh-cursor-on"); sheet.classList.add("sh-cursor-on"); }

    // ── geometry ──
    let H = 400, ws = 0, d = 0, gap = 0, U = 1, W = window.innerWidth;
    let XS = new Float32Array(1);
    let shelfCenter = 0; // hero-relative y of the shelf centre line
    let heroTop = 0;
    const scl = (u: number) => 1 / (1 + Math.pow(Math.abs(u) / U, 1.6));
    const xsc = (u: number) => {
      const a = Math.abs(u) / 2;
      const i = Math.floor(a);
      const v = i >= XS.length - 1 ? XS[XS.length - 1] : XS[i] + (XS[i + 1] - XS[i]) * (a - i);
      return Math.sign(u) * v;
    };
    const B = (r: number) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);
    const F = (r: number) => r * (ws + gap) + (d - ws + 1.4 * gap) * B(r);
    const rel = (v: number, s: number) => { let r = mod(v - s, TOTAL); if (r >= TOTAL / 2) r -= TOTAL; return r; };

    const measure = () => {
      W = window.innerWidth;
      H = probe.getBoundingClientRect().height || 400;
      ws = (H * 142) / 840;
      d = (H * 2) / 3;
      gap = H * 0.035;
      U = H * (W < 768 ? 1.05 : 1.3);
      const n = Math.ceil((3 * U) / 2) + 2;
      XS = new Float32Array(n);
      for (let i = 1; i < n; i++) { const u = i * 2 - 1; XS[i] = XS[i - 1] + 2 / (1 + Math.pow(u / U, 1.6)); }
      stage.style.setProperty("--ws", `${ws}px`);
      stage.style.setProperty("--d", `${d}px`);
      shelfCenter = shelf.offsetTop + shelf.offsetHeight / 2;
      heroTop = hero.getBoundingClientRect().top;
      play.style.left = `${W / 2 - d / 2 - 6}px`;
      play.style.top = `${shelfCenter + 0.36 * H}px`;
    };
    measure();

    // ── state ──
    let s = startIdx + N, T = s;
    let active = startIdx;
    let down = false, dragging = false, dragged = false, dragX = 0, T0 = 0, downV = -1;
    let hoverV = -1, overBtn = false, pointerIn = false;
    let mx = -9999, my = -9999, cx = W / 2, cy = 0;
    let tiltX = 0, tiltY = 0;
    const lifts = new Float32Array(TOTAL);
    const hidden = new Uint8Array(TOTAL);
    let dotYear = years[startIdx];
    let detailOpen = false, closing = false, openAt = 0, inkDone = true;
    let wheelSnap = 0;
    let cursorState = "";
    let raf = 0, last = performance.now(), running = false, visible = true;

    // ── caption mask swap ──
    const capClasses = ["sh-title", "sh-sub", "sh-year"];
    const swapCaption = (i: number, dir: number) => {
      const b = books[i];
      const texts = [b.title, `${b.authorName} / ${b.genreKanji}`, `${b.year} — ${b.genre}`];
      capRefs.current.forEach((mask, k) => {
        if (!mask) return;
        const olds = Array.from(mask.children) as HTMLElement[];
        const span = document.createElement("span");
        span.className = capClasses[k];
        span.textContent = texts[k];
        if (k === 0) span.style.setProperty("--fit", String(fitFor(b.title)));
        mask.appendChild(span);
        if (reduced) { olds.forEach((o) => o.remove()); return; }
        span.animate([{ transform: `translateY(${dir * 105}%)` }, { transform: "translateY(0)" }], { duration: 650, easing: EASE, fill: "both" });
        olds.forEach((o) => {
          const cur = getComputedStyle(o).transform;
          o.getAnimations().forEach((a) => { a.onfinish = null; a.cancel(); });
          const a = o.animate([{ transform: cur === "none" ? "translateY(0)" : cur }, { transform: `translateY(${-dir * 105}%)` }], { duration: 650, easing: EASE, fill: "both" });
          a.onfinish = () => o.remove();
        });
      });
      if (liveRef.current) liveRef.current.textContent = `${b.title} by ${b.authorName}, ${b.year}`;
    };

    // ── detail sheet ──
    const coverRect = () => {
      const v = mod(Math.round(s), TOTAL);
      return faces[v][1].getBoundingClientRect();
    };
    const insetOf = (r: DOMRect) =>
      `inset(${r.top}px ${Math.max(0, window.innerWidth - r.right)}px ${Math.max(0, window.innerHeight - r.bottom)}px ${r.left}px round 3px)`;
    const lockScroll = (on: boolean) => { document.documentElement.style.overflow = on ? "hidden" : ""; };

    const openDetail = () => {
      if (detailOpen) return;
      T = Math.round(T);
      const i = mod(Math.round(T), N);
      flushSync(() => setOpenIdx(i));
      circleRefs.current.forEach((c) => c?.setAttribute("r", "0"));
      const r = coverRect();
      sheet.dataset.open = "1";
      sheet.scrollTop = 0;
      detailOpen = true;
      inkDone = false;
      openAt = performance.now() - (reduced ? 5000 : 0);
      lockScroll(true);
      sheet.getAnimations().forEach((a) => a.cancel());
      sheet.animate([{ clipPath: insetOf(r) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: reduced ? 1 : 1050, easing: SHEET_EASE, fill: "both" });
      sheet.querySelectorAll<HTMLElement>(".sh-d-m > *").forEach((el, k) => {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], {
          duration: reduced ? 1 : 900, delay: reduced ? 0 : 620 + k * 75, easing: EASE, fill: "both",
        });
      });
      closeBtnRef.current?.focus({ preventScroll: true });
      start();
    };

    const closeDetail = () => {
      if (!detailOpen || closing) return;
      closing = true;
      const r = coverRect();
      sheet.getAnimations().forEach((a) => a.cancel());
      const a = sheet.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: insetOf(r) }], { duration: reduced ? 1 : 850, easing: SHEET_EASE, fill: "both" });
      a.onfinish = () => {
        sheet.dataset.open = "0";
        sheet.getAnimations().forEach((x) => x.cancel());
        sheet.querySelectorAll<HTMLElement>(".sh-d-m > *").forEach((el) => el.getAnimations().forEach((x) => x.cancel()));
        detailOpen = false;
        closing = false;
        lockScroll(false);
        hero.focus({ preventScroll: true });
      };
    };

    // ── navigation ──
    const step = (dir: number) => { if (!detailOpen) { T = Math.round(T) + dir; start(); } };
    const clickTape = (v: number) => {
      const r = rel(v, s);
      if (Math.abs(r) < 0.5 && Math.abs(T - s) < 0.3) openDetail();
      else { T = Math.round(T + r); start(); }
    };
    const jumpYear = (clientX: number) => {
      const el = dot.parentElement!;
      const rect = el.getBoundingClientRect();
      const year = tl.y0 + ((clientX - rect.left) / rect.width) * tl.span;
      let best = 0;
      years.forEach((y, i) => { if (Math.abs(y - year) < Math.abs(years[best] - year)) best = i; });
      const cur = mod(Math.round(T), N);
      let diff = best - cur;
      if (diff > N / 2) diff -= N;
      if (diff < -N / 2) diff += N;
      T = Math.round(T) + diff;
      start();
    };
    api.current = { step, open: openDetail, close: closeDetail, jumpYear };

    // ── frame ──
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // spring
      if (reduced && !dragging) s = T;
      else s += (T - s) * (1 - Math.exp(-(dragging ? 18 : 5.2) * dt));
      if (Math.abs(s - (startIdx + N)) > 4 * N) {
        const sh = Math.round((s - (startIdx + N)) / TOTAL) * TOTAL;
        s -= sh; T -= sh; T0 -= sh;
      }

      // active book & caption
      const a = mod(Math.round(s), N);
      if (a !== active) { swapCaption(a, Math.sign(T - s) || 1); active = a; }

      const settled = Math.abs(T - s) < 0.3;
      const screenCy = heroTop + shelfCenter;
      const onCover = pointerIn && !detailOpen && settled && Math.abs(mx - W / 2) < 0.55 * d && Math.abs(my - screenCy) < 0.55 * H;

      // tilt
      const kt = 1 - Math.exp(-7 * dt);
      const tyT = onCover ? ((mx - W / 2) / (0.55 * d)) * 8 : pointerIn ? ((mx - W / 2) / W) * 4 : 0;
      const txT = onCover ? (-(my - screenCy) / (H / 2)) * 5 : 0;
      tiltY += (tyT - tiltY) * kt;
      tiltX += (txT - tiltX) * kt;

      // tapes
      const kl = reduced ? 1 : 1 - Math.exp(-12 * dt);
      for (let v = 0; v < TOTAL; v++) {
        const el = tapes[v];
        const r = rel(v, s);
        const u = F(r);
        if (Math.abs(u) > U * 1.95) {
          if (!hidden[v]) { el.style.visibility = "hidden"; hidden[v] = 1; }
          continue;
        }
        if (hidden[v]) { el.style.visibility = ""; hidden[v] = 0; }
        const o = smooth(Math.max(0, 1 - Math.abs(r)));
        lifts[v] += ((v === hoverV && Math.abs(r) > 0.5 && !dragging ? 1 : 0) - lifts[v]) * kl;
        const sc = scl(u);
        const k = 1 / sc;
        const z = P * (1 - k) + o * H * 0.1;
        const x = xsc(u) * k;
        const y = (H * 0.5 * (1 - sc) * 0.42 + o * H * 0.012 - lifts[v] * H * 0.05) * k;
        const ry = Math.sign(u) * Math.min(1, Math.abs(u) / U) * 26 * (1 - o) - 90 * o + tiltY * o;
        const rx = tiltX * o;
        el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
        el.style.zIndex = String(Math.round(3000 + z));
        faces[v][0].style.setProperty("--shade", Math.min(0.6, o * 0.55 + (1 - sc) * 0.32).toFixed(3));
        faces[v][1].style.setProperty("--shade", ((1 - o) * 0.82).toFixed(3));
      }

      // open ring
      const ps = detailOpen ? 0 : smooth(Math.max(0, 1 - Math.abs(T - s) * 3));
      play.style.transform = `scale(${ps.toFixed(3)})`;

      // timeline dot
      const fl = Math.floor(s), f = s - fl;
      const ya = years[mod(fl, N)], yb = years[mod(fl + 1, N)];
      const target = yb < ya ? (f < 0.5 ? ya : yb) : ya + (yb - ya) * f;
      if (reduced || Math.abs(target - dotYear) > tl.span * 0.17) dotYear = target;
      else dotYear += (target - dotYear) * (1 - Math.exp(-14 * dt));
      dot.style.left = `${(((dotYear - tl.y0) / tl.span) * 100).toFixed(3)}%`;

      // cursor
      if (fine) {
        const show = pointerIn || detailOpen;
        cursor.dataset.on = show ? "1" : "0";
        const kc = 1 - Math.exp(-16 * dt);
        cx += (mx - cx) * kc;
        cy += (my - cy) * kc;
        cursor.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
        const st = overBtn ? "btn" : onCover ? "open" : hoverV >= 0 && !detailOpen ? "spine" : "";
        if (st !== cursorState) { cursor.dataset.state = st; cursorState = st; }
      }

      // ink bleed
      if (detailOpen && !inkDone) {
        const el = now - openAt - 520;
        let done = true;
        CIRCLES.forEach(([, , delay], k) => {
          const t = Math.min(1, Math.max(0, (el - delay) / 1250));
          if (t < 1) done = false;
          circleRefs.current[k]?.setAttribute("r", (R_MAX * (1 - Math.pow(1 - t, 3))).toFixed(1));
        });
        inkDone = done;
      }

      // keep running while anything is moving or the hero is visible
      const moving = Math.abs(T - s) > 0.0005 || pointerIn || detailOpen || dragging || Math.abs(dotYear - target) > 0.01 || lifts.some((l) => l > 0.001);
      if ((visible && moving) || detailOpen || Math.abs(cx - mx) > 0.5) raf = requestAnimationFrame(frame);
      else running = false;
    };
    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    // first layout synchronously (no flash of stacked books), then animate
    running = true;
    frame(performance.now());
    stage.dataset.ready = "1";

    // ── inputs ──
    const tapeFrom = (t: EventTarget | null) => {
      const el = (t as Element | null)?.closest?.(".sh-tape") as HTMLElement | null;
      return el ? Number(el.dataset.v) : -1;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || detailOpen) return;
      down = true; dragging = false; dragged = false;
      dragX = e.clientX; T0 = T;
      downV = tapeFrom(e.target);
    };
    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX; my = e.clientY;
      const t = e.target as Element | null;
      overBtn = !!t?.closest?.("a,button,[data-cursor='btn']");
      hoverV = shelf.contains(t as Node) ? tapeFrom(t) : -1;
      if (down) {
        const dx = e.clientX - dragX;
        if (!dragging && Math.abs(dx) > 5) {
          dragging = true; dragged = true;
          try { shelf.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }
        if (dragging) T = T0 - dx / (ws + gap);
      }
      start();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      if (dragging) { dragging = false; T = Math.round(T); }
      else if (!dragged && downV >= 0 && e.type === "pointerup") clickTape(downV);
      downV = -1;
      start();
    };
    const onEnter = (e: PointerEvent) => { pointerIn = true; mx = cx = e.clientX; my = cy = e.clientY; start(); };
    const onLeave = () => { pointerIn = false; hoverV = -1; start(); };
    const onWheel = (e: WheelEvent) => {
      if (detailOpen) return;
      const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const dx = e.deltaX * m, dy = e.deltaY * m;
      const horiz = Math.abs(dx) > Math.abs(dy);
      const hr = hero.getBoundingClientRect();
      const fully = hr.top >= -1 && hr.bottom <= window.innerHeight + 1;
      const sr = shelf.getBoundingClientRect();
      const overBand = e.clientY >= sr.top && e.clientY <= sr.bottom;
      if (!horiz && !e.shiftKey && !(overBand && fully)) return; // let the page scroll
      e.preventDefault();
      const delta = horiz ? dx : dy;
      T += (delta / (ws + gap)) * 0.5;
      window.clearTimeout(wheelSnap);
      wheelSnap = window.setTimeout(() => { T = Math.round(T); start(); }, 160);
      start();
    };
    const onKey = (e: KeyboardEvent) => {
      if (detailOpen) {
        if (e.key === "Escape") { e.preventDefault(); closeDetail(); }
        return;
      }
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      if (document.querySelector("dialog[open],[role='dialog'][aria-hidden='false']")) return;
      const hr = hero.getBoundingClientRect();
      if (hr.bottom < window.innerHeight * 0.5) return; // hero mostly scrolled away
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "Enter" && (!ae || ae === document.body || ae === hero)) { e.preventDefault(); if (Math.abs(T - s) < 0.3) openDetail(); }
    };
    const onScroll = () => { heroTop = hero.getBoundingClientRect().top; };
    const onResize = () => { measure(); start(); };

    shelf.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    hero.addEventListener("pointerenter", onEnter);
    hero.addEventListener("pointerleave", onLeave);
    sheet.addEventListener("pointerenter", onEnter);
    hero.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => { measure(); start(); });
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }, { threshold: 0 });
    io.observe(hero);

    // warm the cache for the covers
    books.forEach((b) => { const src = coverSrc(b, "L"); if (src) { const im = new Image(); im.src = src; } });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(wheelSnap);
      shelf.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      hero.removeEventListener("pointerenter", onEnter);
      hero.removeEventListener("pointerleave", onLeave);
      sheet.removeEventListener("pointerenter", onEnter);
      hero.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      io.disconnect();
      lockScroll(false);
      api.current = null;
    };
    // Books are static for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ob = books[openIdx];
  const obSrc = coverSrc(ob, "L");

  return (
    <>
      <section ref={heroRef} className="sh-hero" aria-label="Featured books shelf" tabIndex={-1}>
        <div ref={probeRef} className="sh-probe" aria-hidden />
        <p ref={liveRef} className="sr-only" aria-live="polite" />
        <nav className="sr-only" aria-label="Featured books">
          <ul>{books.map((b) => <li key={b.id}><Link href={`/book/${b.id}`}>{b.title} by {b.authorName} ({b.year})</Link></li>)}</ul>
        </nav>

        <div className="sh-kanji sh-kanji-l" aria-hidden>本の</div>
        <div className="sh-kanji sh-kanji-r" aria-hidden>記憶</div>
        <div className="sh-floor" aria-hidden />

        <div ref={shelfRef} className="sh-shelf" aria-hidden>
          <div ref={stageRef} className="sh-stage">
            {Array.from({ length: TOTAL }, (_, v) => {
              const b = books[v % N];
              return (
                <div key={v} className="sh-tape" data-v={v} ref={(el) => { tapeRefs.current[v] = el; }}>
                  <div className="sh-face sh-sp"><SpineArt id={b.id} title={b.title} author={b.authorName} /></div>
                  <div className="sh-face sh-cv"><Cover book={b} failed={failed.has(b.id)} onFail={onFail} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={playRef} className="sh-play" aria-hidden>
          <svg viewBox="0 0 12 12"><path d="M1 0l11 6-11 6z" /></svg>
        </div>

        <div className="sh-cap">
          {captionHtml.map((html, k) => (
            <div key={k} className="contents">
              <span
                ref={(el) => { capRefs.current[k] = el; }}
                className={`sh-m ${k === 0 ? "sh-m-title" : ""}`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              {k === 1 && <span className="sh-rule" aria-hidden />}
            </div>
          ))}
        </div>

        <button type="button" className="sh-arrow sh-arrow-prev" aria-label="Previous book" onClick={() => api.current?.step(-1)}>
          <svg viewBox="0 0 24 12"><path d="M6 1L1 6l5 5M1 6h23" /></svg>
        </button>
        <button type="button" className="sh-arrow sh-arrow-next" aria-label="Next book" onClick={() => api.current?.step(1)}>
          <svg viewBox="0 0 24 12"><path d="M18 1l5 5-5 5M23 6H0" /></svg>
        </button>

        <div className="sh-tl">
          <div className="sh-tl-line" aria-hidden />
          {tl.ticks.map((t) => (
            <span key={t.y} aria-hidden className={`sh-tick ${t.major ? "sh-tick-major" : "sh-tick-minor"}`} style={{ left: `${((t.y - tl.y0) / tl.span) * 100}%` }} />
          ))}
          {tl.labels.map((y, i) => (
            <span key={y} aria-hidden className="sh-tl-lbl" data-odd={i % 2 ? "1" : "0"}
              data-edge={i === 0 ? "start" : i === tl.labels.length - 1 ? "end" : undefined}
              style={{ left: `${((y - tl.y0) / tl.span) * 100}%` }}>{y}</span>
          ))}
          <div ref={dotRef} className="sh-dot" aria-hidden style={{ left: `${((books[startIdx].year - tl.y0) / tl.span) * 100}%` }} />
          <button type="button" className="sh-tl-hit" data-cursor="btn" aria-label="Jump to a publication year"
            onClick={(e) => api.current?.jumpYear(e.clientX)} />
        </div>

        <div className="sh-foot">
          <span className="lbl">© Booklore. All rights reserved.</span>
          <button type="button" className="lbl" onClick={() => document.getElementById("home-content")?.scrollIntoView({ behavior: "smooth" })}>
            Scroll / <span className="font-jp">続き</span> ↓
          </button>
        </div>
      </section>

      <div ref={cursorRef} className="sh-cursor" aria-hidden data-on="0">
        <div className="sh-c-ring" />
        <div className="sh-c-dot" />
        <div className="sh-c-lbl"><span>OPEN</span><span>開く</span></div>
      </div>

      <div ref={sheetRef} className="sh-detail" data-open="0" role="dialog" aria-modal="true" aria-label={`${ob.title} details`}>
        <button ref={closeBtnRef} type="button" className="sh-d-close lbl box" onClick={() => api.current?.close()}>
          Close / <span className="font-jp">閉じる</span>
        </button>
        <div className="sh-d-brand" aria-hidden>
          <span className="lbl">Booklore</span>
          <span className="sh-d-brand-x h-px w-10 bg-current" />
          <span className="lbl sh-d-brand-x">Book Archive</span>
        </div>

        <div className="sh-d-left">
          <div className="sh-d-m"><span className="lbl sh-d-sub">{ob.genre} / <span className="font-jp">{ob.genreKanji}</span></span></div>
          <div className="sh-d-m"><h2 className="sh-d-title">{ob.title}</h2></div>
          <div className="sh-d-m"><span className="lbl sh-d-meta">{ob.year} / {ob.genre}{ob.pages ? ` / ${ob.pages} pages` : ""}</span></div>
          <div className="sh-d-m"><p className="sh-d-syn">{ob.synopsis}</p></div>
          <div className="sh-d-m"><p className="sh-d-credit">by {ob.authorName}.<span>著作</span></p></div>
          <div className="sh-d-m">
            <p className="sh-d-rating">
              <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
              <span className="text-[15px] font-semibold">{ob.ratingAvg?.toFixed(1) ?? "–"}<span className="text-muted">/10</span></span>
              <span className="lbl text-muted">· {compact(ob.ratingCount)} ratings</span>
            </p>
          </div>
          <div className="sh-d-m">
            <div className="sh-d-btns">
              <Link href={`/book/${ob.id}`} className="sh-d-btn lbl"><span>View book</span><span>本を見る</span></Link>
              <ShelfToggle key={ob.id} bookId={ob.id} status={(statuses[ob.id] as Status) ?? null} />
            </div>
          </div>
        </div>

        <div className="sh-d-right">
          <svg className="sh-poster" viewBox={`0 0 ${PW} ${PH}`} role="img" aria-label={`${ob.title} cover`}>
            <defs>
              <filter id="sh-ink" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="7" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="120" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <mask id="sh-ink-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={PW} height={PH}>
                <g filter="url(#sh-ink)">
                  {CIRCLES.map(([x, y], k) => (
                    <circle key={k} ref={(el) => { circleRefs.current[k] = el; }} cx={x} cy={y} r="0" fill="#fff" />
                  ))}
                </g>
              </mask>
              <clipPath id="sh-poster-clip"><rect width={PW} height={PH} /></clipPath>
            </defs>
            <g clipPath="url(#sh-poster-clip)" mask="url(#sh-ink-mask)">
              {obSrc && !failed.has(ob.id) ? (
                <image href={obSrc} x="0" y="0" width={PW} height={PH} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <svg x="0" y="0" width={PW} height={PH}>
                  <GeneratedCover id={ob.id} title={ob.title} author={ob.authorName} />
                </svg>
              )}
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}
