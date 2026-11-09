import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Routa · Bora de cara pro vento?",
    template: "%s · Routa",
  },
  description:
    "Organize viagens e rolês de moto em grupo: inscrição, pagamento, lista de espera e termo de responsabilidade num link só.",
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
