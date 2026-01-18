import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: [
    { path: "./fonts/woff2/Pretendard-Thin.woff2", weight: "100", style: "normal" },
    { path: "./fonts/woff2/Pretendard-ExtraLight.woff2", weight: "200", style: "normal" },
    { path: "./fonts/woff2/Pretendard-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/woff2/Pretendard-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/woff2/Pretendard-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/woff2/Pretendard-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/woff2/Pretendard-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/woff2/Pretendard-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "./fonts/woff2/Pretendard-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: "pomodoro",
  description: "pomodoro app made by aiden",
  icons: {
    icon: "./icon.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${pretendard.variable} ${pretendard.variable}`}>
        {children}
      </body>
    </html>
  );
}
