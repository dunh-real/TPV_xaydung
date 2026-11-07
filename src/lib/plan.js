import { generatePlan } from './engine.js';

// Cùng một mô hình đã biên tập cho Twin và hồ sơ.
export function currentPlan(st) {
  const t = st.twin;
  if (!t.scenario) return null;
  const plan = generatePlan(t.scenario, st.params);
  plan.buildings = plan.buildings.map((b) => {
    const e = t.planEdits?.[b.id] || {}, x = e.x ?? b.x, y = e.y ?? b.y, w = e.w ?? b.w, d = e.d ?? b.d;
    return { ...b, ...e, x, y, w, d, materialCode: e.materialCode ?? b.materialCode ?? 'BT-C30', cx: x + w / 2, cy: y + d / 2 };
  }).filter((b) => !b.deleted).concat((t.customBuildings || []).map((b) => ({ ...b, materialCode: b.materialCode || 'BT-C30', cx: b.x + b.w / 2, cy: b.y + b.d / 2 })));
  return plan;
}
