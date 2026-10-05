import ReadingLibrary from "@/components/writer/ReadingLibrary";
export const metadata = {
  title: "Your reading library",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ReadingLibrary />;
}
