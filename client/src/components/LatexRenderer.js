import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * LatexRenderer — renders a text string with inline ($...$) and block ($$...$$) math.
 *
 * Props:
 *   text  — raw string that may contain LaTeX expressions
 *   style — optional style object for the wrapper span
 */
export default function LatexRenderer({ text, style }) {
  const rendered = useMemo(() => {
    if (!text) return [];

    const parts = [];

    // Step 1: split by block math $$...$$
    const blockRegex = /\$\$([\s\S]+?)\$\$/g;
    let lastIdx = 0;
    let match;

    while ((match = blockRegex.exec(text)) !== null) {
      // Text before the block
      if (match.index > lastIdx) {
        parts.push({ type: 'text', content: text.slice(lastIdx, match.index) });
      }
      parts.push({ type: 'block', content: match[1] });
      lastIdx = match.index + match[0].length;
    }
    // Remaining text after last block
    if (lastIdx < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIdx) });
    }

    // Step 2: split "text" parts by inline math $...$
    const expanded = [];
    for (const part of parts) {
      if (part.type !== 'text') {
        expanded.push(part);
        continue;
      }
      // eslint-disable-next-line no-useless-escape
      const inlineRegex = /\$([^\$]+?)\$/g;
      let iLast = 0;
      let iMatch;
      while ((iMatch = inlineRegex.exec(part.content)) !== null) {
        if (iMatch.index > iLast) {
          expanded.push({ type: 'plain', content: part.content.slice(iLast, iMatch.index) });
        }
        expanded.push({ type: 'inline', content: iMatch[1] });
        iLast = iMatch.index + iMatch[0].length;
      }
      if (iLast < part.content.length) {
        expanded.push({ type: 'plain', content: part.content.slice(iLast) });
      }
    }

    return expanded;
  }, [text]);

  if (!text) return <span style={style}>{text}</span>;

  return (
    <span style={style}>
      {rendered.map((part, i) => {
        if (part.type === 'plain') {
          return <span key={i}>{part.content}</span>;
        }
        if (part.type === 'block' || part.type === 'inline') {
          try {
            const html = katex.renderToString(part.content, {
              displayMode: part.type === 'block',
              throwOnError: true,
            });
            return part.type === 'block' ? (
              <div key={i} dangerouslySetInnerHTML={{ __html: html }} style={{ margin: '8px 0' }} />
            ) : (
              <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
            );
          } catch {
            // Render raw expression in red on error
            return (
              <span key={i} style={{ color: '#f5365c', fontFamily: 'monospace' }}>
                {part.type === 'block' ? `$$${part.content}$$` : `$${part.content}$`}
              </span>
            );
          }
        }
        return null;
      })}
    </span>
  );
}
