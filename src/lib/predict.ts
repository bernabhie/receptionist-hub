// Simple Decision Tree for no-show / risk prediction.
// Trains on a list of past appointments with a binary `no_show` outcome,
// then predicts probability of no-show for a candidate slot.

export interface TrainingRow {
  hour: number;            // 0-23
  dayOfWeek: number;       // 0=Sun..6=Sat
  procedure: string;       // e.g. "checkup", "extraction"
  leadDays: number;        // days between booking creation and appt
  noShow: 0 | 1;
}

export interface PredictInput {
  hour: number;
  dayOfWeek: number;
  procedure: string;
  leadDays: number;
}

type Node =
  | { type: "leaf"; prob: number; n: number }
  | { type: "split"; feature: keyof PredictInput; threshold: number | string; left: Node; right: Node };

function gini(rows: TrainingRow[]): number {
  if (rows.length === 0) return 0;
  const p = rows.filter((r) => r.noShow === 1).length / rows.length;
  return 1 - p * p - (1 - p) * (1 - p);
}

function split(rows: TrainingRow[], feature: keyof PredictInput, threshold: number | string): [TrainingRow[], TrainingRow[]] {
  const left: TrainingRow[] = [];
  const right: TrainingRow[] = [];
  for (const r of rows) {
    const v = r[feature as keyof TrainingRow];
    const go = typeof threshold === "number" ? (v as number) <= threshold : v === threshold;
    (go ? left : right).push(r);
  }
  return [left, right];
}

function bestSplit(rows: TrainingRow[]): { feature: keyof PredictInput; threshold: number | string; gain: number } | null {
  const base = gini(rows);
  let best: { feature: keyof PredictInput; threshold: number | string; gain: number } | null = null;

  const numericFeats: (keyof PredictInput)[] = ["hour", "dayOfWeek", "leadDays"];
  for (const f of numericFeats) {
    const values = Array.from(new Set(rows.map((r) => r[f as keyof TrainingRow] as number))).sort((a, b) => a - b);
    for (let i = 0; i < values.length - 1; i++) {
      const t = (values[i] + values[i + 1]) / 2;
      const [l, r] = split(rows, f, t);
      if (l.length === 0 || r.length === 0) continue;
      const g = base - (l.length / rows.length) * gini(l) - (r.length / rows.length) * gini(r);
      if (!best || g > best.gain) best = { feature: f, threshold: t, gain: g };
    }
  }

  const procs = Array.from(new Set(rows.map((r) => r.procedure)));
  for (const p of procs) {
    const [l, r] = split(rows, "procedure", p);
    if (l.length === 0 || r.length === 0) continue;
    const g = base - (l.length / rows.length) * gini(l) - (r.length / rows.length) * gini(r);
    if (!best || g > best.gain) best = { feature: "procedure", threshold: p, gain: g };
  }

  return best && best.gain > 0.001 ? best : null;
}

function build(rows: TrainingRow[], depth: number, maxDepth: number, minSamples: number): Node {
  if (rows.length === 0) return { type: "leaf", prob: 0.2, n: 0 };
  const prob = rows.filter((r) => r.noShow === 1).length / rows.length;
  if (depth >= maxDepth || rows.length < minSamples) return { type: "leaf", prob, n: rows.length };
  const s = bestSplit(rows);
  if (!s) return { type: "leaf", prob, n: rows.length };
  const [l, r] = split(rows, s.feature, s.threshold);
  return {
    type: "split",
    feature: s.feature,
    threshold: s.threshold,
    left: build(l, depth + 1, maxDepth, minSamples),
    right: build(r, depth + 1, maxDepth, minSamples),
  };
}

export function trainDecisionTree(rows: TrainingRow[], maxDepth = 4, minSamples = 4): Node {
  return build(rows, 0, maxDepth, minSamples);
}

export function predictNoShow(tree: Node, input: PredictInput): number {
  let node: Node = tree;
  while (node.type === "split") {
    const v = input[node.feature];
    const go = typeof node.threshold === "number" ? (v as number) <= node.threshold : v === node.threshold;
    node = go ? node.left : node.right;
  }
  return node.prob;
}

// Suggest the best slot from candidate slots (lowest predicted no-show)
export interface SlotSuggestion {
  scheduledAt: Date;
  procedure: string;
  leadDays: number;
  riskPct: number;
}

export function rankSlots(
  tree: Node,
  candidates: { scheduledAt: Date; procedure: string; leadDays: number }[],
): SlotSuggestion[] {
  return candidates
    .map((c) => ({
      ...c,
      riskPct: predictNoShow(tree, {
        hour: c.scheduledAt.getHours(),
        dayOfWeek: c.scheduledAt.getDay(),
        procedure: c.procedure,
        leadDays: c.leadDays,
      }),
    }))
    .sort((a, b) => a.riskPct - b.riskPct);
}

// Build a default training set seeded with realistic dental clinic patterns
// (used as fallback when there's little historical data).
export function seedTrainingData(): TrainingRow[] {
  const rows: TrainingRow[] = [];
  const procs = ["checkup", "cleaning", "filling", "extraction", "root_canal", "consultation"];
  // Pattern: Monday mornings & Saturday late are higher risk; long lead = higher risk
  for (let i = 0; i < 120; i++) {
    const dayOfWeek = Math.floor(Math.random() * 7);
    const hour = 8 + Math.floor(Math.random() * 10);
    const procedure = procs[Math.floor(Math.random() * procs.length)];
    const leadDays = Math.floor(Math.random() * 30);
    let p = 0.1;
    if (dayOfWeek === 1 && hour < 10) p += 0.25;
    if (dayOfWeek === 6 && hour > 15) p += 0.2;
    if (leadDays > 14) p += 0.2;
    if (procedure === "extraction" || procedure === "root_canal") p += 0.1;
    if (hour >= 12 && hour <= 14) p += 0.05;
    const noShow = Math.random() < p ? 1 : 0;
    rows.push({ hour, dayOfWeek, procedure, leadDays, noShow });
  }
  return rows;
}
