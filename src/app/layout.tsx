import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vedic Transits Dashboard",
  description: "Real-time planetary transits using Lahiri Ayanamsa, including outer planets and upgrahas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${cinzel.variable} font-sans antialiased bg-[#0B0F19] text-[#E2E8F0]`}
      >
        {children}
      </body>
    </html>
  );
}
