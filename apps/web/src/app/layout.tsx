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
  title: "TerraShift AI — Orbital Earth Observation & Siamese U-Net Telemetry",
  description:
    "Bi-temporal Sentinel-2 change detection that neutralizes seasonal and atmospheric noise, quantifying ground disturbance in square metres.",
};

export const viewport: Viewport = {
  themeColor: "#04070B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${instrument.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}
    >
      <body className="bg-ink-950 text-bone-100 min-h-dvh antialiased selection:bg-signal-400 selection:text-ink-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
