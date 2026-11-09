import { Fragment } from "react";

type InlineFormat = "plain" | "company" | "peer" | "person" | "product" | "positive" | "negative" | "bold";
type InlinePart = { text: string; format: InlineFormat };

function formatInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\[\[company\]\]([\s\S]*?)\[\[\/company\]\]|\[\[peer\]\]([\s\S]*?)\[\[\/peer\]\]|\[\[person\]\]([\s\S]*?)\[\[\/person\]\]|\[\[product\]\]([\s\S]*?)\[\[\/product\]\]|\[\[\+\]\]([\s\S]*?)\[\[\/\+\]\]|\[\[\-\]\]([\s\S]*?)\[\[\/\-\]\]|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), format: "plain" });
    if (match[1] !== undefined) parts.push({ text: match[1], format: "company" });
    else if (match[2] !== undefined) parts.push({ text: match[2], format: "peer" });
    else if (match[3] !== undefined) parts.push({ text: match[3], format: "person" });
    else if (match[4] !== undefined) parts.push({ text: match[4], format: "product" });
    else if (match[5] !== undefined) parts.push({ text: match[5], format: "positive" });
    else if (match[6] !== undefined) parts.push({ text: match[6], format: "negative" });
    else parts.push({ text: match[7] ?? "", format: "bold" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), format: "plain" });
  return parts;
}

function InlineText({ text }: { text: string }) {
  return <>{formatInline(text).map((part, index) => {
    const style = part.format === "peer"
      ? { color: "#f97316", fontWeight: 600 }
      : part.format === "person"
        ? { color: "#facc15", fontWeight: 600 }
        : part.format === "product"
          ? { color: "#7dd3fc", fontWeight: 600 }
          : part.format === "positive"
            ? { color: "var(--color-positive)", fontWeight: 600 }
            : part.format === "negative"
              ? { color: "var(--color-negative)", fontWeight: 600 }
              : undefined;
    if (part.format === "company" || part.format === "bold") return <strong key={index}>{part.text}</strong>;
    return <span key={index} style={style}>{part.text}</span>;
  })}</>;
}

type Block = { kind: "title" | "heading" | "paragraph" | "bullets"; lines: string[] };

/** Renders the small Markdown subset requested by the AI prompt plus inline color tags. */
export function AIFormattedText({ text }: { text: string }) {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: "bullets", lines: bullets });
    bullets = [];
  };

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }
    const title = trimmed.match(/^#\s+(.+)$/);
    const heading = trimmed.match(/^#{2,6}\s+(.+)$/);
    const bullet = trimmed.match(/^\s*[-*]\s+(.+)$/);
    if (title) {
      flushParagraph(); flushBullets();
      blocks.push({ kind: "title", lines: [title[1]] });
    } else if (heading) {
      flushParagraph(); flushBullets();
      blocks.push({ kind: "heading", lines: [heading[1]] });
    } else if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else {
      flushBullets();
      paragraph.push(trimmed);
    }
  }
  flushParagraph(); flushBullets();

  return <div className="space-y-2">
    {blocks.map((block, index) => {
      const content = block.lines.map((line, lineIndex) => <Fragment key={lineIndex}><InlineText text={line} />{lineIndex < block.lines.length - 1 ? " " : null}</Fragment>);
      if (block.kind === "title") return <h3 key={index} className="text-base font-bold leading-snug">{content}</h3>;
      if (block.kind === "heading") return <h4 key={index} className="pt-1 text-sm font-semibold leading-snug">{content}</h4>;
      if (block.kind === "bullets") return <ul key={index} className="list-disc space-y-1 pl-5">{block.lines.map((line, lineIndex) => <li key={lineIndex}><InlineText text={line} /></li>)}</ul>;
      return <p key={index} className="leading-relaxed">{content}</p>;
    })}
  </div>;
}
