
import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

export function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{language || 'code'}</span>
        <button
          className="copy-code-btn"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          title="Copy code"
        >
          {copied ? (
            <>
              <FiCheck style={{ color: '#10b981' }} />
              <span style={{ color: '#10b981' }}>Copied!</span>
            </>
          ) : (
            <>
              <FiCopy />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-content">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Parses inline elements: bold, italic, inline code, links
function parseInline(text) {
  if (!text) return null;

  // Split by inline code first: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    // Process bold, italic, and links within text
    // Replace **bold**
    const tokens = [];
    let remaining = part;
    let keyIdx = 0;

    // Regex for bold **...**, italic *...* or _..._, link [...](...)
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(remaining.substring(lastIndex, match.index));
      }

      const matchText = match[0];
      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        tokens.push(
          <strong key={`${index}-${keyIdx++}`}>
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (
        (matchText.startsWith('*') && matchText.endsWith('*')) ||
        (matchText.startsWith('_') && matchText.endsWith('_'))
      ) {
        tokens.push(
          <em key={`${index}-${keyIdx++}`}>
            {matchText.slice(1, -1)}
          </em>
        );
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const linkMatch = matchText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          tokens.push(
            <a
              key={`${index}-${keyIdx++}`}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
            >
              {linkMatch[1]}
            </a>
          );
        } else {
          tokens.push(matchText);
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < remaining.length) {
      tokens.push(remaining.substring(lastIndex));
    }

    return <React.Fragment key={index}>{tokens}</React.Fragment>;
  });
}

export function MarkdownRenderer({ content }) {
  if (!content) return null;

  // Extract <think>...</think> if present (common in Qwen / DeepSeek reasoning models)
  let cleanContent = content;
  let thinkContent = null;
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    thinkContent = thinkMatch[1].trim();
    cleanContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
  }

  // Block parsing: split by code blocks ```...```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(cleanContent)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: cleanContent.substring(lastIndex, match.index)
      });
    }

    blocks.push({
      type: 'code',
      language: match[1] || 'text',
      code: match[2].trimEnd()
    });

    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < cleanContent.length) {
    blocks.push({
      type: 'text',
      content: cleanContent.substring(lastIndex)
    });
  }

  return (
    <div className="markdown-render-flow">
      {thinkContent && (
        <details className="think-box" open={!cleanContent}>
          <summary className="think-summary">💭 Thinking Process {cleanContent ? '(Click to view)' : '...'}</summary>
          <div className="think-content">{thinkContent}</div>
        </details>
      )}
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={`code-${bIdx}`}
              language={block.language}
              code={block.code}
            />
          );
        }

        // Parse regular text block for headings, lists, tables, quotes, paragraphs
        const lines = block.content.split('\n');
        const elements = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];
          const trimmed = line.trim();

          if (!trimmed) {
            i++;
            continue;
          }

          // Horizontal rule
          if (trimmed === '---' || trimmed === '***') {
            elements.push(<hr key={`hr-${bIdx}-${i}`} style={{ margin: '18px 0', border: 'none', borderTop: '1px solid var(--border-subtle)' }} />);
            i++;
            continue;
          }

          // Headings
          if (trimmed.startsWith('# ')) {
            elements.push(<h1 key={`h1-${bIdx}-${i}`}>{parseInline(trimmed.slice(2))}</h1>);
            i++;
            continue;
          }
          if (trimmed.startsWith('## ')) {
            elements.push(<h2 key={`h2-${bIdx}-${i}`}>{parseInline(trimmed.slice(3))}</h2>);
            i++;
            continue;
          }
          if (trimmed.startsWith('### ')) {
            elements.push(<h3 key={`h3-${bIdx}-${i}`}>{parseInline(trimmed.slice(4))}</h3>);
            i++;
            continue;
          }

          // Blockquote
          if (trimmed.startsWith('> ')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].trim().startsWith('> ')) {
              quoteLines.push(lines[i].trim().slice(2));
              i++;
            }
            elements.push(
              <blockquote key={`quote-${bIdx}-${i}`}>
                {parseInline(quoteLines.join(' '))}
              </blockquote>
            );
            continue;
          }

          // Table detection (| col 1 | col 2 |)
          if (trimmed.startsWith('|') && trimmed.endsWith('|') && lines[i + 1] && lines[i + 1].includes('---')) {
            const tableHeaders = trimmed.split('|').slice(1, -1).map(h => h.trim());
            i += 2; // skip header and delimiter

            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
              const cells = lines[i].trim().split('|').slice(1, -1).map(c => c.trim());
              rows.push(cells);
              i++;
            }

            elements.push(
              <div key={`table-${bIdx}-${i}`} className="table-responsive-container">
                <table className="message-table">
                  <thead>
                    <tr>
                      {tableHeaders.map((head, hIdx) => (
                        <th key={hIdx}>{parseInline(head)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((rowCells, rIdx) => (
                      <tr key={rIdx}>
                        {rowCells.map((cell, cIdx) => (
                          <td key={cIdx}>{parseInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            continue;
          }

          // Unordered list
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const listItems = [];
            while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
              listItems.push(lines[i].trim().slice(2));
              i++;
            }
            elements.push(
              <ul key={`ul-${bIdx}-${i}`}>
                {listItems.map((item, lIdx) => (
                  <li key={lIdx}>{parseInline(item)}</li>
                ))}
              </ul>
            );
            continue;
          }

          // Ordered list
          if (/^\d+\.\s/.test(trimmed)) {
            const listItems = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
              listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
              i++;
            }
            elements.push(
              <ol key={`ol-${bIdx}-${i}`}>
                {listItems.map((item, lIdx) => (
                  <li key={lIdx}>{parseInline(item)}</li>
                ))}
              </ol>
            );
            continue;
          }

          // Paragraph
          elements.push(
            <p key={`p-${bIdx}-${i}`}>
              {parseInline(trimmed)}
            </p>
          );
          i++;
        }

        return <React.Fragment key={`block-${bIdx}`}>{elements}</React.Fragment>;
      })}
    </div>
  );
}

