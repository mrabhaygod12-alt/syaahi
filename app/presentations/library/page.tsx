import PresentationHome from "@/components/presentations/PresentationHome";
export const metadata = {
  title: "Your presentations",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <PresentationHome view="library" />;
}
