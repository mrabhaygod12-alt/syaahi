import React, { type ReactNode } from "react";

function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g)
        .filter(Boolean)
        .map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return (
              <code key={i} className="ws-md-code">
                {part.slice(1, -1)}
              </code>
            );
          const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
          if (link)
            return (
              <a
                key={i}
                href={link[2]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link[1]}
              </a>
            );
          return part;
        })}
    </>
  );
}

/** Text-only Markdown: never evaluate model HTML, scripts or embedded images. */
export default function ChatAnswer({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n"),
    out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    const fence = line.match(/^(`{3,}|~{3,})([\w+-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      const end = new RegExp(`^${fence[1][0]}{${fence[1].length},}\\s*$`);
      while (i < lines.length && !end.test(lines[i].trim()))
        code.push(lines[i++]);
      if (i < lines.length) i++;
      out.push(
        <pre
          key={out.length}
          className="ws-md-pre"
          aria-label={fence[2] ? `${fence[2]} code example` : "Code example"}
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      out.push(
        <h3 key={out.length} className="ws-md-h">
          <Inline text={heading[1]} />
        </h3>,
      );
      i++;
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        const cells = lines[i++]
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
      }
      out.push(
        <div key={out.length} className="ws-md-table-scroll">
          <table className="ws-md-table">
            <thead>
              <tr>
                {rows[0]?.map((cell, k) => (
                  <th key={k}>
                    <Inline text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, k) => (
                <tr key={k}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const ordered = line.match(/^(\d+)[.)]\s+(.+)$/),
      bullet = line.match(/^[-*•]\s+(.+)$/);
    if (ordered || bullet) {
      const list: string[] = [],
        pattern = ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*•]\s+(.+)$/;
      while (i < lines.length) {
        const next = lines[i].trim().match(pattern);
        if (!next) break;
        list.push(next[1]);
        i++;
      }
      const items = list.map((item, k) => (
        <li key={k}>
          <Inline text={item} />
        </li>
      ));
      out.push(
        ordered ? (
          <ol key={out.length} start={Number(ordered[1])} className="ws-md-ul">
            {items}
          </ol>
        ) : (
          <ul key={out.length} className="ws-md-ul">
            {items}
          </ul>
        ),
      );
      continue;
    }
    out.push(
      <p key={out.length} className="ws-md-p">
        <Inline text={line} />
      </p>,
    );
    i++;
  }
  return <>{out}</>;
}
