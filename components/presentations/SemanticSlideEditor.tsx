"use client";
import {
  ICON_NAMES,
  words,
  type ArchetypeSlide,
  type CardSlot,
} from "@/lib/presentations/archetypes";
export default function SemanticSlideEditor({
  slide,
  onChange,
}: {
  slide: ArchetypeSlide;
  onChange: (slide: ArchetypeSlide) => void;
}) {
  const field = (
    label: string,
    value: string,
    max: number,
    change: (value: string) => void,
    characters = 180,
  ) => (
    <label key={label}>
      {label}
      <textarea
        aria-label={label}
        value={value}
        maxLength={characters}
        rows={value.length > 75 ? 3 : 2}
        onChange={(e) => change(e.target.value.replace(/[\r\n]/g, " "))}
      />
      <small>
        {words(value)}/{max} words
      </small>
    </label>
  );
  const card = (
    value: CardSlot,
    label: string,
    change: (value: CardSlot) => void,
  ) => (
    <fieldset key={label}>
      <legend>{label}</legend>
      {field(
        `${label} heading`,
        value.title,
        5,
        (title) => change({ ...value, title }),
        70,
      )}
      {field(`${label} description`, value.body, 20, (body) =>
        change({ ...value, body }),
      )}
      <label>
        Icon
        <select
          aria-label={`${label} icon`}
          value={value.icon}
          onChange={(e) =>
            change({ ...value, icon: e.target.value as CardSlot["icon"] })
          }
        >
          {ICON_NAMES.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
  return (
    <div className="pw-semantic-editor">
      <p>
        {slide.archetype.replaceAll("_", " ")} · Fixed layout, editable content
      </p>
      {field(
        "Slide headline",
        slide.title,
        8,
        (title) => onChange({ ...slide, title }),
        100,
      )}
      {field(
        "Category",
        slide.eyebrow,
        3,
        (eyebrow) => onChange({ ...slide, eyebrow }),
        40,
      )}
      {slide.archetype === "hero_headline" && (
        <>
          {field("Main takeaway", slide.takeaway, 20, (takeaway) =>
            onChange({ ...slide, takeaway }),
          )}
          {field(
            "Primary callout",
            slide.callout,
            4,
            (callout) => onChange({ ...slide, callout }),
            32,
          )}
          {field(
            "Callout label",
            slide.label,
            8,
            (label) => onChange({ ...slide, label }),
            80,
          )}
        </>
      )}
      {slide.archetype === "bento_grid_3" &&
        slide.cards.map((c, i) =>
          card(c, `Card ${i + 1}`, (value) =>
            onChange({
              ...slide,
              cards: slide.cards.map((old, j) =>
                j === i ? value : old,
              ) as typeof slide.cards,
            }),
          ),
        )}
      {slide.archetype === "metric_trio" &&
        slide.metrics.map((m, i) => (
          <fieldset key={i}>
            <legend>Metric {i + 1}</legend>
            {field(
              `Metric ${i + 1} value`,
              m.value,
              3,
              (value) =>
                onChange({
                  ...slide,
                  metrics: slide.metrics.map((o, j) =>
                    j === i ? { ...o, value } : o,
                  ) as typeof slide.metrics,
                }),
              16,
            )}
            {field(
              `Metric ${i + 1} label`,
              m.label,
              5,
              (label) =>
                onChange({
                  ...slide,
                  metrics: slide.metrics.map((o, j) =>
                    j === i ? { ...o, label } : o,
                  ) as typeof slide.metrics,
                }),
              65,
            )}
            {field(
              `Metric ${i + 1} context`,
              m.context,
              18,
              (context) =>
                onChange({
                  ...slide,
                  metrics: slide.metrics.map((o, j) =>
                    j === i ? { ...o, context } : o,
                  ) as typeof slide.metrics,
                }),
              150,
            )}
            <p>Source: {m.sourceId}</p>
            <blockquote>{m.excerpt}</blockquote>
          </fieldset>
        ))}
      {slide.archetype === "split_comparison" && (
        <>
          {card(slide.left, "Left column", (left) =>
            onChange({ ...slide, left }),
          )}
          {card(slide.right, "Right column", (right) =>
            onChange({ ...slide, right }),
          )}
        </>
      )}
      {slide.archetype === "linear_stepper" &&
        slide.steps.map((c, i) =>
          card(c, `Phase ${i + 1}`, (value) =>
            onChange({
              ...slide,
              steps: slide.steps.map((o, j) => (j === i ? value : o)),
            }),
          ),
        )}
      {slide.archetype === "quote_attribution" && (
        <>
          {field(
            "Quotation",
            slide.quote,
            32,
            (quote) => onChange({ ...slide, quote }),
            260,
          )}
          {field(
            "Quote author",
            slide.author,
            6,
            (author) => onChange({ ...slide, author }),
            80,
          )}
          {field(
            "Author credentials",
            slide.credentials,
            8,
            (credentials) => onChange({ ...slide, credentials }),
            90,
          )}
          <small>
            Quotation source: {slide.sourceId}. Keep the quoted text faithful to
            the source.
          </small>
        </>
      )}
    </div>
  );
}
