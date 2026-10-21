import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TerraShift — Planetary Earth Observation & Spectral Analytics",
  description:
    "Bi-temporal Sentinel-2 change detection, spectral anomaly attribution, BFAST 2030 trajectory forecasting, and IPCC Tier-1 carbon accounting.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${instrument.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://mt0.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://mt1.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://mt2.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://mt3.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://a.tiles.maps.eox.at" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://b.tiles.maps.eox.at" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://c.tiles.maps.eox.at" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://d.tiles.maps.eox.at" crossOrigin="anonymous" />
      </head>
      <body className="bg-white text-[#1c1f23] min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
