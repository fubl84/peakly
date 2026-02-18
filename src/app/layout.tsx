import type { Metadata } from "next";
import { Funnel_Display } from "next/font/google";
import "./globals.css";

const funnelDisplay = Funnel_Display({
  variable: "--font-funnel-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peakly",
  description: "Closed fitness platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${funnelDisplay.variable} app-shell`}>{children}</body>
    </html>
  );
}
