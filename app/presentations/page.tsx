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
    "Import complete lecture sources, review a cited storyboard and direct interactive visual scenes. Export editable PPTX, PDF, PNG or an offline web deck.",
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
