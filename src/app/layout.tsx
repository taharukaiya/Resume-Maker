import type { Metadata } from "next";
import "./globals.css";
import { config } from "@/lib/config";
import { connection } from "next/server";
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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Studio/authentication pages need per-request CSP nonces. Public portfolios
  // are served by route handlers and remain generated HTML without hydration.
  await connection();
  return (
    <html lang="en">
      {/* Browser extensions such as Grammarly add body attributes before hydration. */}
      <body suppressHydrationWarning>
        {config().demo && (
          <div className="demo-banner" role="note">
            CEO demonstration · Use sample data only · Free database expires
            after 30 days · Email delivery and malware scanning are not
            configured
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
