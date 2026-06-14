import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LearnAI — LMS thông minh",
  description:
    "Hệ thống quản lý học tập tối giản với trợ giảng AI dùng Google Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.className} antialiased min-h-screen bg-white`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-center" richColors theme="light" />
      </body>
    </html>
  );
}
