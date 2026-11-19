/*
 * jm-mobile.js — jambatan kecil antara web app JM dan shell native (Tauri/Rust).
 * Disuntik ke setiap HTML oleh scripts/prepare-web.mjs.
 *
 * Kenapa perlu: WebView Android/iOS tak sokong beberapa benda yang browser biasa buat:
 *  - <a download> / a.click() untuk backup JSON, CSV, PDF (jsPDF)  -> guna dialog "Simpan" native
 *  - window.open / target="_blank" ke Google Sheets, Drive dsb.      -> buka dalam browser telefon
 *  - window.print()                                                   -> belum ada, papar notis
 *
 * Kalau fail ini dibuka dalam browser biasa (bukan app), ia tak buat apa-apa.
 * Semua panggilan native dibuat di frame atas (hub) supaya iframe modul tak perlu akses IPC sendiri.
 */
(function () {
  'use strict';
  if (window.__JM_SHIM__) return;
  window.__JM_SHIM__ = true;

  var isTop = false;
  try { isTop = window.top === window; } catch (e) { isTop = false; }

  /* ---------- Bahagian frame atas: semua kerja native ---------- */
  if (isTop) {
    var T = window.__TAURI__;
    if (!T) return; // browser biasa — biar semua berjalan macam web

    var IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    var toast = function (msg) {
      var show = function () {
        var el = document.getElementById('jm-native-toast');
        if (!el) {
          el = document.createElement('div');
          el.id = 'jm-native-toast';
          el.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));' +
            'transform:translateX(-50%);max-width:88vw;background:#0B1F3A;color:#fff;border:1px solid #C9A227;' +
            'padding:10px 16px;border-radius:10px;font:500 13px/1.4 Inter,system-ui,sans-serif;z-index:2147483647;' +
            'box-shadow:0 8px 24px rgba(0,0,0,.25);transition:opacity .2s;opacity:0;pointer-events:none;text-align:center';
          document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.style.opacity = '0'; }, 2800);
      };
      if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
    };

    var openExternal = function (url) {
      var p = (T.opener && T.opener.openUrl)
        ? T.opener.openUrl(url)
        : T.core.invoke('plugin:opener|open_url', { url: url });
      return Promise.resolve(p).catch(function (err) {
        console.error('[jm-mobile] openUrl gagal', err);
        toast('Tak dapat buka pautan luar.');
      });
    };

    var saveBytes = function (name, buffer) {
      // buffer mungkin datang dari realm iframe; bina Uint8Array dalam realm atas
      var bytes = new Uint8Array(buffer);
      var dialogSave = (T.dialog && T.dialog.save)
        ? T.dialog.save({ defaultPath: name, title: 'Simpan fail' })
        : T.core.invoke('plugin:dialog|save', { options: { defaultPath: name, title: 'Simpan fail' } });
      return Promise.resolve(dialogSave).then(function (path) {
        if (!path) return false; // pengguna batal
        return T.fs.writeFile(path, bytes).then(function () {
          toast('Disimpan: ' + name);
          return true;
        });
      }).catch(function (err) {
        console.error('[jm-mobile] simpan gagal', err);
        toast('Gagal simpan fail: ' + (err && err.message ? err.message : err));
        return false;
      });
    };

    var showImage = function (src) {
      var o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;background:rgba(5,12,25,.92);z-index:2147483646;display:flex;' +
        'align-items:center;justify-content:center;padding:16px';
      var img = document.createElement('img');
      img.src = src;
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:8px';
      var x = document.createElement('button');
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Tutup');
      x.style.cssText = 'position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:40px;height:40px;' +
        'border-radius:50%;border:1px solid #C9A227;background:#0B1F3A;color:#fff;font-size:18px';
      o.appendChild(img); o.appendChild(x);
      o.addEventListener('click', function () { o.remove(); });
      document.body.appendChild(o);
    };

    window.__JM_NATIVE__ = {
      mobile: IS_MOBILE,
      toast: toast,
      openExternal: openExternal,
      saveBytes: saveBytes,
      showImage: showImage
    };
  }

  /* ---------- Bahagian setiap frame: pintas API browser ---------- */
  var N = null;
  try { N = window.top.__JM_NATIVE__ || null; } catch (e) { N = null; }
  if (!N) return;

  var absUrl = function (u) {
    try { return new URL(String(u), location.href); } catch (e) { return null; }
  };
  var isExternal = function (u) {
    var x = absUrl(u);
    if (!x) return false;
    if (x.protocol === 'mailto:' || x.protocol === 'tel:') return true;
    return (x.protocol === 'http:' || x.protocol === 'https:') && x.origin !== location.origin;
  };

  // Ada kod yang buat a.click() lepas tu terus revokeObjectURL — kita perlu masa untuk baca blob.
  var origRevoke = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) { setTimeout(function () { origRevoke(u); }, 60000); };

  var saveUrl = function (href, name) {
    name = (name && String(name).trim()) || 'fail';
    return fetch(href)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) { return N.saveBytes(name, buf); })
      .catch(function (err) {
        console.error('[jm-mobile] baca fail gagal', err);
        N.toast('Gagal sediakan fail untuk disimpan.');
      });
  };

  var handleAnchor = function (a) {
    var href = a.href;
    if (!href) return false;
    if (a.hasAttribute('download')) { saveUrl(href, a.getAttribute('download')); return true; }
    if (isExternal(href)) { N.openExternal(absUrl(href).href); return true; }
    if (/^data:image\//i.test(href) && a.target === '_blank') { N.showImage(href); return true; }
    return false;
  };

  // a.click() dan dispatchEvent(click) secara program (FileSaver/jsPDF guna cara ni)
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') || (!this.isConnected && isExternal(this.href))) {
      if (handleAnchor(this)) return;
    }
    return origClick.call(this);
  };
  var origDispatch = HTMLAnchorElement.prototype.dispatchEvent;
  HTMLAnchorElement.prototype.dispatchEvent = function (ev) {
    if (ev && ev.type === 'click' && this.hasAttribute('download')) {
      if (handleAnchor(this)) return false;
    }
    return origDispatch.call(this, ev);
  };

  // Tekan pautan sebenar oleh pengguna
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var raw = a.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#' || /^javascript:/i.test(raw)) return;
    if (handleAnchor(a)) e.preventDefault();
  }, true);

  // window.open
  window.open = function (url) {
    if (!url) return null;
    var s = String(url);
    if (isExternal(s)) { N.openExternal(absUrl(s).href); return null; }
    if (/^data:image\//i.test(s)) { N.showImage(s); return null; }
    if (/^(blob:|data:)/i.test(s)) { saveUrl(s, 'fail'); return null; }
    // Halaman dalaman: dalam app, modul dah terpapar dalam hub — tak perlu tab baru
    N.toast('Modul ini sudah dibuka dalam aplikasi.');
    return null;
  };

  // window.print tak berfungsi dalam WebView mobile
  if (N.mobile) {
    window.print = function () {
      N.toast('Cetak belum disokong dalam app mobile. Guna Backup/Export, atau buka versi web untuk cetak.');
    };
  }
})();
