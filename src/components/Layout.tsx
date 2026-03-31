import { ReactNode } from "react";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  onRefresh: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
}

export function Layout({
  children,
  currentPage,
  onNavigate,
  onRefresh,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward
}: LayoutProps) {
  return (
    <div className="flex flex-col h-screen text-brand-100 bg-brand-950 overflow-hidden font-sans">
      <TopBar
        currentPage={currentPage}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={onGoBack}
        onGoForward={onGoForward}
      />

      <main className="flex-1 overflow-y-auto bg-brand-950">
        {children}
      </main>
    </div>
  );
}
