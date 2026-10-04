import { Extension } from "@tiptap/core";
export const ParagraphIndent = Extension.create({
  name: "paragraphIndent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) =>
              Math.max(0, Math.min(5, Number(element.dataset.indent) || 0)),
            renderHTML: (attrs) =>
              attrs.indent
                ? {
                    "data-indent": attrs.indent,
                    style: `margin-left: ${attrs.indent * 2}em`,
                  }
                : {},
          },
        },
      },
    ];
  },
});
