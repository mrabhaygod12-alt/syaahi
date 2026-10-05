import {
  Sparkles,
  ShieldCheck,
  BookOpen,
  ChartNoAxesCombined,
  Lightbulb,
  Users,
  Target,
  Workflow,
  Leaf,
  Globe,
  Zap,
  Search,
} from "lucide-react";
import type { SlideIcon } from "@/lib/presentations/archetypes";
import type { SceneElement } from "@/lib/presentations/scene";
export const SLIDE_ICONS = {
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
  "book-open": BookOpen,
  "chart-no-axes-combined": ChartNoAxesCombined,
  lightbulb: Lightbulb,
  users: Users,
  target: Target,
  workflow: Workflow,
  leaf: Leaf,
  globe: Globe,
  zap: Zap,
  search: Search,
};
export function SemanticIcon({
  name,
  color,
  size = 32,
}: {
  name: SlideIcon;
  color: string;
  size?: number;
}) {
  const Icon = SLIDE_ICONS[name];
  return (
    <Icon size={size} color={color} strokeWidth={1.8} aria-hidden="true" />
  );
}
export default function ArchetypeArtwork({
  elements,
}: {
  elements: SceneElement[];
}) {
  return (
    <>
      {elements
        .filter((p) => p.type !== "text")
        .map((p) => (
          <div
            key={p.id}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${p.x / 12.8}%`,
              top: `${p.y / 7.2}%`,
              width: `${p.w / 12.8}%`,
              height: `${p.h / 7.2}%`,
              ...(p.type === "surface"
                ? {
                    background: "#" + p.color,
                    border: `1px solid #${p.stroke}`,
                    borderRadius: `${p.radius / 12.8}cqw`,
                  }
                : {}),
            }}
          >
            {p.type === "icon" && (
              <SemanticIcon name={p.icon} color={"#" + p.color} />
            )}
          </div>
        ))}
    </>
  );
}
