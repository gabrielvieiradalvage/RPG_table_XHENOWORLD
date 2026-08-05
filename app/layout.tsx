import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xhenosworld VTT",
  description: "Mesa Virtual de RPG e Sistema NID FOR END",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Impede zoom acidental da página no celular
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#080811] text-white antialiased overflow-hidden touch-manipulation">
        {children}
      </body>
    </html>
  );
}