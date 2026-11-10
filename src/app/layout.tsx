import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist } from "next/font/google";
import { ThemeScript } from "@/components/theme-toggle";
import { siteThemeStyle } from "@/lib/club-colors";
import { siteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Cor do site escolhida pelo admin (Site Settings). Sem cor, fica o laranja do globals.css.
  const { brand_color } = await getSiteSettings();
  const siteTheme = siteThemeStyle(brand_color);
  return (
    // "dark" é o padrão; o script tira a classe se a pessoa escolheu o modo claro.
    // suppressHydrationWarning: o script muda a classe antes do React assumir a página.
    <html
      lang="pt-BR"
      className={`dark ${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body
        className={`flex min-h-full flex-col ${siteTheme ? "club-theme" : ""}`}
        style={siteTheme}
      >
        {children}
        {/* Visitas por página, sem cookies (Vercel Web Analytics). Ligue em Vercel > Analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
