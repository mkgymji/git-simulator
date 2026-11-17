/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  markdown.js – náhled Markdownu (podmnožina z kurzu: nadpisy, odrážky,
 *  číslované seznamy, tučné písmo, kurzíva, odkazy, tabulky, citace)
 *  Výstup je bezpečné HTML (veškerý text se escapuje).
 * ===================================================================== */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inline(text) {
    var codes = [];
    var s = text.replace(/`([^`]+)`/g, function (m, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
      var h = href.replace(/&amp;/g, '&');
      if (/^(https?:|mailto:)/i.test(h)) return '<a href="' + esc(h) + '" target="_blank" rel="noopener">' + label + '</a>';
      if (/^[^:]+$/.test(h)) return '<a href="#" data-file="' + esc(h) + '">' + label + '</a>';
      return label;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[^\w_])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return '<code>' + esc(codes[+i]) + '</code>'; });
    return s;
  }

  function splitRow(line) {
    var t = line.trim();
    if (t.charAt(0) === '|') t = t.slice(1);
    if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function render(src) {
    var lines = src.replace(/\r/g, '').split('\n'), html = [], i = 0, para = [];
    function flush() { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^(<{7}|={7}|>{7})( .*)?$/.test(l)) {
        flush();
        html.push('<span class="conflict">' + esc(l) + '</span>');
        i++; continue;
      }
      if (/^\s*$/.test(l)) { flush(); i++; continue; }
      if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))) {
        flush();
        html.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>');
        i++; continue;
      }
      if (/^\s*>/.test(l)) {
        flush();
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        html.push('<blockquote>' + render(q.join('\n')) + '</blockquote>');
        continue;
      }
      if (/^\s*[-*+]\s+/.test(l)) {
        flush();
        var ul = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { ul.push('<li>' + inline(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>'); i++; }
        html.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(l)) {
        flush();
        var ol = [], start = parseInt(/^\s*(\d+)/.exec(l)[1], 10);
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { ol.push('<li>' + inline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>'); i++; }
        html.push('<ol' + (start !== 1 ? ' start="' + start + '"' : '') + '>' + ol.join('') + '</ol>');
        continue;
      }
      if (/\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
        flush();
        var head = splitRow(l), rows = [];
        i += 2;
        while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        var t = '<table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) {
          t += '<tr>' + head.map(function (h, k) { return '<td>' + inline(r[k] || '') + '</td>'; }).join('') + '</tr>';
        });
        html.push(t + '</tbody></table>');
        continue;
      }
      para.push(l.trim());
      i++;
    }
    flush();
    return html.join('\n');
  }

  root.GitMarkdown = { render: render, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
