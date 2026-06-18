import type { Metadata } from "next";
import {
  Inter,
  Geist,
  Space_Grotesk,
  Plus_Jakarta_Sans,
  Satisfy,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const inter = Inter({ subsets: ["latin"] });

const space_grotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--font-space",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-plus-jakarta",
});

const satisfy = Satisfy({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-handwriting",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RakuLearn — LMS thông minh",
  description:
    "Hệ thống quản lý học tập tối giản với trợ giảng AI dùng Google Gemini.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={cn(
        "font-sans",
        geist.variable,
        space_grotesk.variable,
        plusJakartaSans.variable,
        satisfy.variable,
      )}
    >
      <body
        className={`${plusJakartaSans.className} antialiased min-h-screen bg-white`}
      >
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-center" richColors theme="light" />
      </body>
    </html>
  );
}
