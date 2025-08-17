import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DiarisatorAI",
  description: "上传音频文件以分离句子和识别不同的说话人",
  keywords: ["Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI development", "React"],
  authors: [{ name: "Richard Jiang" }],
  openGraph: {
    title: "DiarisatorAI",
    description: "Segment audio into different segments based on pauses or sentence boundaries using pyannote.audio",
    url: "https://diarisatorai.com",
    siteName: "DiarisatorAI.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DiarisatorAI",
    description: "Segment audio into different segments based on pauses or sentence boundaries using pyannote.audio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
