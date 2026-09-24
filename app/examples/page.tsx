import { PageHero, CtaBand } from "@/components/site";
import NotePage from "@/components/NotePage";
import { DEFAULT_STYLE } from "@/lib/handwriting/options";
const sample =
  "## Binary search: halve the work\n\n**Definition:** Binary search finds a target in a sorted list by repeatedly discarding half of the remaining items.\n\n### Keep these in mind\n- The list must be **sorted**.\n- Compare the **middle value** with the target.\n- Keep only the half that can contain the target.\n- Stop when found or when the search interval is empty.\n\nDiagram: flow | Choose the middle item | Compare with target | Keep the possible half | Repeat or finish\n\n### A quick example\nIn [2, 4, 6, 8, 10], search for 8: compare 6, then search [8, 10].\n\n> Exam alert: Sorting is a precondition, not a step you can ignore.\n\n**Summary:** Halving a sorted search interval gives logarithmic worst-case search time.";
export default function Examples() {
  return (
    <>
      <PageHero
        kicker="A closer look"
        title="Readable notes. Ideas you can follow."
        lede="This hand-authored example demonstrates the same rendering engine used for your generated notes. It is a layout sample, not a live AI result."
      />
      <div className="wrap feature-section" style={{ maxWidth: 850 }}>
        <NotePage
          markdown={sample}
          style={{ ...DEFAULT_STYLE, paper: "cream" }}
          footer="Illustrative example · Syaahi"
        />
      </div>
      <CtaBand />
    </>
  );
}
