// Lightweight Markdown → React renderer tailored for Polyforge legal docs.
// Handles: H1-H4, paragraphs, lists (ul/ol, incl. nested), blockquotes, tables,
// inline **bold**, *italic*, `code`, links, hr. Good enough for our 4 docs.

(function () {
  const { useMemo } = React;

  // ---------- inline ----------
  function renderInline(text, keyPrefix = '') {
    // Escape link text first by parsing tokens in a single pass.
    const out = [];
    let i = 0;
    let k = 0;
    const push = (node) => out.push(<React.Fragment key={keyPrefix + '-' + (k++)}>{node}</React.Fragment>);

    while (i < text.length) {
      // link [text](url)
      const linkMatch = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const [full, label, href] = linkMatch;
        const isExternal = /^https?:/.test(href);
        const isInternalDoc = /\.md(#.*)?$/.test(href);
        let finalHref = href;
        if (isInternalDoc) {
          // Map ./privacy-policy.md → Privacy.html, etc.
          finalHref = href
            .replace(/^\.\//, '')
            .replace(/^terms-of-service\.md/, 'Terms.html')
            .replace(/^privacy-policy\.md/, 'Privacy.html')
            .replace(/^cookie-policy\.md/, 'Cookies.html')
            .replace(/^risk-assessment\.md/, 'Risk Disclosure.html');
        }
        push(
          <a href={finalHref} {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}>
            {renderInline(label, keyPrefix + '-l' + k)}
          </a>
        );
        i += full.length;
        continue;
      }
      // bold **text**
      const boldMatch = text.slice(i).match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        push(<strong>{renderInline(boldMatch[1], keyPrefix + '-b' + k)}</strong>);
        i += boldMatch[0].length;
        continue;
      }
      // italic *text* or _text_ (but not inside words)
      const italicMatch = text.slice(i).match(/^(?:\*([^*\n]+)\*|_([^_\n]+)_)/);
      if (italicMatch) {
        const inner = italicMatch[1] || italicMatch[2];
        push(<em>{renderInline(inner, keyPrefix + '-i' + k)}</em>);
        i += italicMatch[0].length;
        continue;
      }
      // inline code `code`
      const codeMatch = text.slice(i).match(/^`([^`]+)`/);
      if (codeMatch) {
        push(<code>{codeMatch[1]}</code>);
        i += codeMatch[0].length;
        continue;
      }
      // plain char
      push(text[i]);
      i++;
    }
    return out;
  }

  // Detect ALL-CAPS disclaimer paragraphs (≥8 chars, mostly uppercase letters).
  function isAllCapsDisclaimer(text) {
    const letters = text.replace(/[^A-Za-z]/g, '');
    if (letters.length < 12) return false;
    const upper = text.replace(/[^A-Z]/g, '');
    return upper.length / letters.length > 0.85;
  }

  // ---------- block parse ----------
  // We split source into blocks by blank lines, then classify each.
  function parseMarkdown(source) {
    // Strip HTML comments like <!-- Last reviewed: ... -->
    source = source.replace(/<!--[\s\S]*?-->/g, '');
    const lines = source.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // blank
      if (!line.trim()) { i++; continue; }

      // horizontal rule
      if (/^---+\s*$/.test(line)) {
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }

      // heading
      const hm = line.match(/^(#{1,4})\s+(.+?)\s*$/);
      if (hm) {
        blocks.push({ type: 'heading', level: hm[1].length, text: hm[2] });
        i++;
        continue;
      }

      // blockquote
      if (line.startsWith('>')) {
        const buf = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          buf.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        blocks.push({ type: 'blockquote', text: buf.join('\n').trim() });
        continue;
      }

      // table (detect by | ... | with next line having --- separators)
      if (line.includes('|') && i + 1 < lines.length && /^[\s|:\-]+$/.test(lines[i + 1]) && lines[i + 1].includes('|')) {
        const header = splitTableRow(line);
        i += 2; // skip separator
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        blocks.push({ type: 'table', header, rows });
        continue;
      }

      // list (unordered or ordered). Collect lines until blank line that's not indented.
      if (/^(\s*)([-*+]|\d+\.)\s+/.test(line)) {
        const listLines = [];
        while (i < lines.length) {
          const l = lines[i];
          if (l.trim() === '') {
            // peek: if next non-blank is indented, include blank; else stop.
            const next = lines[i + 1];
            if (next && /^\s{2,}\S/.test(next)) { listLines.push(l); i++; continue; }
            break;
          }
          // stop on heading/hr/blockquote
          if (/^#{1,4}\s/.test(l) || /^---+$/.test(l) || /^>/.test(l)) break;
          listLines.push(l);
          i++;
        }
        blocks.push({ type: 'list', items: parseList(listLines) });
        continue;
      }

      // paragraph — consume until blank or block start
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i]) && !/^---+\s*$/.test(lines[i]) && !/^>/.test(lines[i]) && !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'paragraph', text: buf.join(' ').trim() });
    }

    return blocks;
  }

  function splitTableRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  }

  // Parse a list into a tree of items. Supports nesting by indent (2+ spaces).
  function parseList(lines) {
    // Flatten: each entry = { indent, ordered, text }
    const entries = [];
    for (const raw of lines) {
      if (!raw.trim()) continue;
      const m = raw.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      if (m) {
        entries.push({ indent: m[1].length, ordered: /\d+\./.test(m[2]), text: m[3] });
      } else if (entries.length) {
        // continuation line → append to previous
        entries[entries.length - 1].text += ' ' + raw.trim();
      }
    }
    // Build tree
    const root = [];
    const stack = [{ indent: -1, children: root }];
    for (const e of entries) {
      while (stack.length && e.indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1];
      const node = { text: e.text, ordered: e.ordered, children: [] };
      parent.children.push(node);
      stack.push({ indent: e.indent, children: node.children });
    }
    return root;
  }

  // ---------- rendering ----------
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
  }

  function renderList(items, ordered, keyPrefix) {
    const Tag = ordered ? 'ol' : 'ul';
    return (
      <Tag>
        {items.map((item, idx) => (
          <li key={keyPrefix + '-' + idx}>
            {renderInline(item.text, keyPrefix + '-' + idx)}
            {item.children.length > 0 && renderList(item.children, item.children[0].ordered, keyPrefix + '-' + idx + '-c')}
          </li>
        ))}
      </Tag>
    );
  }

  function MarkdownDoc({ source, skipFirstH1 = true, skipTOC = true }) {
    const blocks = useMemo(() => parseMarkdown(source), [source]);

    const rendered = [];
    let skippedH1 = false;
    let skippingTOC = false;

    blocks.forEach((b, idx) => {
      const key = 'b-' + idx;

      if (skippingTOC) {
        // skip until next H2
        if (b.type === 'heading' && b.level === 2) skippingTOC = false;
        else return;
      }

      if (b.type === 'heading') {
        if (b.level === 1 && skipFirstH1 && !skippedH1) { skippedH1 = true; return; }
        if (b.level === 2 && skipTOC && /^table of contents$/i.test(b.text.trim())) {
          skippingTOC = true;
          return;
        }
        const slug = slugify(b.text);
        // Extract leading section number for hanging numeral
        const numMatch = b.text.match(/^(\d+(?:\.\d+)*)\.?\s+(.+)$/);
        const number = numMatch ? numMatch[1] : null;
        const title = numMatch ? numMatch[2] : b.text;
        const HeadingTag = 'h' + b.level;
        rendered.push(
          <HeadingTag key={key} id={slug} data-h-level={b.level}>
            {number && b.level === 2 && <span className="legal-h-num">{number}</span>}
            <span className="legal-h-text">{renderInline(title, key)}</span>
            <a className="legal-anchor" href={'#' + slug} aria-label="Link to section" tabIndex={-1}>#</a>
          </HeadingTag>
        );
        return;
      }

      if (b.type === 'hr') {
        rendered.push(<hr key={key} />);
        return;
      }

      if (b.type === 'paragraph') {
        const isCaps = isAllCapsDisclaimer(b.text);
        rendered.push(
          <p key={key} className={isCaps ? 'legal-disclaimer' : undefined}>
            {renderInline(b.text, key)}
          </p>
        );
        return;
      }

      if (b.type === 'blockquote') {
        // Detect "tone" — risk/warning vs neutral — by keywords
        const lower = b.text.toLowerCase();
        const isWarn = /\b(warning|important|risk|caution|must not|prohibited)\b/.test(lower);
        rendered.push(
          <blockquote key={key} className={isWarn ? 'legal-callout legal-callout-warn' : 'legal-callout'}>
            {b.text.split(/\n{2,}/).map((para, pi) => (
              <p key={pi}>{renderInline(para.replace(/\n/g, ' '), key + '-' + pi)}</p>
            ))}
          </blockquote>
        );
        return;
      }

      if (b.type === 'list') {
        const ordered = b.items[0]?.ordered;
        rendered.push(
          <React.Fragment key={key}>
            {renderList(b.items, ordered, key)}
          </React.Fragment>
        );
        return;
      }

      if (b.type === 'table') {
        rendered.push(
          <div key={key} className="legal-table-wrap">
            <table className="legal-table">
              <thead>
                <tr>{b.header.map((h, ci) => <th key={ci}>{renderInline(h, key + '-h' + ci)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c, key + '-c' + ri + '-' + ci)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        return;
      }
    });

    return <div className="legal-prose">{rendered}</div>;
  }

  // Build TOC (flat list of H2s with slug + number)
  function buildTOC(source) {
    const blocks = parseMarkdown(source);
    let inTOC = false;
    const toc = [];
    for (const b of blocks) {
      if (b.type !== 'heading') continue;
      if (b.level === 2 && /^table of contents$/i.test(b.text.trim())) { inTOC = true; continue; }
      if (inTOC && b.level === 2) inTOC = false;
      if (inTOC) continue;
      if (b.level === 2) {
        const m = b.text.match(/^(\d+(?:\.\d+)*)\.?\s+(.+)$/);
        toc.push({
          slug: slugify(b.text),
          number: m ? m[1] : null,
          title: m ? m[2] : b.text,
        });
      }
    }
    return toc;
  }

  // Reading time (avg 220 wpm)
  function readingTime(source) {
    const words = source.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 220));
  }

  Object.assign(window, { MarkdownDoc, buildTOC, readingTime, parseMarkdown });
})();
