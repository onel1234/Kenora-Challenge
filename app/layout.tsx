import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Gather · Workshop desk",
  description:
    "A calmer way to manage community workshops, seats, and registrations.",
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
