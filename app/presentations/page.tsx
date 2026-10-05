import PresentationHome from "@/components/presentations/PresentationHome";
import {
  pageMeta,
  jsonLd,
  presentationSchema,
  breadcrumbSchema,
} from "@/lib/seo";
export const metadata = pageMeta({
  title: "AI Presentation Studio — Source, Story, Slides",
  description:
    "Research public sources, review a storyboard and build concise presentations using six visual layouts. Edit and export PPTX, PDF and PNG.",
  path: "/presentations",
});
export default function Page() {
  return (
    <>
      <PresentationHome />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(presentationSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Presentation studio", path: "/presentations" },
            ]),
          ),
        }}
      />
    </>
  );
}
