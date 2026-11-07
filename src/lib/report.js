import { download } from './util.js';

export async function reportRequest(action, payload) {
  let res;
  try {
    res = await fetch('/api/reports/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(155000) });
  } catch (e) { throw new Error('Không kết nối được API hồ sơ. Chạy ứng dụng bằng npm run dev hoặc npm run preview. ' + e.message); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API hồ sơ lỗi ${res.status}`);
  }
  return action === 'export' ? res.blob() : res.json();
}

export async function exportReport(type, input, sections = {}, edits = {}, extra = []) {
  const blob = await reportRequest('export', { type, input, sections, edits, extra });
  const code = String(input.projectCode || 'du-an').replace(/[^\w-]/g, '_');
  download(`${code}_${type}.${type === 'estimate' ? 'xlsx' : 'docx'}`, blob);
}
