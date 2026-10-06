/* VP Residency — admin panel behaviour: schema-driven editor, media & icon pickers, live theme preview. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CSRF = ($('meta[name=csrf-token]') || {}).content || '';
  var META = null;
  var ICONS = null;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid === null || kid === undefined || kid === false) continue;
      if (Array.isArray(kid)) kid.forEach(function (k) { if (k) el.append(k); });
      else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function icon(name, size) {
    var s = document.createElement('span');
    s.className = 'i';
    s.style.display = 'inline-grid';
    s.innerHTML = '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ((ICONS && ICONS[name]) || '') + '</svg>';
    return s;
  }
  function toast(msg) {
    var t = $('[data-toast]');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }
  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); }
  var uid = 0;
  function nextId() { uid += 1; return 'f' + uid; }

  function loadMeta() {
    if (META) return Promise.resolve();
    return Promise.all([
      fetch('/admin/api/meta', { credentials: 'same-origin' }).then(function (r) { return r.json(); }),
      fetch('/admin/api/icons', { credentials: 'same-origin' }).then(function (r) { return r.json(); }),
    ]).then(function (res) { META = res[0]; ICONS = res[1]; });
  }

  /* ============================================================ image preparation & upload */
  function canvasBlob(canvas, type, q) {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, type, q); });
  }
  function resizeTo(bitmap, max) {
    var scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    var c = document.createElement('canvas');
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    return c;
  }
  async function encode(canvas, srcType) {
    var b = await canvasBlob(canvas, 'image/webp', 0.82);
    if (b && b.type === 'image/webp') return b;
    if (srcType === 'image/png') return canvasBlob(canvas, 'image/png');
    return canvasBlob(canvas, 'image/jpeg', 0.85);
  }
  async function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return { main: file, name: file.name };
    try {
      var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      var big = resizeTo(bmp, 2000);
      var main = await encode(big, file.type);
      var thumb = await encode(resizeTo(bmp, 800), file.type);
      // Keep the original for small files that would only get bigger.
      if (main.size > file.size && big.width === bmp.width && main.type === file.type) main = file;
      var ext = main.type === 'image/webp' ? '.webp' : main.type === 'image/png' ? '.png' : '.jpg';
      if (thumb.type !== main.type) thumb = null;
      return { main: main, thumb: thumb, width: big.width, height: big.height, name: file.name.replace(/\.[^.]+$/, '') + ext };
    } catch (e) {
      return { main: file, name: file.name };
    }
  }
  async function uploadOne(file) {
    var p = file.type.indexOf('image/') === 0 ? await prepareImage(file) : { main: file, name: file.name };
    var fd = new FormData();
    fd.append('file', p.main, p.name);
    if (p.thumb) fd.append('thumb', p.thumb, 'thumb-' + p.name);
    if (p.width) fd.append('width', p.width);
    if (p.height) fd.append('height', p.height);
    var r = await fetch('/admin/media/upload', { method: 'POST', body: fd, headers: { 'x-csrf-token': CSRF }, credentials: 'same-origin' });
    var j = await r.json().catch(function () { return { error: 'Upload failed (' + r.status + ')' }; });
    if (!r.ok || !j.ok) throw new Error(j.error || 'Upload failed');
    return j.item;
  }
  async function uploadFiles(files, onProgress) {
    var out = [], errors = [];
    for (var i = 0; i < files.length; i++) {
      if (onProgress) onProgress(i + 1, files.length, files[i].name);
      try { out.push(await uploadOne(files[i])); } catch (e) { errors.push(files[i].name + ': ' + e.message); }
    }
    if (errors.length) alert(errors.join('\n'));
    return out;
  }

  /* ============================================================ modals */
  function modal(title, body, foot, opts) {
    var card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', { text: title }), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: function () { close(); } }, icon('x', 20))),
      opts && opts.tabs ? opts.tabs : null,
      opts && opts.tools ? opts.tools : null,
      h('div', { class: 'modal-body' }, body),
      foot ? h('div', { class: 'modal-foot' }, foot) : null);
    var wrap = h('div', { class: 'modal' }, card);
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { wrap.remove(); document.removeEventListener('keydown', onKey); if (opts && opts.onClose) opts.onClose(); }
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    return { close: close, card: card };
  }

  function pickMedia(opts) {
    opts = opts || {};
    var kind = opts.kind || 'image';
    var multiple = !!opts.multiple;
    return loadMeta().then(function () {
      return new Promise(function (resolve) {
        var selected = [];
        var data = { items: [], builtin: [] };
        var tab = 'uploads';
        var grid = h('div', { class: 'pick-grid' });
        var search = h('input', { type: 'search', placeholder: 'Search…' });
        var count = h('span', { class: 'sel-count' });
        var fileIn = h('input', { type: 'file', multiple: true, hidden: true, accept: kind === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : kind === 'video' ? 'video/mp4,video/webm' : kind === 'font' ? '.woff2,.woff,.ttf,.otf' : '' });
        var status = h('span', { class: 'muted' });
        var urlIn = h('input', { type: 'url', placeholder: 'https://…', style: 'flex:1;min-width:200px' });
        var tools = h('div', { class: 'modal-tools' }, search,
          h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: function () { fileIn.click(); } }, icon('upload'), 'Upload'), fileIn, status);
        var tabBtns = [['uploads', 'Your uploads']].concat(kind === 'image' ? [['builtin', 'Built-in photos & art']] : []).concat([['link', 'Paste a link']]);
        var tabs = h('div', { class: 'modal-tabs' }, tabBtns.map(function (t) {
          return h('button', { type: 'button', class: t[0] === tab ? 'is-active' : '', 'data-tab': t[0], onclick: function (e) {
            tab = t[0];
            $$('button', tabs).forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
            render();
          } }, t[1]);
        }));
        function setCount() { count.textContent = selected.length ? selected.length + ' selected' : multiple ? 'Pick one or more' : 'Pick one'; useBtn.disabled = !selected.length; }
        function toggle(url) {
          var i = selected.indexOf(url);
          if (i >= 0) selected.splice(i, 1);
          else if (multiple) selected.push(url);
          else selected = [url];
          render();
        }
        function render() {
          grid.replaceChildren();
          if (tab === 'link') {
            grid.append(h('div', { style: 'grid-column:1/-1;display:flex;gap:8px;padding:10px 0' }, urlIn,
              h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: function () {
                if (/^https:\/\/[^\s"'<>()]+$/.test(urlIn.value.trim())) { done([urlIn.value.trim()]); } else alert('Please paste a full https:// link.');
              } }, 'Use link')));
            return;
          }
          var q = search.value.trim().toLowerCase();
          var list = (tab === 'builtin' ? data.builtin : data.items).filter(function (m) { return !q || (m.name || '').toLowerCase().indexOf(q) >= 0; });
          if (!list.length) grid.append(h('p', { class: 'muted', style: 'grid-column:1/-1' }, tab === 'uploads' ? 'Nothing uploaded yet — click Upload.' : 'No matches.'));
          list.forEach(function (m) {
            var isSvg = /\.svg$/.test(m.url) || /\/brand\//.test(m.url);
            var b = h('button', { type: 'button', class: 'pick-item' + (selected.indexOf(m.url) >= 0 ? ' is-selected' : '') + (isSvg ? ' is-contain' : ''), title: m.name,
              onclick: function () { toggle(m.url); }, ondblclick: function () { if (!multiple) done([m.url]); } },
              kind === 'image' ? h('img', { src: m.url.replace(/(\.(webp|jpg|jpeg|png))$/, /^\/(images|media\/img)\//.test(m.url) ? '-sm$1' : '$1'), alt: '', loading: 'lazy' }) : h('span', { class: 'pick-file' }, icon(kind === 'video' ? 'film' : 'type', 30)),
              h('span', { text: m.name || '' }));
            grid.append(b);
          });
          setCount();
        }
        var useBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { done(selected.slice()); } }, 'Use selected');
        var m = modal(kind === 'image' ? 'Choose photos' : kind === 'video' ? 'Choose a video' : 'Choose a file', grid,
          [count, h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { done(null); } }, 'Cancel'), useBtn],
          { tabs: tabs, tools: tools, onClose: function () { resolve(null); } });
        var finished = false;
        function done(v) { if (finished) return; finished = true; resolve(v && v.length ? v : null); m.close(); }
        search.addEventListener('input', render);
        fileIn.addEventListener('change', async function () {
          var files = Array.prototype.slice.call(fileIn.files);
          var items = await uploadFiles(files, function (i, n) { status.textContent = 'Uploading ' + i + ' of ' + n + '…'; });
          status.textContent = items.length ? 'Uploaded ' + items.length + '.' : '';
          items.forEach(function (it) { data.items.unshift({ url: it.url, name: it.name }); if (multiple) selected.push(it.url); else selected = [it.url]; });
          tab = 'uploads';
          $$('button', tabs).forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
          render();
          fileIn.value = '';
        });
        fetch('/admin/api/media?kind=' + encodeURIComponent(kind), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
          data = j;
          if (!data.items.length && data.builtin.length) {
            tab = 'builtin';
            $$('button', tabs).forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
          }
          render();
        });
        render();
        setTimeout(function () { search.focus(); }, 50);
      });
    });
  }

  function pickIcon(current) {
    return new Promise(function (resolve) {
      var q = h('input', { type: 'search', placeholder: 'Search icons (e.g. wifi, bed, bus)…' });
      var grid = h('div', { class: 'icon-grid' });
      var names = Object.keys(ICONS || {}).sort();
      function render() {
        grid.replaceChildren();
        var s = q.value.trim().toLowerCase();
        names.filter(function (n) { return !s || n.indexOf(s) >= 0; }).forEach(function (n) {
          grid.append(h('button', { type: 'button', class: n === current ? 'is-selected' : '', onclick: function () { resolve(n); m.close(); } }, icon(n, 24), n));
        });
      }
      var m = modal('Choose an icon', grid, null, { tools: h('div', { class: 'modal-tools' }, q), onClose: function () { resolve(null); } });
      q.addEventListener('input', render);
      render();
      setTimeout(function () { q.focus(); }, 50);
    });
  }

  /* ============================================================ field builders */
  var TYPES = { text: 'text', tel: 'tel', email: 'email', url: 'text', password: 'password' };
  function wrap(f, control, labelFor) {
    return h('div', { class: 'fld fld-' + f.t + (f.w ? ' w-' + f.w : '') },
      f.label ? h('label', { class: 'fld-label', for: labelFor || null }, f.label + (f.required ? ' *' : '')) : null,
      control,
      f.help ? h('p', { class: 'fld-help', text: f.help }) : null);
  }
  function mediaKind(t) { return t === 'video' ? 'video' : t === 'fontfile' ? 'font' : 'image'; }
  function thumbUrl(url) { return /^\/(images|media\/img)\/.+\.(webp|jpg|jpeg|png)$/.test(url) ? url.replace(/(\.\w+)$/, '-sm$1') : url; }

  var B = {
    text: function (f, v) {
      var id = nextId();
      var i = h('input', { id: id, type: TYPES[f.t] || 'text', value: v == null ? '' : v, maxlength: f.max || 300, placeholder: f.placeholder || null, required: f.required || null, autocomplete: f.t === 'password' ? 'new-password' : 'off' });
      return { el: wrap(f, i, id), get: function () { return i.value; }, input: i };
    },
    number: function (f, v) {
      var id = nextId();
      var i = h('input', { id: id, type: 'number', value: v == null ? '' : v, min: f.min, max: f.max, step: f.step || 1, inputmode: 'decimal' });
      return { el: wrap(f, i, id), get: function () { return i.value === '' ? (f.min || 0) : Number(i.value); }, input: i };
    },
    textarea: function (f, v) {
      var id = nextId();
      var t = h('textarea', { id: id, rows: f.rows || 3, maxlength: f.max || 5000, placeholder: f.placeholder || null, spellcheck: f.t === 'code' ? 'false' : null, style: f.t === 'code' ? 'font-family:ui-monospace,Menlo,monospace;font-size:.86rem' : null });
      t.value = v == null ? '' : v;
      return { el: wrap(f, t, id), get: function () { return t.value; }, input: t };
    },
    toggle: function (f, v) {
      var i = h('input', { type: 'checkbox', checked: !!v });
      var el = h('div', { class: 'fld fld-toggle' + (f.w ? ' w-' + f.w : '') },
        h('label', { class: 'switch' }, i, h('span', { class: 'track' }), h('span', { text: f.label })),
        f.help ? h('p', { class: 'fld-help', text: f.help }) : null);
      return { el: el, get: function () { return i.checked; }, input: i };
    },
    select: function (f, v) {
      var id = nextId();
      var s = h('select', { id: id }, (f.options || []).map(function (o) { return h('option', { value: o.v, selected: o.v === v ? true : null }, o.l); }));
      if (v != null && !(f.options || []).some(function (o) { return o.v === v; }) && f.options && f.options.length) s.value = f.options[0].v;
      return { el: wrap(f, s, id), get: function () { return s.value; }, input: s };
    },
    date: function (f, v) {
      var id = nextId();
      var i = h('input', { id: id, type: f.t === 'datetime' ? 'datetime-local' : 'date', value: v || '' });
      return { el: wrap(f, i, id), get: function () { return i.value; }, input: i };
    },
    tags: function (f, v) {
      var id = nextId();
      var i = h('input', { id: id, type: 'text', value: (v || []).join(', '), placeholder: f.placeholder || 'tag one, tag two' });
      return { el: wrap(f, i, id), get: function () { return i.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); }, input: i };
    },
    strings: function (f, v) {
      var id = nextId();
      var t = h('textarea', { id: id, rows: f.rows || 4 });
      t.value = (v || []).join('\n');
      return { el: wrap(f, t, id), get: function () { return t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }, input: t };
    },
    color: function (f, v) {
      var val = /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000';
      var c = h('input', { type: 'color', value: val, 'aria-label': f.label });
      var t = h('input', { type: 'text', value: val.toUpperCase(), maxlength: 7, 'aria-label': f.label + ' hex' });
      c.addEventListener('input', function () { t.value = c.value.toUpperCase(); });
      t.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(t.value)) { c.value = t.value; } });
      return {
        el: wrap(f, h('div', { class: 'color-row' }, c, t)),
        get: function () { return /^#[0-9a-f]{6}$/i.test(t.value) ? t.value.toUpperCase() : c.value.toUpperCase(); },
        set: function (x) { c.value = x; t.value = x.toUpperCase(); },
      };
    },
    image: function (f, v) {
      var kind = mediaKind(f.t);
      var value = v || '';
      var prev = h('div', { class: 'img-prev' });
      var removeBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () { value = ''; paint(); fire(el); } }, icon('x'), 'Remove');
      function paint() {
        prev.replaceChildren();
        prev.classList.toggle('is-contain', /\.(png|svg)$/.test(value));
        if (!value) prev.append(icon(kind === 'image' ? 'image' : kind === 'video' ? 'film' : 'type', 26));
        else if (kind === 'image') prev.append(h('img', { src: thumbUrl(value), alt: '' }));
        else if (kind === 'video') prev.append(h('video', { src: value, muted: true, preload: 'metadata' }));
        else prev.append(h('span', { class: 'muted', style: 'font-size:.75rem;padding:6px;word-break:break-all', text: value.split('/').pop() }));
        removeBtn.hidden = !value;
      }
      var el = wrap(f, h('div', { class: 'img-field' }, prev, h('div', { class: 'img-btns' },
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () {
          pickMedia({ kind: kind }).then(function (r) { if (r) { value = r[0]; paint(); fire(el); } });
        } }, icon('image'), value ? 'Change' : 'Choose'), removeBtn)));
      paint();
      return { el: el, get: function () { return value; }, preview: function () { return value; } };
    },
    images: function (f, v) {
      var list = (v || []).slice();
      var grid = h('div', { class: 'imgs-grid' });
      function move(i, d) { var j = i + d; if (j < 0 || j >= list.length) return; var t = list[i]; list[i] = list[j]; list[j] = t; paint(); fire(el); }
      function paint() {
        grid.replaceChildren();
        list.forEach(function (url, i) {
          grid.append(h('div', { class: 'imgs-item' }, h('img', { src: thumbUrl(url), alt: '', loading: 'lazy' }),
            i === 0 ? h('span', { class: 'cover-tag', text: 'Cover' }) : null,
            h('div', { class: 'imgs-tools' },
              h('button', { type: 'button', title: 'Move left', onclick: function () { move(i, -1); } }, icon('chevron-left')),
              h('button', { type: 'button', title: 'Remove', onclick: function () { list.splice(i, 1); paint(); fire(el); } }, icon('trash')),
              h('button', { type: 'button', title: 'Move right', onclick: function () { move(i, 1); } }, icon('chevron-right')))));
        });
        grid.append(h('button', { type: 'button', class: 'imgs-add', onclick: function () {
          pickMedia({ kind: 'image', multiple: true }).then(function (r) { if (r) { list = list.concat(r); paint(); fire(el); } });
        } }, icon('plus', 22), 'Add photos'));
      }
      var el = wrap(f, grid);
      paint();
      return { el: el, get: function () { return list.slice(); } };
    },
    icon: function (f, v) {
      var value = v || 'sparkle';
      var label = h('span');
      var holder = h('span', { style: 'display:inline-grid;color:var(--a-primary)' });
      var id = nextId();
      var btn = h('button', { type: 'button', class: 'icon-pick', id: id, onclick: function () {
        pickIcon(value).then(function (n) { if (n) { value = n; paint(); fire(el); } });
      } }, holder, label, icon('chevron-down'));
      function paint() { holder.replaceChildren(icon(value, 20)); label.textContent = value; }
      var el = wrap(f, btn, id);
      paint();
      return { el: el, get: function () { return value; }, iconName: function () { return value; } };
    },
    font: function (f, v) {
      var id = nextId();
      var fonts = (META && META.fonts) || [];
      var known = fonts.indexOf(v) >= 0;
      var sel = h('select', { id: id }, fonts.map(function (n) { return h('option', { value: n, selected: n === v ? true : null }, n); }), h('option', { value: '__custom', selected: !known && v ? true : null }, 'Other Google font / uploaded font…'));
      var custom = h('input', { type: 'text', placeholder: 'Exact font family name, e.g. Lexend', value: known ? '' : v || '', hidden: known || !v ? true : null, maxlength: 48 });
      var prev = h('div', { class: 'font-preview', text: 'VP Residency — Classy Comfort Living' });
      function current() { return sel.value === '__custom' ? custom.value.trim() : sel.value; }
      function paint() {
        custom.hidden = sel.value !== '__custom';
        var name = current();
        prev.style.fontFamily = name && name !== 'System default' ? "'" + name + "', serif" : 'system-ui';
        loadGoogleFont(document, name);
      }
      sel.addEventListener('change', paint);
      custom.addEventListener('change', paint);
      paint();
      return { el: wrap(f, h('div', { class: 'stack', style: 'gap:6px' }, sel, custom, prev), id), get: current };
    },
    markdown: function (f, v) {
      var id = nextId();
      var t = h('textarea', { id: id, rows: f.rows || 10 });
      t.value = v || '';
      var preview = h('div', { class: 'md-preview', hidden: true });
      function surround(a, b, ph) {
        var s = t.selectionStart, e = t.selectionEnd, sel = t.value.slice(s, e) || ph || '';
        t.setRangeText(a + sel + (b == null ? a : b), s, e, 'end');
        t.focus();
        fire(t);
      }
      function linePrefix(p) {
        var s = t.selectionStart;
        var ls = t.value.lastIndexOf('\n', s - 1) + 1;
        t.setRangeText(p, ls, ls, 'end');
        t.focus();
        fire(t);
      }
      var prevBtn;
      var bar = h('div', { class: 'md-bar' },
        h('button', { type: 'button', title: 'Bold', onclick: function () { surround('**', '**', 'bold text'); } }, 'B'),
        h('button', { type: 'button', title: 'Italic', style: 'font-style:italic', onclick: function () { surround('_', '_', 'italic'); } }, 'I'),
        h('span', { class: 'sep' }),
        h('button', { type: 'button', title: 'Heading', onclick: function () { linePrefix('## '); } }, 'H2'),
        h('button', { type: 'button', title: 'Sub-heading', onclick: function () { linePrefix('### '); } }, 'H3'),
        h('button', { type: 'button', title: 'Bullet list', onclick: function () { linePrefix('- '); } }, icon('list')),
        h('button', { type: 'button', title: 'Quote', onclick: function () { linePrefix('> '); } }, icon('quote')),
        h('button', { type: 'button', title: 'Link', onclick: function () {
          var url = prompt('Link address (https://… or /page):');
          if (url) surround('[', '](' + url + ')', 'link text');
        } }, icon('link')),
        h('button', { type: 'button', title: 'Photo', onclick: function () {
          pickMedia({ kind: 'image' }).then(function (r) { if (r) surround('![', '](' + r[0] + ')', 'photo description'); });
        } }, icon('image')),
        h('span', { class: 'sep' }),
        prevBtn = h('button', { type: 'button', title: 'Preview', onclick: function () {
          var on = preview.hidden;
          preview.hidden = !on; t.hidden = on;
          prevBtn.classList.toggle('is-active', on);
          if (on) {
            preview.textContent = 'Loading preview…';
            fetch('/admin/api/markdown', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': CSRF }, body: JSON.stringify({ md: t.value }) })
              .then(function (r) { return r.json(); }).then(function (j) { preview.innerHTML = j.html; });
          }
        } }, icon('eye'), ' Preview'));
      return { el: wrap(f, h('div', { class: 'md-wrap' }, bar, t, preview), id), get: function () { return t.value; }, input: t };
    },
    list: function (f, v, ctx) {
      var container = h('div', { class: 'list-field' });
      var itemsBox = h('div', { class: 'list-field' });
      var map = new WeakMap();
      var dragEl = null;
      var titleField = (f.fields || []).find(function (x) { return x.k === f.itemTitle; });
      function itemTitle(it) {
        var val = it.builders[f.itemTitle] ? it.builders[f.itemTitle].get() : '';
        if (titleField && titleField.t === 'select') {
          var o = (titleField.options || []).find(function (x) { return x.v === val; });
          if (o) val = o.l;
        }
        return val;
      }
      function paintTitle(it) {
        var title = itemTitle(it);
        var img = (f.fields || []).find(function (x) { return x.t === 'image'; });
        var ic = (f.fields || []).find(function (x) { return x.t === 'icon'; });
        var bits = [];
        if (img && it.builders[img.k].get()) bits.push(h('img', { src: thumbUrl(it.builders[img.k].get()), alt: '' }));
        if (ic) bits.push(h('span', { class: 'li-icon' }, icon(it.builders[ic.k].get(), 18)));
        bits.push(h('span', { text: title || '(untitled)' }));
        it.title.replaceChildren.apply(it.title, bits);
        var en = it.builders.enabled;
        it.title.classList.toggle('is-off', !!en && !en.get());
      }
      function add(value, collapsed, before) {
        var builders = {};
        var body = h('div', { class: 'li-body' });
        (f.fields || []).forEach(function (sf) {
          var b = build(sf, value ? value[sf.k] : undefined, ctx);
          builders[sf.k] = b;
          body.append(b.el);
        });
        wireSlugs(f.fields || [], builders, value);
        var title = h('span', { class: 'li-title' });
        var tools = h('div', { class: 'li-tools' });
        var item = h('div', { class: 'li-item' + (collapsed ? ' is-collapsed' : '') });
        var it = { el: item, builders: builders, title: title };
        function tool(name, label, fn) { tools.append(h('button', { type: 'button', title: label, 'aria-label': label, onclick: function (e) { e.stopPropagation(); fn(); } }, icon(name))); }
        tool('chevron-up', 'Move up', function () { if (item.previousElementSibling) { itemsBox.insertBefore(item, item.previousElementSibling); fire(itemsBox); } });
        tool('chevron-down', 'Move down', function () { if (item.nextElementSibling) { itemsBox.insertBefore(item.nextElementSibling, item); fire(itemsBox); } });
        if (ctx && ctx.page === 'festivals' && f.k === 'items') {
          tool('eye', 'Preview on the website', function () { window.open('/?festival=' + encodeURIComponent(builders.id.get() || slugify(builders.name.get())), '_blank'); });
        }
        if (!f.fixed) {
          tool('copy', 'Duplicate', function () { var val = {}; Object.keys(builders).forEach(function (k) { val[k] = builders[k].get(); }); add(val, false, item.nextElementSibling); fire(itemsBox); });
          tool('trash', 'Remove', function () { if (confirm('Remove this item?')) { item.remove(); fire(itemsBox); } });
        }
        var grip = h('span', { class: 'grip', title: 'Drag to reorder' }, icon('grip-vertical'));
        var head = h('div', { class: 'li-head', onclick: function () { item.classList.toggle('is-collapsed'); } }, grip, title, tools);
        grip.addEventListener('mousedown', function () { item.draggable = true; });
        grip.addEventListener('touchstart', function () { item.draggable = true; }, { passive: true });
        item.addEventListener('dragstart', function (e) { dragEl = item; item.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (x) {} });
        item.addEventListener('dragend', function () { item.draggable = false; item.classList.remove('is-dragging'); $$('.drag-over', itemsBox).forEach(function (x) { x.classList.remove('drag-over'); }); dragEl = null; fire(itemsBox); });
        item.addEventListener('dragover', function (e) { if (!dragEl || dragEl === item || dragEl.parentNode !== itemsBox) return; e.preventDefault(); item.classList.add('drag-over'); });
        item.addEventListener('dragleave', function () { item.classList.remove('drag-over'); });
        item.addEventListener('drop', function (e) { if (!dragEl || dragEl.parentNode !== itemsBox) return; e.preventDefault(); item.classList.remove('drag-over'); itemsBox.insertBefore(dragEl, item); });
        item.append(head, body);
        body.addEventListener('input', function () { paintTitle(it); });
        body.addEventListener('change', function () { paintTitle(it); });
        paintTitle(it);
        map.set(item, it);
        if (before) itemsBox.insertBefore(item, before); else itemsBox.append(item);
        return it;
      }
      var initial = Array.isArray(v) ? v : [];
      initial.forEach(function (val) { add(val, initial.length > 3); });
      container.append(itemsBox);
      if (!f.fixed) {
        var actions = h('div', { class: 'list-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () {
            if (f.maxItems && itemsBox.children.length >= f.maxItems) return alert('You can add up to ' + f.maxItems + ' items.');
            var it = add({}, false);
            fire(itemsBox);
            var first = $('input,textarea,select', it.el);
            if (first) first.focus();
          } }, icon('plus'), 'Add item'));
        if (f.bulkImage) {
          actions.append(h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () {
            pickMedia({ kind: 'image', multiple: true }).then(function (r) {
              if (!r) return;
              r.forEach(function (url) { var val = {}; val[f.bulkImage] = url; add(val, true); });
              fire(itemsBox);
            });
          } }, icon('images'), 'Add photos'));
        }
        container.append(actions);
      }
      var el = h('div', { class: 'fld fld-list' + (f.w ? ' w-' + f.w : '') }, f.label ? h('span', { class: 'fld-label', text: f.label }) : null, f.help ? h('p', { class: 'fld-help', text: f.help }) : null, container);
      return {
        el: el,
        get: function () {
          return Array.prototype.map.call(itemsBox.children, function (node) {
            var it = map.get(node), out = {};
            Object.keys(it.builders).forEach(function (k) { out[k] = it.builders[k].get(); });
            return out;
          });
        },
      };
    },
    group: function (f, v, ctx) {
      var builders = {};
      var box = h('div', { class: 'li-body', style: 'border:0;padding:0' });
      (f.fields || []).forEach(function (sf) { var b = build(sf, (v || {})[sf.k], ctx); builders[sf.k] = b; box.append(b.el); });
      return { el: wrap(f, box), get: function () { var o = {}; Object.keys(builders).forEach(function (k) { o[k] = builders[k].get(); }); return o; } };
    },
  };
  B.tel = B.email = B.url = B.password = B.text;
  B.code = B.textarea;
  B.datetime = B.date;
  B.video = B.fontfile = B.image;

  function build(f, v, ctx) { return (B[f.t] || B.text)(f, v, ctx); }

  function wireSlugs(fields, builders, value) {
    fields.forEach(function (f) {
      if (!f.slugFrom || !builders[f.k] || !builders[f.slugFrom]) return;
      var slugIn = builders[f.k].input, src = builders[f.slugFrom].input;
      if (!slugIn || !src) return;
      var auto = !(value && value[f.k]);
      slugIn.addEventListener('input', function () { auto = slugIn.value === ''; });
      src.addEventListener('input', function () { if (auto) slugIn.value = slugify(src.value); });
    });
  }

  /* ============================================================ schema forms */
  function buildForm(root, schema, value, ctx) {
    root.replaceChildren();
    var groups = [];
    var many = schema.length > 4;
    schema.forEach(function (sec, si) {
      var scope = sec.k ? value[sec.k] || {} : value;
      var grid = h('div', { class: 'f-grid' });
      var builders = {};
      sec.fields.forEach(function (f) { var b = build(f, scope[f.k], ctx); builders[f.k] = b; grid.append(b.el); });
      wireSlugs(sec.fields, builders, scope);
      var det = h('details', { class: 'f-section', open: !many || si < 2 ? true : null },
        h('summary', null, h('div', null, h('h2', { text: sec.title }), sec.desc ? h('p', { text: sec.desc }) : null), h('span', { class: 'chev' }, icon('chevron-down', 18))),
        grid);
      root.append(det);
      groups.push({ k: sec.k, builders: builders, det: det, grid: grid });
    });
    return {
      groups: groups,
      get: function () {
        var out = {};
        groups.forEach(function (g) {
          var o = {};
          Object.keys(g.builders).forEach(function (k) { o[k] = g.builders[k].get(); });
          if (g.k) out[g.k] = o; else Object.keys(o).forEach(function (k) { out[k] = o[k]; });
        });
        return out;
      },
    };
  }

  function initSchemaForm(form) {
    var root = $('[data-form-root]', form);
    var schema = JSON.parse($('[data-schema]', form).textContent);
    var value = JSON.parse($('[data-value]', form).textContent) || {};
    var metaEl = $('[data-meta]', form);
    var ctx = metaEl ? JSON.parse(metaEl.textContent) : {};
    var dirty = false;
    var note = $('[data-dirty-note]', form);
    var api;
    function setDirty(d) { dirty = d; if (note) note.hidden = !d; }
    function render(v) {
      api = buildForm(root, schema, v, ctx);
      if (ctx.page === 'theme') themePage(form, api, render);
    }
    loadMeta().then(function () { render(value); }).catch(function () { root.textContent = 'Could not load the editor. Please refresh the page.'; });
    root.addEventListener('input', function () { setDirty(true); });
    root.addEventListener('change', function () { setDirty(true); });
    form.addEventListener('submit', function (e) {
      if (!api) { e.preventDefault(); return; }
      var missing = [];
      schema.forEach(function (sec) {
        sec.fields.forEach(function (f) {
          if (!f.required) return;
          var all = api.get(), scope = sec.k ? all[sec.k] : all;
          if (!scope[f.k]) missing.push(f.label);
        });
      });
      if (missing.length) { e.preventDefault(); alert('Please fill in: ' + missing.join(', ')); return; }
      form.elements.payload.value = JSON.stringify(api.get());
      setDirty(false);
      var btn = $('button[type=submit]', $('.form-bar', form));
      if (btn) { btn.disabled = true; btn.lastChild.textContent = ' Saving…'; }
    });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); form.requestSubmit(); }
    });
    form._api = function () { return api; };
  }

  /* ============================================================ theme live preview */
  function googleFontsHref(names) {
    var fam = names.filter(function (n) { return n && n !== 'System default' && /^[A-Za-z0-9 ]{2,48}$/.test(n); }).map(function (n) {
      var w = META && META.fontWeights && META.fontWeights[n];
      return 'family=' + n.replace(/ /g, '+') + (w ? ':wght@' + w : '');
    });
    return fam.length ? 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap' : '';
  }
  var loadedFonts = {};
  function loadGoogleFont(doc, name) {
    if (!name || name === 'System default' || !/^[A-Za-z0-9 ]{2,48}$/.test(name)) return;
    var key = (doc === document ? 'admin:' : 'frame:') + name;
    if (loadedFonts[key] && doc === document) return;
    loadedFonts[key] = true;
    var href = googleFontsHref([name]);
    if (!href) return;
    doc.head.append(h('link', { rel: 'stylesheet', href: href }));
  }
  function stack(name, fallback) {
    if (!name || name === 'System default') return fallback === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif';
    return "'" + name + "', " + (fallback === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif');
  }
  function themePage(form, api, rerender) {
    var frame = $('[data-theme-preview]');
    var presetSel = null;
    api.groups.forEach(function (g) { if (g.builders.preset) presetSel = g.builders.preset; });
    if (presetSel && META.presets) {
      var row = h('div', { class: 'preset-row' });
      Object.keys(META.presets).forEach(function (key) {
        var p = META.presets[key];
        row.append(h('button', { type: 'button', class: 'preset', onclick: function () { applyPreset(key); } },
          h('span', { class: 'sw' }, h('i', { style: 'background:' + p.values.primary }), h('i', { style: 'background:' + p.values.accent }), h('i', { style: 'background:' + p.values.bg + ';box-shadow:inset 0 0 0 1px #0001' })),
          p.label));
      });
      api.groups[0].det.append(row);
      presetSel.input.addEventListener('change', function () { if (META.presets[presetSel.input.value]) applyPreset(presetSel.input.value); });
    }
    function applyPreset(key) {
      var v = api.get();
      var p = META.presets[key];
      Object.keys(p.values).forEach(function (k) { v[k] = p.values[k]; });
      v.preset = key;
      rerender(v);
      fire($('[data-form-root]', form));
      setTimeout(function () { var a = form._api(); paint(a.get()); }, 0);
    }
    function paint(v) {
      if (!frame || !frame.contentDocument || !frame.contentDocument.documentElement) return;
      var d = frame.contentDocument, r = d.documentElement;
      Object.keys(META.themeVars).forEach(function (k) { if (/^#[0-9a-f]{6}$/i.test(v[k] || '')) r.style.setProperty(META.themeVars[k], v[k]); });
      r.style.setProperty('--f-heading', stack(v.headingFont, 'serif'));
      r.style.setProperty('--f-body', stack(v.bodyFont, 'sans'));
      r.style.setProperty('--f-brand', stack(v.brandFont, 'serif'));
      r.style.setProperty('--fw-heading', v.headingWeight || '600');
      r.style.setProperty('--fs-base', (v.baseSize || 16) + 'px');
      r.style.setProperty('--radius', (v.radius || 0) + 'px');
      r.style.setProperty('--radius-btn', v.buttonShape === 'pill' ? '999px' : v.buttonShape === 'square' ? '3px' : Math.min(v.radius || 0, 12) + 'px');
      r.dataset.anim = v.animations ? 'on' : 'off';
      r.dataset.kenburns = v.kenBurns ? 'on' : 'off';
      [v.headingFont, v.bodyFont, v.brandFont].forEach(function (n) { loadGoogleFont(d, n); });
      var custom = d.getElementById('pv-custom-css');
      if (!custom) { custom = d.createElement('style'); custom.id = 'pv-custom-css'; d.head.append(custom); }
      custom.textContent = (v.customCss || '').replace(/</g, '');
      $$('.pattern', d).forEach(function (p) { p.style.display = v.heroPattern ? '' : 'none'; });
    }
    var root = $('[data-form-root]', form);
    var raf = 0;
    var onChange = function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { paint(form._api().get()); }); };
    if (!root._themeBound) {
      root.addEventListener('input', onChange);
      root.addEventListener('change', onChange);
      root._themeBound = true;
      if (frame) frame.addEventListener('load', onChange);
      $$('[data-preview-size]').forEach(function (b) {
        b.addEventListener('click', function () {
          $$('[data-preview-size]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
          $('[data-preview-wrap]').classList.toggle('is-mobile', b.dataset.previewSize === 'mobile');
        });
      });
    }
  }

  /* ============================================================ media library page */
  function initMediaLibrary() {
    var dz = $('[data-dropzone]');
    if (!dz) return;
    var input = $('[data-upload-input]', dz);
    var prog = $('[data-upload-progress]', dz);
    async function go(files) {
      if (!files.length) return;
      prog.hidden = false;
      var items = await uploadFiles(files, function (i, n, name) { prog.textContent = 'Uploading ' + i + ' of ' + n + ': ' + name; });
      prog.textContent = items.length ? 'Done — refreshing…' : '';
      if (items.length) location.href = '/admin/media?kind=' + encodeURIComponent(dz.dataset.kind) + '&ok=uploaded';
    }
    input.addEventListener('change', function () { go(Array.prototype.slice.call(input.files)); });
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function () { dz.classList.remove('is-over'); }); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); go(Array.prototype.slice.call(e.dataTransfer.files)); });

    var dlg = $('[data-media-dialog]');
    if (!dlg) return;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-media-open]');
      if (!b) return;
      var d = b.dataset;
      var prev = $('[data-md-preview]', dlg);
      prev.replaceChildren(d.kind === 'image' ? h('img', { src: d.url, alt: d.alt || '' }) : d.kind === 'video' ? h('video', { src: d.url, controls: true }) : h('a', { href: d.url, target: '_blank', rel: 'noopener', class: 'btn btn-ghost' }, 'Open file'));
      $('[data-md-name]', dlg).textContent = d.name;
      $('[data-md-meta]', dlg).textContent = [d.dims, d.size, 'uploaded ' + d.date].filter(Boolean).join(' · ');
      $('[data-md-url]', dlg).value = location.origin + d.url;
      $('[data-md-alt]', dlg).value = d.alt || '';
      $('[data-md-alt-form]', dlg).action = '/admin/media/' + d.id + '/alt';
      $('[data-md-delete-form]', dlg).action = '/admin/media/' + d.id + '/delete';
      var usage = $('[data-md-usage]', dlg);
      usage.textContent = 'Checking where this file is used…';
      fetch('/admin/api/media/' + d.id + '/usage', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        usage.replaceChildren();
        if (!j.usage.length) usage.textContent = 'Not used on any page yet.';
        else {
          usage.append('Used in: ');
          j.usage.forEach(function (u, i) { if (i) usage.append(', '); usage.append(h('a', { href: u.href }, u.label)); });
        }
      });
      dlg.showModal();
    });
    $('[data-md-close]', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $('[data-md-copy]', dlg).addEventListener('click', function () {
      navigator.clipboard.writeText($('[data-md-url]', dlg).value).then(function () { toast('Link copied'); });
    });
  }

  /* ============================================================ misc */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-confirm]');
    if (f && !confirm(f.dataset.confirm)) e.preventDefault();
  }, true);
  document.addEventListener('change', function (e) {
    var f = e.target.closest('[data-autosubmit]');
    if (f && e.target.tagName === 'SELECT') f.submit();
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-copy-text]');
    if (t) navigator.clipboard.writeText(t.textContent.trim()).then(function () { toast('Copied'); });
    if (e.target.closest('[data-side-toggle]')) document.body.classList.toggle('side-open');
    if (e.target.closest('[data-side-scrim]')) document.body.classList.remove('side-open');
  });
  var flash = $('[data-flash]');
  if (flash && history.replaceState) {
    var u = new URL(location.href);
    u.searchParams.delete('ok');
    history.replaceState(null, '', u);
  }

  $$('[data-schema-form]').forEach(initSchemaForm);
  initMediaLibrary();
  if (!$('[data-schema-form]')) loadMeta().catch(function () {});
})();
