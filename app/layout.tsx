import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cruel Coding · 残酷刷题群",
  description: "A live leaderboard for the Cruel Coding community.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <footer className="global-footer">
          <a href="https://cruelcoding.com">cruelcoding.com</a>
          <span>Support: <a href="mailto:cruelcoding@gmail.com">cruelcoding@gmail.com</a></span>
        </footer>
      </body>
    </html>
  );
}
