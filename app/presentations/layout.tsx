import PresentationWorkspace from "@/components/presentations/PresentationWorkspace";
export const metadata = { robots: { index: false, follow: true } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PresentationWorkspace>{children}</PresentationWorkspace>;
}
