// Tiện ích dùng chung
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = new Intl.NumberFormat('vi-VN');
export const fmt = (n, d = 0) =>
  n == null || isNaN(n) ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
export const fmtInt = (n) => nf.format(Math.round(n));
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toast(msg, type = 'info', ms = 3200) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function modal({ title, body, actions = [], wide = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">
    <div class="modal-head"><b>${title}</b><button class="x" data-close>✕</button></div>
    <div class="modal-body"></div>
    <div class="modal-foot"></div></div>`;
  const bodyEl = wrap.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  const foot = wrap.querySelector('.modal-foot');
  const close = () => wrap.remove();
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.className = a.cls || 'btn';
    b.textContent = a.label;
    b.onclick = async () => {
      const r = a.onClick ? await a.onClick(wrap) : undefined;
      if (r !== false) close();
    };
    foot.appendChild(b);
  });
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.hasAttribute('data-close')) close();
  });
  document.body.appendChild(wrap);
  return { el: wrap, close };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bộ sinh số ngẫu nhiên có seed (để kết quả mô phỏng lặp lại được)
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, d) => {
  const t = new Date(iso + 'T00:00:00');
  t.setDate(t.getDate() + Math.round(d));
  return t.toISOString().slice(0, 10);
};
export const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
export const viDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
export const viLongDate = (iso) => {
  const [y, m, d] = (iso || todayISO()).split('-');
  return `ngày ${d} tháng ${m} năm ${y}`;
};
