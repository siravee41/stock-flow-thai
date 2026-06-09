import {
  Outlet, createRootRoute, HeadContent, Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1d2e" },
      { title: "Pantry — ระบบสต๊อกร้านอาหาร" },
      { name: "description", content: "ระบบจัดการสต๊อกวัตถุดิบสำหรับเครือร้านอาหาร พร้อมซิงค์เรียลไทม์ทุกสาขา" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <div className="text-6xl font-semibold">404</div>
        <p className="mt-2 text-muted-foreground">ไม่พบหน้าที่ต้องการ</p>
        <a href="/" className="mt-4 inline-block underline">กลับหน้าหลัก</a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center max-w-md">
        <div className="text-xl font-semibold">เกิดข้อผิดพลาด</div>
        <p className="mt-2 text-sm text-muted-foreground break-words">{error.message}</p>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}
