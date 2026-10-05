import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "TerraShift — Tell a season from a scar",
  description:
    "Satellite change detection that neutralizes seasonal and atmospheric noise, then measures real ground change in square metres.",
};

export const viewport: Viewport = {
  themeColor: "#05080C",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={`${instrument.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-ink-950 text-bone-100 min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
