import { Extension, Node } from "@tiptap/core";
import katex from "katex";
import { normalizeDesign } from "@/lib/writing/design";
export const ArticleDesign = Extension.create({
  name: "articleDesign",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: Object.fromEntries(
          Object.entries(normalizeDesign()).map(([key, value]) => [
            key,
            { default: value, rendered: false },
          ]),
        ),
      },
    ];
  },
});
export const Equation = Node.create({
  name: "equation",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      expression: {
        default: "",
        parseHTML: (e) => e.getAttribute("data-equation"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-equation]" }];
  },
  renderHTML({ node }) {
    return [
      "div",
      { "data-equation": node.attrs.expression, class: "story-equation" },
      node.attrs.expression,
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "story-equation";
      const draw = (n: typeof node) =>
        katex.render(n.attrs.expression, dom, {
          displayMode: true,
          throwOnError: false,
          trust: false,
          maxExpand: 200,
          maxSize: 10,
        });
      draw(node);
      return {
        dom,
        update(n) {
          if (n.type.name !== "equation") return false;
          draw(n);
          return true;
        },
      };
    };
  },
});
export const Video = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      videoId: {
        default: "",
        parseHTML: (e) => e.getAttribute("data-video-id"),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-video-id]" }];
  },
  renderHTML({ node }) {
    return [
      "div",
      {
        "data-video-id": node.attrs.videoId,
        class: "editor-video-placeholder",
      },
      `▶ YouTube video · ${node.attrs.videoId}`,
    ];
  },
});
export const Contents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  parseHTML() {
    return [{ tag: "nav[data-contents]" }];
  },
  renderHTML() {
    return [
      "nav",
      { "data-contents": "true", class: "story-contents" },
      "Contents · Headings appear in the reading preview.",
    ];
  },
  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement("nav");
      dom.className = "story-contents";
      const draw = () => {
        dom.replaceChildren();
        const title = document.createElement("strong");
        title.textContent = "In this story";
        dom.append(title);
        const list = document.createElement("ol");
        editor.state.doc.descendants((node) => {
          if (node.type.name === "heading") {
            const li = document.createElement("li");
            li.textContent = node.textContent;
            list.append(li);
          }
        });
        if (!list.children.length) {
          const p = document.createElement("p");
          p.textContent = "Add headings to build your contents.";
          dom.append(p);
        } else dom.append(list);
      };
      draw();
      editor.on("update", draw);
      return {
        dom,
        destroy() {
          editor.off("update", draw);
        },
      };
    };
  },
});
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
