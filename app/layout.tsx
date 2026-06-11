import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paint by number generator",
  description: "Generate paint by number images (vectorized with SVG) from any input image.",
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
