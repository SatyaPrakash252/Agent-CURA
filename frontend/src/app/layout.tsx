import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AuthWrapper from "@/components/layout/AuthWrapper";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0b",
};

export const metadata: Metadata = {
  title: "Project Cura — AI Clinical Documentation",
  description: "AI-powered clinical documentation. Voice capture, SOAP notes, billing codes, FHIR output.",
  authors: [{ name: "Project Cura" }],
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-[var(--bg-base)] text-[var(--text-primary)] antialiased overflow-x-hidden transition-colors duration-200">
        <AuthWrapper>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
              <Header />
              <main className="flex-1 pt-14 px-6 lg:px-10 pb-10 overflow-y-auto">
                <div className="max-w-[1200px] mx-auto pt-6">{children}</div>
              </main>
            </div>
          </div>
        </AuthWrapper>
      </body>
    </html>
  );
}
