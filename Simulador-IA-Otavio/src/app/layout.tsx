import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Simulador de Sorriso IA | Esthetic Aligner",
  description:
    "Visualize como ficará seu sorriso após o tratamento com alinhadores Esthetic Aligner. Simulação por Inteligência Artificial.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} grid-bg min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
