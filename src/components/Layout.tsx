import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden" style={{ background: "#0a0a14" }}>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />

      {/* Subtle gradient line between sidebar and content */}
      <div
        className="w-px flex-shrink-0"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.3) 30%, rgba(99,102,241,0.15) 70%, transparent 100%)" }}
      />

      <main className="flex-1 overflow-y-auto" style={{ background: "#0a0a14" }}>
        {children}
      </main>
    </div>
  );
}
