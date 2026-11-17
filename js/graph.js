/*
 * Git simulátor – https://github.com/mkgymji/git-simulator
 * Copyright (C) 2026 Michal Kočer
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 (see LICENSE).
 *
 * Obsahuje kód převzatý z Gitu 2.47.1 (https://github.com/git/git), GPL-2.0:
 *   graph.c, commit.c (sort_in_topological_order) – přispěvatelé Gitu
 * Zdroje a autorská práva: ZDROJE.md
 */
/* =====================================================================
 *  graph.js – git log --graph
 *
 *  Věrný převod graph.c z Gitu 2.47 (stavový automat sloupců a čar)
 *  a pořadí commitů podle sort_in_topological_order (commit.c).
 *  Chobotnicové merge (víc než 2 rodiče) simulátor nevytváří, kód je
 *  ale převzatý celý.
 * ===================================================================== */
(function (root) {
  'use strict';

  // barvy sloupců jako column_colors_ansi v Gitu
  var COLORS = ['r', 'g', 'y', 'u', 'm', 'c', 'br', 'bg', 'by', 'bu', 'bm', 'bc'];
  var MAXC = COLORS.length;

  var PADDING = 0, SKIP = 1, PRE_COMMIT = 2, COMMIT = 3, POST_MERGE = 4, COLLAPSING = 5;

  // Pořadí commitů pro --graph (topologické, "graph order")
  function topoOrder(w, dateOrder) {
    var indeg = Object.create(null), stack = [], out = [];
    dateOrder.forEach(function (h) { indeg[h] = 1; });
    dateOrder.forEach(function (h) {
      w.commits[h].parents.forEach(function (p) { if (indeg[p]) indeg[p]++; });
    });
    dateOrder.forEach(function (h) { if (indeg[h] === 1) stack.push(h); });
    stack.reverse();
    while (stack.length) {
      var c = stack.pop();
      w.commits[c].parents.forEach(function (p) {
        if (!indeg[p]) return;
        if (--indeg[p] === 1) stack.push(p);
      });
      indeg[c] = 0;
      out.push(c);
    }
    return out;
  }

  function Graph(w, shown) {
    this.w = w;
    this.shown = shown;              // commity, které se vypisují (rodiče mimo výpis se nekreslí)
    this.commit = null;
    this.numParents = 0;
    this.expansionRow = 0;
    this.state = PADDING;
    this.prevState = PADDING;
    this.commitIndex = 0;
    this.prevCommitIndex = 0;
    this.mergeLayout = 0;
    this.edgesAdded = 0;
    this.prevEdgesAdded = 0;
    this.width = 0;
    this.columns = [];
    this.newColumns = [];
    this.mapping = [];
    this.oldMapping = [];
    this.mappingSize = 0;
    this.defaultColor = MAXC - 1;
  }

  Graph.prototype.parents = function () {
    var self = this;
    return this.w.commits[this.commit].parents.filter(function (p) { return self.shown[p]; });
  };

  // řádek = pole úseků [text, barva]
  function Line() { this.segs = []; this.width = 0; }
  Line.prototype.add = function (s, color) {
    var last = this.segs[this.segs.length - 1];
    if (last && last[1] === (color || '')) last[0] += s;
    else this.segs.push([s, color || '']);
    this.width += s.length;
  };
  Line.prototype.col = function (c, ch) { this.add(ch, c.color < MAXC ? COLORS[c.color] : ''); };

  Graph.prototype.incColor = function () { this.defaultColor = (this.defaultColor + 1) % MAXC; };
  Graph.prototype.findCommitColor = function (commit) {
    for (var i = 0; i < this.columns.length; i++) if (this.columns[i].commit === commit) return this.columns[i].color;
    return this.defaultColor;
  };
  Graph.prototype.findNewColumn = function (commit) {
    for (var i = 0; i < this.newColumns.length; i++) if (this.newColumns[i].commit === commit) return i;
    return -1;
  };

  Graph.prototype.insertIntoNewColumns = function (commit, idx) {
    var i = this.findNewColumn(commit), mappingIdx;
    if (i < 0) {
      i = this.newColumns.length;
      this.newColumns.push({ commit: commit, color: this.findCommitColor(commit) });
    }
    if (this.numParents > 1 && idx > -1 && this.mergeLayout === -1) {
      var dist = idx - i, shift = (dist > 1) ? 2 * dist - 3 : 1;
      this.mergeLayout = (dist > 0) ? 0 : 1;
      this.edgesAdded = this.numParents + this.mergeLayout - 2;
      mappingIdx = this.width + (this.mergeLayout - 1) * shift;
      this.width += 2 * this.mergeLayout;
    } else if (this.edgesAdded > 0 && i === this.mapping[this.width - 2]) {
      mappingIdx = this.width - 2;
      this.edgesAdded = -1;
    } else {
      mappingIdx = this.width;
      this.width += 2;
    }
    this.mapping[mappingIdx] = i;
  };

  Graph.prototype.updateColumns = function () {
    var i, seenThis = false, inColumns = true, self = this;
    this.columns = this.newColumns;
    this.newColumns = [];
    var maxNew = this.columns.length + this.numParents;
    this.mappingSize = 2 * maxNew;
    this.mapping = [];
    for (i = 0; i < this.mappingSize; i++) this.mapping[i] = -1;
    this.width = 0;
    this.prevEdgesAdded = this.edgesAdded;
    this.edgesAdded = 0;
    var n = this.columns.length;
    for (i = 0; i <= n; i++) {
      var colCommit;
      if (i === n) {
        if (seenThis) break;
        inColumns = false;
        colCommit = this.commit;
      } else colCommit = this.columns[i].commit;
      if (colCommit === this.commit) {
        seenThis = true;
        this.commitIndex = i;
        this.mergeLayout = -1;
        var ps = this.parents();
        for (var q = 0; q < ps.length; q++) {
          if (self.numParents > 1 || !inColumns) self.incColor();
          self.insertIntoNewColumns(ps[q], i);
        }
        if (this.numParents === 0) this.width += 2;
      } else {
        this.insertIntoNewColumns(colCommit, -1);
      }
    }
    while (this.mappingSize > 1 && this.mapping[this.mappingSize - 1] < 0) this.mappingSize--;
  };

  Graph.prototype.numDashedParents = function () { return this.numParents + this.mergeLayout - 3; };
  Graph.prototype.numExpansionRows = function () { return this.numDashedParents() * 2; };
  Graph.prototype.needsPreCommitLine = function () {
    return this.numParents >= 3 && this.commitIndex < this.columns.length - 1 &&
      this.expansionRow < this.numExpansionRows();
  };

  Graph.prototype.update = function (commit) {
    this.commit = commit;
    this.numParents = this.parents().length;
    this.prevCommitIndex = this.commitIndex;
    this.updateColumns();
    this.expansionRow = 0;
    if (this.state !== PADDING) this.state = SKIP;
    else if (this.needsPreCommitLine()) this.state = PRE_COMMIT;
    else this.state = COMMIT;
  };

  Graph.prototype.setState = function (s) { this.prevState = this.state; this.state = s; };

  Graph.prototype.mappingCorrect = function () {
    for (var i = 0; i < this.mappingSize; i++) {
      var t = this.mapping[i];
      if (t < 0) continue;
      if (t === Math.floor(i / 2)) continue;
      return false;
    }
    return true;
  };

  Graph.prototype.padLine = function (line) {
    if (line.width < this.width) line.add(new Array(this.width - line.width + 1).join(' '));
  };

  Graph.prototype.outPadding = function (line) {
    for (var i = 0; i < this.newColumns.length; i++) { line.col(this.newColumns[i], '|'); line.add(' '); }
  };

  Graph.prototype.outSkip = function (line) {
    line.add('...');
    this.setState(this.needsPreCommitLine() ? PRE_COMMIT : COMMIT);
  };

  Graph.prototype.outPreCommit = function (line) {
    var seenThis = false;
    for (var i = 0; i < this.columns.length; i++) {
      var col = this.columns[i];
      if (col.commit === this.commit) {
        seenThis = true;
        line.col(col, '|');
        line.add(new Array(this.expansionRow + 1).join(' '));
      } else if (seenThis && this.expansionRow === 0) {
        if (this.prevState === POST_MERGE && this.prevCommitIndex < i) line.col(col, '\\');
        else line.col(col, '|');
      } else if (seenThis && this.expansionRow > 0) line.col(col, '\\');
      else line.col(col, '|');
      line.add(' ');
    }
    this.expansionRow++;
    if (!this.needsPreCommitLine()) this.setState(COMMIT);
  };

  Graph.prototype.drawOctopus = function (line) {
    var dashed = this.numDashedParents();
    for (var i = 0; i < dashed; i++) {
      var j = this.mapping[(this.commitIndex + i + 2) * 2], col = this.newColumns[j];
      line.col(col, '-');
      line.col(col, (i === dashed - 1) ? '.' : '-');
    }
  };

  Graph.prototype.outCommit = function (line) {
    var seenThis = false, n = this.columns.length;
    for (var i = 0; i <= n; i++) {
      var col = this.columns[i], colCommit;
      if (i === n) {
        if (seenThis) break;
        colCommit = this.commit;
      } else colCommit = col.commit;
      if (colCommit === this.commit) {
        seenThis = true;
        line.add('*');
        if (this.numParents > 2) this.drawOctopus(line);
      } else if (seenThis && this.edgesAdded > 1) line.col(col, '\\');
      else if (seenThis && this.edgesAdded === 1) {
        if (this.prevState === POST_MERGE && this.prevEdgesAdded > 0 && this.prevCommitIndex < i) line.col(col, '\\');
        else line.col(col, '|');
      } else if (this.prevState === COLLAPSING && this.oldMapping[2 * i + 1] === i && this.mapping[2 * i] < i) {
        line.col(col, '/');
      } else line.col(col, '|');
      line.add(' ');
    }
    if (this.numParents > 1) this.setState(POST_MERGE);
    else if (this.mappingCorrect()) this.setState(PADDING);
    else this.setState(COLLAPSING);
  };

  var MERGE_CHARS = ['/', '|', '\\'];

  Graph.prototype.outPostMerge = function (line) {
    var seenThis = false, n = this.columns.length, parents = this.parents(), parentCol = null;
    for (var i = 0; i <= n; i++) {
      var col = this.columns[i], colCommit;
      if (i === n) {
        if (seenThis) break;
        colCommit = this.commit;
      } else colCommit = col.commit;
      if (colCommit === this.commit) {
        var idx = this.mergeLayout;
        seenThis = true;
        for (var j = 0; j < this.numParents; j++) {
          var pc = this.findNewColumn(parents[j]);
          line.col(this.newColumns[pc], MERGE_CHARS[idx]);
          if (idx === 2) {
            if (this.edgesAdded > 0 || j < this.numParents - 1) line.add(' ');
          } else idx++;
        }
        if (this.edgesAdded === 0) line.add(' ');
      } else if (seenThis) {
        line.col(col, this.edgesAdded > 0 ? '\\' : '|');
        line.add(' ');
      } else {
        line.col(col, '|');
        if (this.mergeLayout !== 0 || i !== this.commitIndex - 1) {
          if (parentCol) line.col(parentCol, '_');
          else line.add(' ');
        }
      }
      if (colCommit === parents[0]) parentCol = col;
    }
    this.setState(this.mappingCorrect() ? PADDING : COLLAPSING);
  };

  Graph.prototype.outCollapsing = function (line) {
    var i, j, usedHorizontal = false, hEdge = -1, hTarget = -1, t;
    var tmp = this.mapping; this.mapping = this.oldMapping; this.oldMapping = tmp;
    for (i = 0; i < this.mappingSize; i++) this.mapping[i] = -1;
    for (i = 0; i < this.mappingSize; i++) {
      t = this.oldMapping[i];
      if (t === undefined || t < 0) continue;
      if (t * 2 === i) this.mapping[i] = t;
      else if (!(this.mapping[i - 1] >= 0)) {
        this.mapping[i - 1] = t;
        if (hEdge === -1) {
          hEdge = i; hTarget = t;
          for (j = t * 2 + 3; j < i - 2; j += 2) this.mapping[j] = t;
        }
      } else if (this.mapping[i - 1] === t) {
        /* nic */
      } else {
        this.mapping[i - 2] = t;
        if (hEdge === -1) {
          hTarget = t; hEdge = i - 1;
          for (j = t * 2 + 3; j < i - 2; j += 2) this.mapping[j] = t;
        }
      }
    }
    this.oldMapping = this.mapping.slice(0, this.mappingSize);
    if (this.mapping[this.mappingSize - 1] < 0) this.mappingSize--;
    for (i = 0; i < this.mappingSize; i++) {
      t = this.mapping[i];
      if (t < 0) line.add(' ');
      else if (t * 2 === i) line.col(this.newColumns[t], '|');
      else if (t === hTarget && i !== hEdge - 1) {
        if (i !== t * 2 + 3) this.mapping[i] = -1;
        usedHorizontal = true;
        line.col(this.newColumns[t], '_');
      } else {
        if (usedHorizontal && i < hEdge) this.mapping[i] = -1;
        line.col(this.newColumns[t], '/');
      }
    }
    if (this.mappingCorrect()) this.setState(PADDING);
  };

  // jeden řádek grafu; vrací {segs, commit: true pokud jde o řádek s commitem}
  Graph.prototype.nextLine = function () {
    var line = new Line(), shown = false;
    switch (this.state) {
      case PADDING: this.outPadding(line); break;
      case SKIP: this.outSkip(line); break;
      case PRE_COMMIT: this.outPreCommit(line); break;
      case COMMIT: this.outCommit(line); shown = true; break;
      case POST_MERGE: this.outPostMerge(line); break;
      case COLLAPSING: this.outCollapsing(line); break;
    }
    this.padLine(line);
    return { segs: line.segs, commit: shown };
  };

  Graph.prototype.paddingLine = function () {
    if (this.state !== COMMIT) return this.nextLine().segs;
    var line = new Line();
    for (var i = 0; i < this.columns.length; i++) {
      var col = this.columns[i];
      line.col(col, '|');
      if (col.commit === this.commit && this.numParents > 2) line.add(new Array((this.numParents - 2) * 2 + 1).join(' '));
      else line.add(' ');
    }
    this.padLine(line);
    this.prevState = PADDING;
    return line.segs;
  };

  function join(a, b) {
    var out = a.slice();
    b.forEach(function (s) {
      var last = out[out.length - 1];
      if (last && last[1] === s[1]) out[out.length - 1] = [last[0] + s[0], s[1]];
      else out.push(s);
    });
    return out;
  }

  // dateOrder: commity v pořadí git log (podle data); entry(hash) vrací řádky záznamu
  function render(w, dateOrder, max, entry, oneline) {
    var order = topoOrder(w, dateOrder);
    var shown = Object.create(null);
    order.forEach(function (h) { shown[h] = true; });
    if (max >= 0) order = order.slice(0, max);
    var g = new Graph(w, shown), out = [];
    order.forEach(function (hash, idx) {
      g.update(hash);
      if (!oneline && idx > 0) out.push(g.paddingLine());
      var r;
      for (;;) {
        r = g.nextLine();
        if (r.commit) break;
        out.push(r.segs);
      }
      var lines = entry(hash);
      out.push(join(r.segs, lines[0]));
      for (var k = 1; k < lines.length; k++) out.push(join(g.nextLine().segs, lines[k]));
      while (g.state !== PADDING) out.push(g.nextLine().segs);
    });
    return out;
  }

  // Jednoduchá struktura grafu pro kreslení v prohlížeči: pro každý commit
  // sloupec a barva (stejné jako v git log --graph).
  root.GitGraph = { render: render, topoOrder: topoOrder, COLORS: COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
