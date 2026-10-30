import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { ActionCard } from './ActionCard';

/**
 * Lightweight Zero-Dependency Syntax Highlighting for Code Blocks
 */
function renderHighlightedCode(code, language) {
  if (!code) return '';
  const lines = code.split('\n');

  // Common keywords across JS, Python, SQL, HTML, CSS, Bash, C++, Go, Rust
  const tokenRegex = /(\/\/.*$|#.*$|--.*$|'[^']*'|"[^"]*"|`[^`]*`|\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|default|import|export|from|class|extends|new|this|async|await|try|catch|finally|throw|typeof|instanceof|def|elif|in|is|not|lambda|pass|with|as|yield|select|from|where|insert|update|delete|create|table|public|private|protected|static|void|int|float|double|string|bool|boolean)\b|\b(?:true|false|null|undefined|None|True|False|NaN)\b|\b\d+(?:\.\d+)?\b)/g;

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // Whole-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('--')) {
      return (
        <div key={lineIdx} className="code-line">
          <span className="syn-comment">{line}</span>
        </div>
      );
    }

    const tokens = [];
    let lastIdx = 0;
    let match;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        tokens.push(line.substring(lastIdx, match.index));
      }

      const val = match[0];
      const key = `${lineIdx}-${match.index}`;

      if (val.startsWith('//') || val.startsWith('#') || val.startsWith('--')) {
        tokens.push(<span key={key} className="syn-comment">{val}</span>);
      } else if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) {
        tokens.push(<span key={key} className="syn-string">{val}</span>);
      } else if (/^(?:true|false|null|undefined|None|True|False|NaN|\d+(?:\.\d+)?)$/.test(val)) {
        tokens.push(<span key={key} className="syn-constant">{val}</span>);
      } else {
        tokens.push(<span key={key} className="syn-keyword">{val}</span>);
      }

      lastIdx = tokenRegex.lastIndex;
    }

    if (lastIdx < line.length) {
      tokens.push(line.substring(lastIdx));
    }

    return (
      <div key={lineIdx} className="code-line">
        {tokens.length > 0 ? tokens : ' '}
      </div>
    );
  });
}

/**
 * ChatGPT-Grade Code Block Component
 */
export function CodeBlock({ language, code, isStreaming = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const displayLang = (language || 'code').toLowerCase().trim();

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{displayLang}</span>
        <button
          className="copy-code-btn"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          title="Copy code"
        >
          {copied ? (
            <>
              <FiCheck style={{ color: '#10b981' }} />
              <span style={{ color: '#10b981', fontWeight: 600 }}>Copied!</span>
            </>
          ) : (
            <>
              <FiCopy />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-content">
        <code>{renderHighlightedCode(code, displayLang)}</code>
      </pre>
      {isStreaming && <span className="typing-cursor" style={{ margin: '0 0 10px 14px' }} />}
    </div>
  );
}

/**
 * Recursive Inline Token Parser
 * Solves nested formatting bugs: **bold text with `inline code`** renders perfectly!
 */
export function parseInline(text) {
  if (!text || typeof text !== 'string') return text;

  // Order of tokens: inline code, bold-italic, bold, strikethrough, links, italic
  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|(?<=\s|^)_[^_]+_(?=\s|$))/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${match.index}-${token.slice(0, 8)}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key} className="inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('***') && token.endsWith('***')) {
      parts.push(
        <strong key={key}>
          <em>{parseInline(token.slice(3, -3))}</em>
        </strong>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      parts.push(
        <strong key={key}>
          {parseInline(token.slice(2, -2))}
        </strong>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(
        <del key={key}>
          {parseInline(token.slice(2, -2))}
        </del>
      );
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-markdown-link"
          >
            {parseInline(linkMatch[1])}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      parts.push(
        <em key={key}>
          {parseInline(token.slice(1, -1))}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Main MarkdownRenderer Component - ChatGPT Grade
 */
export function MarkdownRenderer({ content }) {
  if (!content) return null;

  // Extract <think>...</think> reasoning blocks (e.g. Qwen / DeepSeek)
  let cleanContent = content;
  let thinkContent = null;
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    thinkContent = thinkMatch[1].trim();
    cleanContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
  }

  // Block parsing: Split by completed code blocks, unclosed streaming code blocks, or Action Cards
  // Notice (?:```|$) allows unclosed code blocks during streaming to render smoothly!
  const blockRegex = /(?:```([a-zA-Z0-9_+#.-]*)\r?\n([\s\S]*?)(?:```|$)|:::action_card\r?\n([\s\S]*?):::)/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(cleanContent)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: 'text',
        content: cleanContent.substring(lastIndex, match.index)
      });
    }

    if (match[3] !== undefined) {
      blocks.push({
        type: 'action_card',
        rawData: match[3].trim()
      });
    } else {
      const isUnclosed = !match[0].endsWith('```') && match.index + match[0].length === cleanContent.length;
      blocks.push({
        type: 'code',
        language: match[1] || 'text',
        code: (match[2] || '').trimEnd(),
        isStreaming: isUnclosed
      });
    }

    lastIndex = blockRegex.lastIndex;
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
          <summary className="think-summary">💭 Reasoning Process {cleanContent ? '(Click to view)' : '...'}</summary>
          <div className="think-content">{thinkContent}</div>
        </details>
      )}

      {blocks.map((block, bIdx) => {
        if (block.type === 'action_card') {
          return <ActionCard key={`action-${bIdx}`} rawData={block.rawData} />;
        }

        if (block.type === 'code') {
          return (
            <CodeBlock
              key={`code-${bIdx}`}
              language={block.language}
              code={block.code}
              isStreaming={block.isStreaming}
            />
          );
        }

        // Parse regular text block for headings, lists, tables, quotes, paragraphs
        const lines = block.content.split(/\r?\n/);
        const elements = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];
          const trimmed = line.trim();

          if (!trimmed) {
            i++;
            continue;
          }

          // Horizontal rule (--- or ***)
          if (/^(\*\*\*|---|___)$/.test(trimmed)) {
            elements.push(<hr key={`hr-${bIdx}-${i}`} className="chat-markdown-hr" />);
            i++;
            continue;
          }

          // Headings (h1, h2, h3, h4)
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
          if (trimmed.startsWith('#### ')) {
            elements.push(<h4 key={`h4-${bIdx}-${i}`}>{parseInline(trimmed.slice(5))}</h4>);
            i++;
            continue;
          }

          // Blockquote (> ...)
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

          // Table detection (| col 1 | col 2 | ... followed by | --- | --- |)
          if (
            trimmed.startsWith('|') &&
            trimmed.endsWith('|') &&
            lines[i + 1] &&
            lines[i + 1].trim().startsWith('|') &&
            lines[i + 1].includes('---')
          ) {
            const tableHeaders = trimmed.split('|').slice(1, -1).map((h) => h.trim());
            i += 2; // skip header and separator row

            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
              const cells = lines[i].trim().split('|').slice(1, -1).map((c) => c.trim());
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

          // Unordered list (* , - , + )
          if (/^[*+-]\s/.test(trimmed)) {
            const listItems = [];
            while (i < lines.length && /^[*+-]\s/.test(lines[i].trim())) {
              listItems.push(lines[i].trim().replace(/^[*+-]\s/, ''));
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

          // Ordered list (1. , 2. , etc.)
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

          // Standard paragraph
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
