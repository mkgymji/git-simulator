/* =====================================================================
 *  text.js – práce s textem tak, jak ji dělá Git
 *
 *  - UTF-8 a SHA-1 (hashe objektů jsou skutečné gitové hashe)
 *  - diff řádků: Myersův algoritmus podle knihovny xdiff v Gitu
 *    (včetně úklidu řádků před porovnáním a posouvání skupin změn),
 *    histogramový diff (Git ho používá při slučování)
 *  - výpis ve tvaru "unified diff" (git diff)
 *  - třícestné sloučení souboru se značkami konfliktu (git merge)
 *
 *  Bez závislosti na prohlížeči – stejný soubor běží i v testech.
 * ===================================================================== */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------
  //  UTF-8
  // ------------------------------------------------------------------
  function utf8(str) {
    var out = [], i, c, c2;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function utf8Length(str) { return utf8(str).length; }

  // ------------------------------------------------------------------
  //  SHA-1 nad polem bajtů, výsledek jako 40 hexadecimálních znaků
  // ------------------------------------------------------------------
  function sha1(bytes) {
    var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    var len = bytes.length, msg = bytes.slice(), i, j, w = new Array(80);
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hi = Math.floor((len * 8) / 4294967296), lo = (len * 8) >>> 0;
    msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    msg.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    function rol(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }
    for (i = 0; i < msg.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = ((msg[i + 4 * j] << 24) | (msg[i + 4 * j + 1] << 16) | (msg[i + 4 * j + 2] << 8) | msg[i + 4 * j + 3]) >>> 0;
      }
      for (j = 16; j < 80; j++) w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      var a = h0, b = h1, c = h2, d = h3, e = h4, f, k, t;
      for (j = 0; j < 80; j++) {
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        t = (rol(a, 5) + (f >>> 0) + e + k + w[j]) >>> 0;
        e = d; d = c; c = rol(b, 30); b = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    function hex(x) { return ('00000000' + x.toString(16)).slice(-8); }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
  }

  function hexToBytes(hex) {
    var out = [], i;
    for (i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
    return out;
  }

  // ------------------------------------------------------------------
  //  Řádky: každý řádek včetně svého "\n" (poslední může být bez něj)
  // ------------------------------------------------------------------
  function splitLines(text) {
    var out = [], i = 0, j;
    while (i < text.length) {
      j = text.indexOf('\n', i);
      if (j < 0) { out.push(text.slice(i)); break; }
      out.push(text.slice(i, j + 1));
      i = j + 1;
    }
    return out;
  }

  // Přidělí stejným řádkům stejné číslo (v obou souborech společně).
  function classify(a, b) {
    var map = Object.create(null), next = 0, ha = new Array(a.length), hb = new Array(b.length), i, key;
    for (i = 0; i < a.length; i++) {
      key = '$' + a[i];
      if (!(key in map)) map[key] = next++;
      ha[i] = map[key];
    }
    for (i = 0; i < b.length; i++) {
      key = '$' + b[i];
      if (!(key in map)) map[key] = next++;
      hb[i] = map[key];
    }
    return { ha: ha, hb: hb, count: next };
  }

  function bogosqrt(n) {
    var i = 1;
    for (; n > 0; n = Math.floor(n / 4)) i *= 2;
    return i;
  }

  // ------------------------------------------------------------------
  //  Myersův diff podle xdiff (xprepare.c + xdiffi.c)
  //  Vrací dvě pole příznaků: který řádek z a zmizel, který v b přibyl.
  // ------------------------------------------------------------------
  var KPDIS_RUN = 4, SIMSCAN_WINDOW = 100, MAX_EQLIMIT = 1024, LINE_MAX = 0x7fffffff;

  function cleanMmatch(dis, i, s, e) {
    var r, rdis0, rpdis0, rdis1, rpdis1;
    if (i - s > SIMSCAN_WINDOW) s = i - SIMSCAN_WINDOW;
    if (e - i > SIMSCAN_WINDOW) e = i + SIMSCAN_WINDOW;
    for (r = 1, rdis0 = 0, rpdis0 = 1; (i - r) >= s; r++) {
      if (!dis[i - r]) rdis0++;
      else if (dis[i - r] === 2) rpdis0++;
      else break;
    }
    if (rdis0 === 0) return false;
    for (r = 1, rdis1 = 0, rpdis1 = 1; (i + r) <= e; r++) {
      if (!dis[i + r]) rdis1++;
      else if (dis[i + r] === 2) rpdis1++;
      else break;
    }
    if (rdis1 === 0) return false;
    rdis1 += rdis0;
    rpdis1 += rpdis0;
    return rpdis1 * KPDIS_RUN < (rpdis1 + rdis1);
  }

  function myersFlags(ha, hb, classCount) {
    var n1 = ha.length, n2 = hb.length, i, lim;
    var c1 = new Array(n1 + 1), c2 = new Array(n2 + 1);
    for (i = 0; i <= n1; i++) c1[i] = 0;
    for (i = 0; i <= n2; i++) c2[i] = 0;

    // počty výskytů každého řádku v obou souborech
    var len1 = new Array(classCount), len2 = new Array(classCount);
    for (i = 0; i < classCount; i++) { len1[i] = 0; len2[i] = 0; }
    for (i = 0; i < n1; i++) len1[ha[i]]++;
    for (i = 0; i < n2; i++) len2[hb[i]]++;

    // společný začátek a konec
    lim = Math.min(n1, n2);
    for (i = 0; i < lim; i++) if (ha[i] !== hb[i]) break;
    var dstart1 = i, dstart2 = i;
    lim -= i;
    for (i = 0; i < lim; i++) if (ha[n1 - 1 - i] !== hb[n2 - 1 - i]) break;
    var dend1 = n1 - i - 1, dend2 = n2 - i - 1;

    // úklid: řádky bez protějšku jsou rovnou změna
    var dis1 = new Array(n1 + 2), dis2 = new Array(n2 + 2), nm;
    for (i = 0; i < n1 + 2; i++) dis1[i] = 0;
    for (i = 0; i < n2 + 2; i++) dis2[i] = 0;
    var mlim = Math.min(bogosqrt(n1), MAX_EQLIMIT);
    for (i = dstart1; i <= dend1; i++) {
      nm = len2[ha[i]];
      dis1[i] = (nm === 0) ? 0 : (nm >= mlim) ? 2 : 1;
    }
    mlim = Math.min(bogosqrt(n2), MAX_EQLIMIT);
    for (i = dstart2; i <= dend2; i++) {
      nm = len1[hb[i]];
      dis2[i] = (nm === 0) ? 0 : (nm >= mlim) ? 2 : 1;
    }
    var rindex1 = [], rindex2 = [], r1 = [], r2 = [];
    for (i = dstart1; i <= dend1; i++) {
      if (dis1[i] === 1 || (dis1[i] === 2 && !cleanMmatch(dis1, i, dstart1, dend1))) {
        rindex1.push(i); r1.push(ha[i]);
      } else c1[i] = 1;
    }
    for (i = dstart2; i <= dend2; i++) {
      if (dis2[i] === 1 || (dis2[i] === 2 && !cleanMmatch(dis2, i, dstart2, dend2))) {
        rindex2.push(i); r2.push(hb[i]);
      } else c2[i] = 1;
    }

    // vlastní porovnání (rozděl a panuj, prostřední "had")
    var m1 = r1.length, m2 = r2.length;
    var ndiags = m1 + m2 + 3;
    var kvd = new Array(2 * ndiags + 2);
    var offF = m2 + 1, offB = offF + ndiags;

    function split(off1, lim1, off2, lim2) {
      var dmin = off1 - lim2, dmax = lim1 - off2;
      var fmid = off1 - off2, bmid = lim1 - lim2;
      var odd = (fmid - bmid) & 1;
      var fmin = fmid, fmax = fmid, bmin = bmid, bmax = bmid;
      var d, i1, i2;
      kvd[offF + fmid] = off1;
      kvd[offB + bmid] = lim1;
      for (;;) {
        if (fmin > dmin) kvd[offF + (--fmin) - 1] = -1; else ++fmin;
        if (fmax < dmax) kvd[offF + (++fmax) + 1] = -1; else --fmax;
        for (d = fmax; d >= fmin; d -= 2) {
          if (kvd[offF + d - 1] >= kvd[offF + d + 1]) i1 = kvd[offF + d - 1] + 1;
          else i1 = kvd[offF + d + 1];
          i2 = i1 - d;
          for (; i1 < lim1 && i2 < lim2 && r1[i1] === r2[i2]; i1++, i2++);
          kvd[offF + d] = i1;
          if (odd && bmin <= d && d <= bmax && kvd[offB + d] <= i1) return [i1, i2];
        }
        if (bmin > dmin) kvd[offB + (--bmin) - 1] = LINE_MAX; else ++bmin;
        if (bmax < dmax) kvd[offB + (++bmax) + 1] = LINE_MAX; else --bmax;
        for (d = bmax; d >= bmin; d -= 2) {
          if (kvd[offB + d - 1] < kvd[offB + d + 1]) i1 = kvd[offB + d - 1];
          else i1 = kvd[offB + d + 1] - 1;
          i2 = i1 - d;
          for (; i1 > off1 && i2 > off2 && r1[i1 - 1] === r2[i2 - 1]; i1--, i2--);
          kvd[offB + d] = i1;
          if (!odd && fmin <= d && d <= fmax && i1 <= kvd[offF + d]) return [i1, i2];
        }
      }
    }

    function recs(off1, lim1, off2, lim2) {
      for (; off1 < lim1 && off2 < lim2 && r1[off1] === r2[off2]; off1++, off2++);
      for (; off1 < lim1 && off2 < lim2 && r1[lim1 - 1] === r2[lim2 - 1]; lim1--, lim2--);
      if (off1 === lim1) {
        for (; off2 < lim2; off2++) c2[rindex2[off2]] = 1;
      } else if (off2 === lim2) {
        for (; off1 < lim1; off1++) c1[rindex1[off1]] = 1;
      } else {
        var s = split(off1, lim1, off2, lim2);
        recs(off1, s[0], off2, s[1]);
        recs(s[0], lim1, s[1], lim2);
      }
    }
    recs(0, m1, 0, m2);
    return { c1: c1, c2: c2 };
  }

  // ------------------------------------------------------------------
  //  Histogramový diff podle xhistogram.c (řádky se číslují od 1)
  // ------------------------------------------------------------------
  var MAX_CHAIN = 64;

  function histogramFlags(ha, hb) {
    var n1 = ha.length, n2 = hb.length, i;
    var c1 = new Array(n1 + 1), c2 = new Array(n2 + 1);
    for (i = 0; i <= n1; i++) c1[i] = 0;
    for (i = 0; i <= n2; i++) c2[i] = 0;

    function fallBack(line1, count1, line2, count2) {
      var sa = ha.slice(line1 - 1, line1 - 1 + count1), sb = hb.slice(line2 - 1, line2 - 1 + count2);
      // nové číslování tříd jen v rámci výřezu
      var map = Object.create(null), next = 0, k;
      for (k = 0; k < sa.length; k++) { if (!(sa[k] in map)) map[sa[k]] = next++; sa[k] = map[sa[k]]; }
      for (k = 0; k < sb.length; k++) { if (!(sb[k] in map)) map[sb[k]] = next++; sb[k] = map[sb[k]]; }
      var f = myersFlags(sa, sb, next);
      for (k = 0; k < count1; k++) c1[line1 - 1 + k] = f.c1[k];
      for (k = 0; k < count2; k++) c2[line2 - 1 + k] = f.c2[k];
    }

    function run(line1, count1, line2, count2) {
      for (;;) {
        if (count1 <= 0 && count2 <= 0) return;
        if (!count1) { while (count2--) c2[line2++ - 1] = 1; return; }
        if (!count2) { while (count1--) c1[line1++ - 1] = 1; return; }

        var end1 = line1 + count1 - 1, end2 = line2 + count2 - 1;
        // scanA: index výskytů řádků prvního souboru
        var recOf = Object.create(null);      // třída -> {ptr, cnt}
        var nextPtr = Object.create(null);    // řádek -> další výskyt
        var lineRec = Object.create(null);    // řádek -> záznam
        var ptr, rec;
        for (ptr = end1; ptr >= line1; ptr--) {
          rec = recOf[ha[ptr - 1]];
          if (rec) {
            nextPtr[ptr] = rec.ptr;
            rec.ptr = ptr;
            rec.cnt++;
          } else {
            rec = { ptr: ptr, cnt: 1 };
            recOf[ha[ptr - 1]] = rec;
            nextPtr[ptr] = 0;
          }
          lineRec[ptr] = rec;
        }
        var lcs = { begin1: 0, end1: 0, begin2: 0, end2: 0 };
        var idxCnt = MAX_CHAIN + 1, hasCommon = false;
        var bPtr = line2;
        while (bPtr <= end2) {
          var bNext = bPtr + 1;
          rec = recOf[hb[bPtr - 1]];
          if (rec) {
            if (rec.cnt > idxCnt) {
              hasCommon = true;
            } else {
              var as = rec.ptr;
              hasCommon = true;
              for (;;) {
                var np = nextPtr[as], bs = bPtr, ae = as, be = bs, rc = rec.cnt, stop = false;
                while (line1 < as && line2 < bs && ha[as - 2] === hb[bs - 2]) {
                  as--; bs--;
                  if (1 < rc) rc = Math.min(rc, lineRec[as].cnt);
                }
                while (ae < end1 && be < end2 && ha[ae] === hb[be]) {
                  ae++; be++;
                  if (1 < rc) rc = Math.min(rc, lineRec[ae].cnt);
                }
                if (bNext <= be) bNext = be + 1;
                if (lcs.end1 - lcs.begin1 < ae - as || rc < idxCnt) {
                  lcs.begin1 = as; lcs.begin2 = bs; lcs.end1 = ae; lcs.end2 = be;
                  idxCnt = rc;
                }
                if (np === 0) break;
                while (np <= ae) {
                  np = nextPtr[np];
                  if (np === 0) { stop = true; break; }
                }
                if (stop) break;
                as = np;
              }
            }
          }
          bPtr = bNext;
        }
        if (hasCommon && MAX_CHAIN < idxCnt) { fallBack(line1, count1, line2, count2); return; }
        if (lcs.begin1 === 0 && lcs.begin2 === 0) {
          while (count1--) c1[line1++ - 1] = 1;
          while (count2--) c2[line2++ - 1] = 1;
          return;
        }
        run(line1, lcs.begin1 - line1, line2, lcs.begin2 - line2);
        count1 = end1 - lcs.end1;
        line1 = lcs.end1 + 1;
        count2 = end2 - lcs.end2;
        line2 = lcs.end2 + 1;
      }
    }
    run(1, n1, 1, n2);
    return { c1: c1, c2: c2 };
  }

  // ------------------------------------------------------------------
  //  Posouvání skupin změn (xdl_change_compact) s heuristikou odsazení
  // ------------------------------------------------------------------
  var MAX_INDENT = 200, MAX_BLANKS = 20, MAX_SLIDING = 100;

  function getIndent(line) {
    var ret = 0, i, ch;
    for (i = 0; i < line.length; i++) {
      ch = line.charAt(i);
      if (!(ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v')) return ret;
      else if (ch === ' ') ret += 1;
      else if (ch === '\t') ret += 8 - ret % 8;
      if (ret >= MAX_INDENT) return MAX_INDENT;
    }
    return -1;
  }

  function measureSplit(lines, split) {
    var m = {}, i, n = lines.length;
    if (split >= n) { m.eof = 1; m.indent = -1; }
    else { m.eof = 0; m.indent = getIndent(lines[split]); }
    m.preBlank = 0; m.preIndent = -1;
    for (i = split - 1; i >= 0; i--) {
      m.preIndent = getIndent(lines[i]);
      if (m.preIndent !== -1) break;
      m.preBlank += 1;
      if (m.preBlank === MAX_BLANKS) { m.preIndent = 0; break; }
    }
    m.postBlank = 0; m.postIndent = -1;
    for (i = split + 1; i < n; i++) {
      m.postIndent = getIndent(lines[i]);
      if (m.postIndent !== -1) break;
      m.postBlank += 1;
      if (m.postBlank === MAX_BLANKS) { m.postIndent = 0; break; }
    }
    return m;
  }

  function scoreAddSplit(m, s) {
    var postBlank, totalBlank, indent, anyBlanks;
    if (m.preIndent === -1 && m.preBlank === 0) s.penalty += 1;
    if (m.eof) s.penalty += 21;
    postBlank = (m.indent === -1) ? 1 + m.postBlank : 0;
    totalBlank = m.preBlank + postBlank;
    s.penalty += -30 * totalBlank;
    s.penalty += 6 * postBlank;
    indent = (m.indent !== -1) ? m.indent : m.postIndent;
    anyBlanks = (totalBlank !== 0);
    s.effIndent += indent;
    if (indent === -1) { /* nic */ }
    else if (m.preIndent === -1) { /* nic */ }
    else if (indent > m.preIndent) s.penalty += anyBlanks ? 10 : -4;
    else if (indent === m.preIndent) { /* nic */ }
    else if (m.postIndent !== -1 && m.postIndent > indent) s.penalty += anyBlanks ? 17 : 24;
    else s.penalty += anyBlanks ? 17 : 23;
  }

  function scoreCmp(s1, s2) {
    var cmp = (s1.effIndent > s2.effIndent ? 1 : 0) - (s1.effIndent < s2.effIndent ? 1 : 0);
    return 60 * cmp + (s1.penalty - s2.penalty);
  }

  // lines/h/c patří souboru, který upravujeme; co je příznakové pole druhého souboru
  function compact(lines, h, c, co, nOther, useIndent) {
    var n = lines.length;
    function chg(arr, i) { return i >= 0 ? arr[i] : 0; }
    var g = { start: 0, end: 0 }, go = { start: 0, end: 0 };
    while (chg(c, g.end)) g.end++;
    while (chg(co, go.end)) go.end++;

    function next(arr, len, x) {
      if (x.end === len) return -1;
      x.start = x.end + 1;
      for (x.end = x.start; chg(arr, x.end); x.end++);
      return 0;
    }
    function prev(arr, x) {
      if (x.start === 0) return -1;
      x.end = x.start - 1;
      for (x.start = x.end; chg(arr, x.start - 1); x.start--);
      return 0;
    }
    function slideDown() {
      if (g.end < n && h[g.start] === h[g.end]) {
        c[g.start++] = 0;
        c[g.end++] = 1;
        while (chg(c, g.end)) g.end++;
        return 0;
      }
      return -1;
    }
    function slideUp() {
      if (g.start > 0 && h[g.start - 1] === h[g.end - 1]) {
        c[--g.start] = 1;
        c[--g.end] = 0;
        while (chg(c, g.start - 1)) g.start--;
        return 0;
      }
      return -1;
    }

    for (;;) {
      if (g.end !== g.start) {
        var groupsize, earliestEnd, endMatchingOther;
        do {
          groupsize = g.end - g.start;
          endMatchingOther = -1;
          while (!slideUp()) prev(co, go);
          earliestEnd = g.end;
          if (go.end > go.start) endMatchingOther = g.end;
          for (;;) {
            if (slideDown()) break;
            next(co, nOther, go);
            if (go.end > go.start) endMatchingOther = g.end;
          }
        } while (groupsize !== g.end - g.start);

        if (g.end === earliestEnd) {
          /* skupina se posunout nedá */
        } else if (endMatchingOther !== -1) {
          while (go.end === go.start) { slideUp(); prev(co, go); }
        } else if (useIndent) {
          var shift, bestShift = -1, best = null, score, m;
          shift = earliestEnd;
          if (g.end - groupsize - 1 > shift) shift = g.end - groupsize - 1;
          if (g.end - MAX_SLIDING > shift) shift = g.end - MAX_SLIDING;
          for (; shift <= g.end; shift++) {
            score = { effIndent: 0, penalty: 0 };
            m = measureSplit(lines, shift);
            scoreAddSplit(m, score);
            m = measureSplit(lines, shift - groupsize);
            scoreAddSplit(m, score);
            if (bestShift === -1 || scoreCmp(score, best) <= 0) { best = score; bestShift = shift; }
          }
          while (g.end > bestShift) { slideUp(); prev(co, go); }
        }
      }
      if (next(c, n, g)) break;
      next(co, nOther, go);
    }
  }

  // ------------------------------------------------------------------
  //  Seznam změn: [{i1, n1, i2, n2}] – od řádku i1 zmizelo n1, od i2 přibylo n2
  // ------------------------------------------------------------------
  // noIndent: bez heuristiky odsazení (tak Git porovnává při slučování)
  function diffLines(a, b, algorithm, noIndent) {
    var cl = classify(a, b);
    var f = (algorithm === 'histogram') ? histogramFlags(cl.ha, cl.hb) : myersFlags(cl.ha, cl.hb, cl.count);
    compact(a, cl.ha, f.c1, f.c2, b.length, !noIndent);
    compact(b, cl.hb, f.c2, f.c1, a.length, !noIndent);
    var out = [], i1 = 0, i2 = 0, n1 = a.length, n2 = b.length, s1, s2;
    while (i1 < n1 || i2 < n2) {
      if ((i1 < n1 && f.c1[i1]) || (i2 < n2 && f.c2[i2])) {
        s1 = i1; s2 = i2;
        while (i1 < n1 && f.c1[i1]) i1++;
        while (i2 < n2 && f.c2[i2]) i2++;
        out.push({ i1: s1, n1: i1 - s1, i2: s2, n2: i2 - s2 });
      } else { i1++; i2++; }
    }
    return out;
  }

  // Počet přidaných a odebraných řádků (pro "1 file changed, 2 insertions(+)")
  function countChanges(oldText, newText) {
    var a = splitLines(oldText), b = splitLines(newText), ch = diffLines(a, b), add = 0, del = 0, i;
    for (i = 0; i < ch.length; i++) { del += ch[i].n1; add += ch[i].n2; }
    return { add: add, del: del };
  }

  // ------------------------------------------------------------------
  //  Unified diff (tělo výpisu git diff od řádku "@@")
  //  Vrací pole řádků {t: '@'|' '|'+'|'-'|'\\', s: text bez konce řádku}
  // ------------------------------------------------------------------
  function funcName(line) {
    var ch = line.charAt(0);
    if (!line.length || !(/[A-Za-z_$]/.test(ch))) return null;
    var bytes = utf8(line), len = Math.min(bytes.length, 80), s, cut = line;
    if (bytes.length > 80) {
      // ořízni na 80 bajtů (neúplný znak na konci zahoď)
      cut = '';
      var total = 0, i, chr;
      for (i = 0; i < line.length; i++) {
        chr = line.charAt(i);
        if (line.charCodeAt(i) >= 0xd800 && line.charCodeAt(i) <= 0xdbff) { chr += line.charAt(i + 1); i++; }
        total += utf8(chr).length;
        if (total > len) break;
        cut += chr;
      }
    }
    s = cut.replace(/[ \t\n\r\f\v]+$/, '');
    return s;
  }

  function unifiedDiff(oldText, newText, context, algorithm) {
    var ctx = (context === undefined) ? 3 : context;
    var a = splitLines(oldText), b = splitLines(newText);
    var ch = diffLines(a, b, algorithm), out = [];
    var maxCommon = 2 * ctx, k = 0;

    function emit(type, line) {
      if (line.charAt(line.length - 1) === '\n') out.push({ t: type, s: line.slice(0, -1) });
      else {
        out.push({ t: type, s: line });
        out.push({ t: '\\', s: '\\ No newline at end of file' });
      }
    }
    while (k < ch.length) {
      var first = ch[k], last = first, e = k;
      while (e + 1 < ch.length && ch[e + 1].i1 - (ch[e].i1 + ch[e].n1) <= maxCommon) e++;
      last = ch[e];
      var s1 = Math.max(first.i1 - ctx, 0), s2 = Math.max(first.i2 - ctx, 0);
      var lctx = Math.min(ctx, a.length - (last.i1 + last.n1), b.length - (last.i2 + last.n2));
      var e1 = last.i1 + last.n1 + lctx, e2 = last.i2 + last.n2 + lctx;
      var func = null, l;
      for (l = s1 - 1; l >= 0; l--) {
        func = funcName(a[l]);
        if (func !== null) break;
      }
      var c1 = e1 - s1, c2 = e2 - s2;
      out.push({
        t: '@',
        s: '@@ -' + (c1 ? s1 + 1 : s1) + (c1 !== 1 ? ',' + c1 : '') +
           ' +' + (c2 ? s2 + 1 : s2) + (c2 !== 1 ? ',' + c2 : '') + ' @@' + (func ? ' ' + func : '')
      });
      var p2 = s2, j, x;
      for (j = k; j <= e; j++) {
        x = ch[j];
        for (; p2 < x.i2; p2++) emit(' ', b[p2]);
        for (l = x.i1; l < x.i1 + x.n1; l++) emit('-', a[l]);
        for (l = x.i2; l < x.i2 + x.n2; l++) emit('+', b[l]);
        p2 = x.i2 + x.n2;
      }
      for (; p2 < e2; p2++) emit(' ', b[p2]);
      k = e + 1;
    }
    return out;
  }

  // ------------------------------------------------------------------
  //  Třícestné sloučení (xmerge.c, úroveň "zealous", značky po 7 znacích)
  //  Vrací {text, conflicts}
  // ------------------------------------------------------------------
  function merge3(baseText, oursText, theirsText, oursLabel, theirsLabel) {
    var base = splitLines(baseText), ours = splitLines(oursText), theirs = splitLines(theirsText);
    var x1 = diffLines(base, ours, 'histogram', true), x2 = diffLines(base, theirs, 'histogram', true);
    if (!x1.length) return { text: theirsText, conflicts: 0 };
    if (!x2.length) return { text: oursText, conflicts: 0 };

    var ms = [], p1 = 0, p2 = 0, a, b;
    function append(mode, i0, chg0, i1, chg1, i2, chg2) {
      var m = ms.length ? ms[ms.length - 1] : null;
      if (m && (i1 <= m.i1 + m.chg1 || i2 <= m.i2 + m.chg2)) {
        if (mode !== m.mode) m.mode = 0;
        m.chg0 = i0 + chg0 - m.i0;
        m.chg1 = i1 + chg1 - m.i1;
        m.chg2 = i2 + chg2 - m.i2;
      } else {
        ms.push({ mode: mode, i0: i0, chg0: chg0, i1: i1, chg1: chg1, i2: i2, chg2: chg2 });
      }
    }
    function sameLines(i1, i2, count) {
      for (var k = 0; k < count; k++) if (ours[i1 + k] !== theirs[i2 + k]) return false;
      return true;
    }
    while (p1 < x1.length && p2 < x2.length) {
      a = x1[p1]; b = x2[p2];
      if (a.i1 + a.n1 < b.i1) {
        append(1, a.i1, a.n1, a.i2, a.n2, b.i2 - b.i1 + a.i1, a.n1);
        p1++; continue;
      }
      if (b.i1 + b.n1 < a.i1) {
        append(2, b.i1, b.n1, a.i2 - a.i1 + b.i1, b.n1, b.i2, b.n2);
        p2++; continue;
      }
      if (a.i1 !== b.i1 || a.n1 !== b.n1 || a.n2 !== b.n2 || !sameLines(a.i2, b.i2, a.n2)) {
        var off = a.i1 - b.i1, ffo = off + a.n1 - b.n1;
        var i0 = a.i1, i1 = a.i2, i2 = b.i2;
        if (off > 0) { i0 -= off; i1 -= off; } else i2 += off;
        var chg0 = a.i1 + a.n1 - i0, chg1 = a.i2 + a.n2 - i1, chg2 = b.i2 + b.n2 - i2;
        if (ffo < 0) { chg0 -= ffo; chg1 -= ffo; } else chg2 += ffo;
        append(0, i0, chg0, i1, chg1, i2, chg2);
      }
      var end1 = a.i1 + a.n1, end2 = b.i1 + b.n1;
      if (end1 >= end2) p2++;
      if (end2 >= end1) p1++;
    }
    for (; p1 < x1.length; p1++) {
      a = x1[p1];
      append(1, a.i1, a.n1, a.i2, a.n2, a.i1 + theirs.length - base.length, a.n1);
    }
    for (; p2 < x2.length; p2++) {
      b = x2[p2];
      append(2, b.i1, b.n1, b.i1 + ours.length - base.length, b.n1, b.i2, b.n2);
    }

    // zjemnění konfliktů: společné řádky obou stran z konfliktu vyjmi
    var k, m, refined = [];
    for (k = 0; k < ms.length; k++) {
      m = ms[k];
      if (m.mode !== 0 || m.chg1 === 0 || m.chg2 === 0) { refined.push(m); continue; }
      var sub = diffLines(ours.slice(m.i1, m.i1 + m.chg1), theirs.slice(m.i2, m.i2 + m.chg2), 'histogram', true);
      if (!sub.length) { m.mode = 4; refined.push(m); continue; }
      var bi1 = m.i1, bi2 = m.i2, q;
      for (q = 0; q < sub.length; q++) {
        refined.push({ mode: 0, i0: m.i0, chg0: m.chg0, i1: sub[q].i1 + bi1, chg1: sub[q].n1, i2: sub[q].i2 + bi2, chg2: sub[q].n2 });
      }
    }
    ms = refined;
    // konflikty oddělené nejvýš třemi řádky spoj do jednoho
    k = 0;
    while (k + 1 < ms.length) {
      var cur = ms[k], nx = ms[k + 1];
      var begin = cur.i1 + cur.chg1, end = nx.i1;
      if (cur.mode !== 0 || nx.mode !== 0 || end - begin > 3) k++;
      else {
        cur.chg1 = nx.i1 + nx.chg1 - cur.i1;
        cur.chg2 = nx.i2 + nx.chg2 - cur.i2;
        ms.splice(k + 1, 1);
      }
    }

    // sestavení výsledku
    var out = [], pos = 0, conflicts = 0, l;
    function push(line) { out.push(line.charAt(line.length - 1) === '\n' ? line : line + '\n'); }
    for (k = 0; k < ms.length; k++) {
      m = ms[k];
      if (m.mode === 0) {
        conflicts++;
        for (l = pos; l < m.i1; l++) out.push(ours[l]);
        out.push('<<<<<<< ' + oursLabel + '\n');
        for (l = m.i1; l < m.i1 + m.chg1; l++) push(ours[l]);
        out.push('=======\n');
        for (l = m.i2; l < m.i2 + m.chg2; l++) push(theirs[l]);
        out.push('>>>>>>> ' + theirsLabel + '\n');
      } else if (m.mode & 3) {
        for (l = pos; l < m.i1; l++) out.push(ours[l]);
        if (m.mode & 1) for (l = m.i1; l < m.i1 + m.chg1; l++) out.push(ours[l]);
        if (m.mode & 2) for (l = m.i2; l < m.i2 + m.chg2; l++) out.push(theirs[l]);
      } else continue;
      pos = m.i1 + m.chg1;
    }
    for (l = pos; l < ours.length; l++) out.push(ours[l]);
    return { text: out.join(''), conflicts: conflicts };
  }

  // ------------------------------------------------------------------
  //  Kombinovaný výpis (git diff u souboru v konfliktu), podle combine-diff.c
  //  result: text v pracovní složce, parents: [text "ours", text "theirs"]
  //  Vrací pole řádků; každý řádek je pole úseků [text, barva].
  // ------------------------------------------------------------------
  function combinedDiff(resultText, parents, context) {
    var ctx = (context === undefined) ? 3 : context;
    var res = splitLines(resultText), cnt = res.length, np = parents.length, i, n;
    var allMask = (1 << np) - 1, mark = 1 << np, noPreDelete = 2 << np;
    var sline = [];
    for (i = 0; i <= cnt + 1; i++) {
      sline.push({ flag: 0, lost: [], plost: [], pl: new Array(np),
        bol: i < cnt ? res[i].replace(/\n$/, '') : null });
    }

    function coalesce(base, add, parent) {
      if (!add.length) return base;
      if (!base.length) return add;
      var lb = base.length, ln = add.length, lcs = [], dir = [], a, b;
      for (a = 0; a <= lb; a++) {
        lcs.push(new Array(ln + 1)); dir.push(new Array(ln + 1));
        for (b = 0; b <= ln; b++) lcs[a][b] = 0;
        dir[a][0] = 'B';
      }
      for (b = 1; b <= ln; b++) dir[0][b] = 'N';
      for (a = 1; a <= lb; a++) {
        for (b = 1; b <= ln; b++) {
          if (base[a - 1].line === add[b - 1].line) { lcs[a][b] = lcs[a - 1][b - 1] + 1; dir[a][b] = 'M'; }
          else if (lcs[a][b - 1] >= lcs[a - 1][b]) { lcs[a][b] = lcs[a][b - 1]; dir[a][b] = 'N'; }
          else { lcs[a][b] = lcs[a - 1][b]; dir[a][b] = 'B'; }
        }
      }
      var out = base.slice();
      a = lb; b = ln;
      while (a !== 0 || b !== 0) {
        if (dir[a][b] === 'M') { out[a - 1].map |= (1 << parent); a--; b--; }
        else if (dir[a][b] === 'N') { out.splice(a, 0, add[b - 1]); b--; }
        else a--;
      }
      return out;
    }

    for (n = 0; n < np; n++) {
      var nmask = 1 << n, same = -1, j;
      for (j = 0; j < n; j++) if (parents[j] === parents[n]) { same = j; break; }
      if (same >= 0) {
        var jm = 1 << same;
        for (i = 0; i <= cnt; i++) {
          sline[i].pl[n] = sline[i].pl[same];
          sline[i].lost.forEach(function (ll) { if (ll.map & jm) ll.map |= nmask; });
          if (sline[i].flag & jm) sline[i].flag |= nmask;
        }
        sline[cnt + 1].pl[n] = sline[cnt + 1].pl[same];
        continue;
      }
      var plines = splitLines(parents[n] || '');
      var ch = diffLines(plines, res);
      ch.forEach(function (c) {
        var nb = c.n2 ? c.i2 + 1 : c.i2, bucket, lno = nb, k, t;
        if (c.n2 === 0) bucket = sline[nb];
        else bucket = sline[nb - 1];
        for (k = c.i1; k < c.i1 + c.n1; k++) {
          t = plines[k];
          if (t.charAt(t.length - 1) === '\n') t = t.slice(0, -1);
          bucket.plost.push({ line: t, map: nmask });
        }
        for (k = 0; k < c.n2; k++) { sline[lno - 1].flag |= nmask; lno++; }
      });
      var p = 1;
      for (i = 0; i <= cnt; i++) {
        sline[i].pl[n] = p;
        if (sline[i].plost.length) {
          sline[i].lost = coalesce(sline[i].lost, sline[i].plost, n);
          sline[i].plost = [];
        }
        sline[i].lost.forEach(function (ll) { if (ll.map & nmask) p++; });
        if (i < cnt && !(sline[i].flag & nmask)) p++;
      }
      sline[cnt + 1].pl[n] = p;
    }

    // --- make_hunks (dense) ---
    function interesting(sl) { return (sl.flag & allMask) || sl.lost.length; }
    function adjustTail(begin, k) { if (begin + 1 <= k && !(sline[k - 1].flag & allMask)) k--; return k; }
    function findNext(k, unint) {
      while (k <= cnt) {
        if (unint ? !(sline[k].flag & mark) : (sline[k].flag & mark)) return k;
        k++;
      }
      return k;
    }
    for (i = 0; i <= cnt; i++) {
      if (interesting(sline[i])) sline[i].flag |= mark; else sline[i].flag &= ~mark;
    }
    i = 0;
    while (i <= cnt) {
      var hb, he, sameDiff, hasInt, jj;
      while (i <= cnt && !(sline[i].flag & mark)) i++;
      if (cnt < i) break;
      hb = i;
      for (jj = i + 1; jj <= cnt; jj++) {
        if (!(sline[jj].flag & mark)) {
          var la = adjustTail(hb, jj), contin = false;
          la = (la + ctx < cnt + 1) ? la + ctx : cnt + 1;
          while (la && jj <= --la) { if (sline[la].flag & mark) { contin = true; break; } }
          if (!contin) break;
          jj = la;
        }
      }
      he = jj;
      sameDiff = 0; hasInt = false;
      for (jj = i; jj < he && !hasInt; jj++) {
        var thisDiff = sline[jj].flag & allMask, q;
        if (thisDiff) {
          if (!sameDiff) sameDiff = thisDiff;
          else if (sameDiff !== thisDiff) { hasInt = true; break; }
        }
        for (q = 0; q < sline[jj].lost.length && !hasInt; q++) {
          thisDiff = sline[jj].lost[q].map;
          if (!sameDiff) sameDiff = thisDiff;
          else if (sameDiff !== thisDiff) hasInt = true;
        }
      }
      if (!hasInt && sameDiff !== allMask) for (jj = hb; jj < he; jj++) sline[jj].flag &= ~mark;
      i = he;
    }
    // --- give_context ---
    i = findNext(0, false);
    if (i <= cnt) {
      while (i <= cnt) {
        var a0 = (ctx < i) ? i - ctx : 0, kk;
        while (a0 < i) {
          if (!(sline[a0].flag & mark)) sline[a0].flag |= noPreDelete;
          sline[a0++].flag |= mark;
        }
        for (;;) {
          a0 = findNext(i, true);
          if (cnt < a0) { i = cnt + 1; break; }
          kk = findNext(a0, false);
          a0 = adjustTail(i, a0);
          if (kk < a0 + ctx) {
            while (a0 < kk) sline[a0++].flag |= mark;
            i = kk;
            continue;
          }
          i = kk;
          kk = (a0 + ctx < cnt + 1) ? a0 + ctx : cnt + 1;
          while (a0 < kk) sline[a0++].flag |= mark;
          break;
        }
      }
    }

    // --- dump_sline ---
    var out = [], lno = 0;
    function marks(fn) { var s = '', k; for (k = 0; k < np; k++) s += fn(k); return s; }
    while (true) {
      var comment = null, hunkEnd, rlines, k2;
      while (lno <= cnt && !(sline[lno].flag & mark)) {
        if (sline[lno].bol !== null && /^[A-Za-z_$]/.test(sline[lno].bol)) comment = sline[lno].bol;
        lno++;
      }
      if (cnt < lno) break;
      for (hunkEnd = lno + 1; hunkEnd <= cnt; hunkEnd++) if (!(sline[hunkEnd].flag & mark)) break;
      rlines = hunkEnd - lno;
      if (cnt < hunkEnd) rlines--;
      var at = new Array(np + 2).join('@'), head = at;
      for (k2 = 0; k2 < np; k2++) {
        var l0 = sline[lno].pl[k2], l1 = sline[hunkEnd].pl[k2];
        head += ' -' + l0 + ',' + (l1 - l0);
      }
      head += ' +' + (lno + 1) + ',' + rlines + ' ' + at;
      var segs = [[head, 'c']];
      if (comment) {
        var bytes = utf8(comment), end = 0, b2;
        for (b2 = 0; b2 < 40 && b2 < bytes.length; b2++) {
          if (bytes[b2] === 10) break;
          if (!(bytes[b2] === 32 || (bytes[b2] >= 9 && bytes[b2] <= 13))) end = b2;
        }
        if (end) segs.push([' ' + decodeUtf8(bytes.slice(0, end)), '']);
      }
      out.push(segs);
      while (lno < hunkEnd) {
        var sl = sline[lno++], lost = (sl.flag & noPreDelete) ? [] : sl.lost;
        lost.forEach(function (ll) {
          out.push([[marks(function (k) { return (ll.map & (1 << k)) ? '-' : ' '; }) + ll.line, 'r']]);
        });
        if (cnt < lno) break;
        var m = marks(function (k) { return (sl.flag & (1 << k)) ? '+' : ' '; });
        if (!(sl.flag & allMask)) out.push([[m + sl.bol, '']]);
        else out.push([[m + sl.bol, 'g']]);
      }
    }
    return out;
  }

  function decodeUtf8(bytes) {
    var s = '', i = 0, c, cp, need, k, ok;
    while (i < bytes.length) {
      c = bytes[i];
      need = c < 0x80 ? 0 : c >= 0xf0 ? 3 : c >= 0xe0 ? 2 : c >= 0xc0 ? 1 : -1;
      ok = need >= 0 && i + need < bytes.length;
      for (k = 1; ok && k <= need; k++) if ((bytes[i + k] & 0xc0) !== 0x80) ok = false;
      if (!ok) { s += '\ufffd'; i++; continue; }
      cp = need === 0 ? c : need === 1 ? c & 31 : need === 2 ? c & 15 : c & 7;
      for (k = 1; k <= need; k++) cp = (cp << 6) | (bytes[i + k] & 63);
      s += String.fromCodePoint(cp);
      i += need + 1;
    }
    return s;
  }

  root.GitText = {
    utf8: utf8, utf8Length: utf8Length, sha1: sha1, hexToBytes: hexToBytes,
    splitLines: splitLines, diffLines: diffLines, countChanges: countChanges,
    unifiedDiff: unifiedDiff, merge3: merge3, combinedDiff: combinedDiff, decodeUtf8: decodeUtf8,
    unifiedDiffWith: function (a, b, alg) { return unifiedDiff(a, b, 3, alg); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
