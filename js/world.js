/* =====================================================================
 *  world.js – svět simulátoru
 *
 *  Svět obsahuje:
 *    - úložiště objektů Gitu (blob, tree, commit) se skutečnými SHA-1 hashi,
 *    - "GitHub" (účty a vzdálené repozitáře),
 *    - počítače (každý má své složky, soubory, nastavení Gitu a repozitáře).
 *
 *  Omezení modelu: repozitář je vždy jedna složka bez podsložek.
 * ===================================================================== */
(function (root) {
  'use strict';
  var T = root.GitText;

  function cmpBytes(a, b) {
    var x = T.utf8(a), y = T.utf8(b), n = Math.min(x.length, y.length), i;
    for (i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  }
  function sortedKeys(obj) { return Object.keys(obj).sort(cmpBytes); }

  function tzString(minutes) {
    var sign = minutes < 0 ? '-' : '+', m = Math.abs(minutes);
    return sign + ('0' + Math.floor(m / 60)).slice(-2) + ('0' + (m % 60)).slice(-2);
  }

  // ------------------------------------------------------------------
  //  Svět a úložiště objektů
  // ------------------------------------------------------------------
  function World(opts) {
    opts = opts || {};
    this.now = opts.now || function () { return Math.floor(Date.now() / 1000); };
    this.tz = (opts.tz !== undefined) ? opts.tz : -new Date().getTimezoneOffset();
    this.blobs = Object.create(null);
    this.trees = Object.create(null);
    this.commits = Object.create(null);
    this.seq = 0;
    this.accounts = Object.create(null);   // login -> {login, name, email}
    this.remotes = Object.create(null);    // "owner/name" -> RemoteRepo
    this.machines = Object.create(null);
    this.machineOrder = [];
  }

  World.prototype.hashBlob = function (content) {
    var body = T.utf8(content);
    return T.sha1(T.utf8('blob ' + body.length + '\0').concat(body));
  };

  World.prototype.blob = function (content) {
    var body = T.utf8(content);
    var hash = T.sha1(T.utf8('blob ' + body.length + '\0').concat(body));
    this.blobs[hash] = content;
    return hash;
  };

  World.prototype.tree = function (map) {
    var names = sortedKeys(map), body = [], i;
    for (i = 0; i < names.length; i++) {
      body = body.concat(T.utf8('100644 ' + names[i] + '\0'), T.hexToBytes(map[names[i]]));
    }
    var hash = T.sha1(T.utf8('tree ' + body.length + '\0').concat(body));
    if (!this.trees[hash]) {
      var copy = Object.create(null);
      for (i = 0; i < names.length; i++) copy[names[i]] = map[names[i]];
      this.trees[hash] = copy;
    }
    return hash;
  };

  // c: {tree, parents, author:{name,email,time,tz}, committer:{...}, message}
  World.prototype.commit = function (c) {
    var text = 'tree ' + c.tree + '\n', i;
    for (i = 0; i < c.parents.length; i++) text += 'parent ' + c.parents[i] + '\n';
    text += 'author ' + c.author.name + ' <' + c.author.email + '> ' + c.author.time + ' ' + tzString(c.author.tz) + '\n';
    text += 'committer ' + c.committer.name + ' <' + c.committer.email + '> ' + c.committer.time + ' ' + tzString(c.committer.tz) + '\n';
    text += '\n' + c.message;
    var body = T.utf8(text);
    var hash = T.sha1(T.utf8('commit ' + body.length + '\0').concat(body));
    if (!this.commits[hash]) {
      this.commits[hash] = {
        hash: hash, tree: c.tree, parents: c.parents.slice(),
        author: c.author, committer: c.committer, message: c.message, seq: ++this.seq
      };
    }
    return hash;
  };

  World.prototype.treeOf = function (commitHash) {
    return commitHash ? this.trees[this.commits[commitHash].tree] : Object.create(null);
  };

  // všichni předci včetně commitu samotného
  World.prototype.ancestors = function (hash) {
    var seen = Object.create(null), stack = hash ? [hash] : [], h, p, i;
    while (stack.length) {
      h = stack.pop();
      if (seen[h]) continue;
      seen[h] = true;
      p = this.commits[h].parents;
      for (i = 0; i < p.length; i++) stack.push(p[i]);
    }
    return seen;
  };

  World.prototype.isAncestor = function (a, b) {
    if (!a) return true;
    if (!b) return false;
    return !!this.ancestors(b)[a];
  };

  // společný předek (nejlepší: není předkem jiného společného předka)
  World.prototype.mergeBase = function (a, b) {
    var A = this.ancestors(a), B = this.ancestors(b), common = [], h, self = this;
    for (h in A) if (B[h]) common.push(h);
    if (!common.length) return null;
    var best = common.filter(function (c) {
      return !common.some(function (d) { return d !== c && self.ancestors(d)[c]; });
    });
    best.sort(function (x, y) { return self.commits[y].seq - self.commits[x].seq; });
    return best[0];
  };

  // všechny objekty dosažitelné z daných commitů (pro počty při push/pull)
  World.prototype.objectsOf = function (hashes) {
    var objs = Object.create(null), seen = Object.create(null), stack = hashes.filter(Boolean), h, c, t, p;
    while (stack.length) {
      h = stack.pop();
      if (seen[h]) continue;
      seen[h] = true;
      c = this.commits[h];
      objs[h] = 'commit';
      objs[c.tree] = 'tree';
      t = this.trees[c.tree];
      for (p in t) objs[t[p]] = 'blob';
      for (p = 0; p < c.parents.length; p++) stack.push(c.parents[p]);
    }
    return objs;
  };

  // ------------------------------------------------------------------
  //  GitHub
  // ------------------------------------------------------------------
  World.prototype.addAccount = function (login, name, email) {
    this.accounts[login] = { login: login, name: name, email: email };
    return this.accounts[login];
  };

  // "https://github.com/owner/name.git" -> {owner, name, key}
  function parseUrl(url) {
    var m = /^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+?)(\.git)?\/?$/.exec(url || '');
    if (!m) return null;
    return { owner: m[1], name: m[2], key: m[1].toLowerCase() + '/' + m[2].toLowerCase() };
  }

  World.prototype.findRemote = function (url) {
    var p = parseUrl(url);
    return p ? (this.remotes[p.key] || null) : null;
  };

  // opts: {private: bool, readme: bool}
  World.prototype.createRemote = function (owner, name, opts) {
    opts = opts || {};
    var key = owner.toLowerCase() + '/' + name.toLowerCase();
    if (this.remotes[key]) return null;
    var r = {
      owner: owner, name: name, key: key, private: !!opts.private,
      collaborators: [], branches: Object.create(null), defaultBranch: 'main',
      url: 'https://github.com/' + owner + '/' + name + '.git'
    };
    this.remotes[key] = r;
    if (opts.readme) {
      var files = Object.create(null);
      files['README.md'] = '# ' + name + '\n';
      this.webCommit(r, owner, files, 'Initial commit');
    }
    return r;
  };

  World.prototype.canRead = function (remote, login) {
    if (!remote.private) return true;
    return !!login && (login === remote.owner || remote.collaborators.indexOf(login) >= 0);
  };
  World.prototype.canWrite = function (remote, login) {
    return !!login && (login === remote.owner || remote.collaborators.indexOf(login) >= 0);
  };

  // commit vytvořený na webu GitHubu; files: {cesta: obsah | null (smazat)}
  World.prototype.webCommit = function (remote, login, files, message) {
    var acc = this.accounts[login] || { name: login, email: login + '@users.noreply.github.com' };
    var branch = remote.defaultBranch, parent = remote.branches[branch] || null;
    var tree = Object.create(null), old = this.treeOf(parent), p;
    for (p in old) tree[p] = old[p];
    for (p in files) {
      if (files[p] === null) delete tree[p];
      else tree[p] = this.blob(files[p]);
    }
    var when = { time: this.now(), tz: this.tz };
    var hash = this.commit({
      tree: this.tree(tree), parents: parent ? [parent] : [],
      author: { name: acc.name, email: acc.email, time: when.time, tz: when.tz },
      committer: { name: 'GitHub', email: 'noreply@github.com', time: when.time, tz: when.tz },
      message: message.replace(/\s+$/, '') + '\n'
    });
    remote.branches[branch] = hash;
    return hash;
  };

  // ------------------------------------------------------------------
  //  Počítač: složky, soubory, nastavení
  // ------------------------------------------------------------------
  function Dir() {
    this.dirs = Object.create(null);
    this.files = Object.create(null);   // název -> obsah
    this.repo = null;
  }

  // opts: {login, home (název domovské složky), host}
  function Machine(world, id, opts) {
    this.world = world;
    this.id = id;
    this.label = opts.label || id;
    this.login = opts.login || null;          // účet na GitHubu
    this.signedIn = !!opts.signedIn;          // uložené přihlášení (Credential Manager)
    this.host = opts.host || 'PC-UCEBNA';
    this.homeName = opts.home || id;
    this.root = new Dir();
    this.home = ['Users', this.homeName];
    this.cwd = this.home.slice();
    this.config = [];                         // globální nastavení: [{section, key, name, value}]
    this.mkdirp(this.home);
  }

  Machine.prototype.dirAt = function (path) {
    var d = this.root, i;
    for (i = 0; i < path.length; i++) {
      d = d.dirs[path[i]];
      if (!d) return null;
    }
    return d;
  };
  Machine.prototype.mkdirp = function (path) {
    var d = this.root, i;
    for (i = 0; i < path.length; i++) {
      if (!d.dirs[path[i]]) d.dirs[path[i]] = new Dir();
      d = d.dirs[path[i]];
    }
    return d;
  };
  Machine.prototype.dir = function () { return this.dirAt(this.cwd); };
  Machine.prototype.winPath = function (path) { return 'C:\\' + (path || this.cwd).join('\\'); };
  Machine.prototype.gitPath = function (path) { return 'C:/' + (path || this.cwd).join('/'); };
  Machine.prototype.isHome = function () { return this.cwd.join('/') === this.home.join('/'); };
  Machine.prototype.prompt = function () {
    if (this.isHome() || this.cwd.length < 2) return 'PS ' + this.winPath() + '>';
    return 'PS ' + this.cwd[this.cwd.length - 1] + '>';
  };

  // Přeloží cestu z příkazu (cd ~\git, cd .., C:\Users\jana) na pole složek; null = neplatná
  Machine.prototype.resolve = function (arg) {
    var s = String(arg).replace(/\//g, '\\'), parts, path, i;
    if (s === '~' || s.indexOf('~\\') === 0) { path = this.home.slice(); s = s.slice(2); }
    else if (/^[A-Za-z]:\\?/.test(s)) { path = []; s = s.replace(/^[A-Za-z]:\\?/, ''); }
    else if (s.charAt(0) === '\\') { path = []; s = s.slice(1); }
    else path = this.cwd.slice();
    parts = s.split('\\');
    for (i = 0; i < parts.length; i++) {
      if (parts[i] === '' || parts[i] === '.') continue;
      if (parts[i] === '..') { if (path.length) path.pop(); continue; }
      path.push(parts[i]);
    }
    return path;
  };

  // --- nastavení Gitu (pořadí jako v souboru .gitconfig) ---
  // Klíč má tvar sekce.název; nový klíč se zařadí na konec své sekce.
  function configSet(list, key, value) {
    var k = key.toLowerCase(), section = k.slice(0, k.indexOf('.')), i, at = -1;
    for (i = 0; i < list.length; i++) {
      if (list[i].key === k) { list[i].value = value; return; }
      if (list[i].section === section) at = i;
    }
    var entry = { section: section, key: k, value: value };
    if (at >= 0) list.splice(at + 1, 0, entry); else list.push(entry);
  }
  function configGet(list, key) {
    var k = key.toLowerCase(), i;
    for (i = 0; i < list.length; i++) if (list[i].key === k) return list[i].value;
    return undefined;
  }
  function configUnset(list, key) {
    var k = key.toLowerCase(), i;
    for (i = 0; i < list.length; i++) if (list[i].key === k) { list.splice(i, 1); return true; }
    return false;
  }

  Machine.prototype.getConfig = function (key, repo) {
    var v;
    if (repo) v = configGet(repo.config, key);
    if (v === undefined) v = configGet(this.config, key);
    return v;
  };

  // ------------------------------------------------------------------
  //  Lokální repozitář
  // ------------------------------------------------------------------
  function Repo(branch) {
    this.head = branch;                       // název aktuální větve
    this.branches = Object.create(null);      // název -> hash
    this.index = Object.create(null);         // cesta -> hash blobu
    this.remotes = [];                        // [{name, url}]
    this.remoteRefs = Object.create(null);    // "origin/main" -> hash
    this.upstream = Object.create(null);      // větev -> {remote, branch}
    this.merge = null;                        // rozpracovaný merge (MERGE_HEAD): {theirs, message, hadConflicts}
    this.revert = null;                       // rozpracovaný revert (REVERT_HEAD): {commit, message, hadConflicts}
    this.conflicts = Object.create(null);     // soubory v konfliktu: cesta -> {base, ours, theirs}
    this.config = [];
  }
  Repo.prototype.headHash = function () { return this.branches[this.head] || null; };
  Repo.prototype.remoteUrl = function (name) {
    for (var i = 0; i < this.remotes.length; i++) if (this.remotes[i].name === name) return this.remotes[i].url;
    return null;
  };

  World.prototype.addMachine = function (id, opts) {
    var m = new Machine(this, id, opts || {});
    this.machines[id] = m;
    this.machineOrder.push(id);
    return m;
  };

  root.GitWorld = {
    World: World, Machine: Machine, Dir: Dir, Repo: Repo,
    cmpBytes: cmpBytes, sortedKeys: sortedKeys, tzString: tzString, parseUrl: parseUrl,
    configSet: configSet, configGet: configGet, configUnset: configUnset
  };
})(typeof window !== 'undefined' ? window : globalThis);
