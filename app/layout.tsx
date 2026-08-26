import type { Metadata, Viewport } from "next";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  BRAND_COLORS,
} from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_SHORT_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // iOS safe-area 를 쓰기 위해 필요
  themeColor: BRAND_COLORS.theme,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <a href="#main-content" className="skipLink">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
