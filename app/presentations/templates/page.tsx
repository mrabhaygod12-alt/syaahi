import PresentationHome from "@/components/presentations/PresentationHome";
export const metadata = {
  title: "Presentation templates",
  description:
    "Explore nine original presentation themes and six structured slide layouts.",
};
export default function Page() {
  return <PresentationHome view="templates" />;
}
