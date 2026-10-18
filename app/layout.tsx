import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyScan | Your classroom, connected",
  description: "Teacher-guided academic support, lesson materials, and asynchronous learning in one workspace.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
