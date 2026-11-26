import type { Metadata, Viewport } from "next";
import { Inter_Tight, Newsreader, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { sqlite } from "@/db";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

const inter = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"], display: "swap" });
const notoJp = Noto_Sans_JP({ weight: ["500", "800"], variable: "--font-noto-jp", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "BOOKLORE: Ratings, Reviews, and Where to Read Books", template: "%s | BOOKLORE" },
  description: "BOOKLORE is the book archive: ratings, reviews, author profiles, charts, reading lists and personalised recommendations.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ece8e0" }, { media: "(prefers-color-scheme: dark)", color: "#141311" }],
};

// Applies a saved theme before paint (no flash).
const themeScript = `try{var t=localStorage.getItem('bl-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const listCount = user
    ? (sqlite.prepare(`SELECT count(*) n FROM shelf WHERE user_id = ? AND status = 'want'`).get(user.id) as { n: number }).n
    : 0;
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${newsreader.variable} ${notoJp.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-svh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:bg-cobalt focus:p-2 focus:text-cobalt-ink">
          Skip to content
        </a>
        <SiteHeader user={user} listCount={listCount} />
        <main id="main">{children}</main>
        <SiteFooter />
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
