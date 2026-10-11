import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: "/brand/mark.svg" },
  title: {
    default: "Brilliancy Research — Portfolio Studio",
    template: "%s | Brilliancy Research",
  },
  description:
    "A considered home for research, academic achievements, and your next chapter.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
