export interface Exercise {
  name: string;
  weight: number;
  sets: number;
  reps: number;
}

const finite = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function pearson(xs: number[], ys: number[]): number | null {
  const pairs = xs.map((x, i) => [finite(x), finite(ys[i])] as const)
    .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);
  if (pairs.length < 3) return null;
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const denX = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0));
  const denY = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0));
  return denX === 0 || denY === 0 ? null : numerator / (denX * denY);
}

export function linearRegression(pts: { x: number; y: number }[]): { slope: number; intercept: number; predict: (x: number) => number } | null {
  const valid = pts.filter(p => finite(p.x) !== null && finite(p.y) !== null);
  if (valid.length < 2) return null;
  const meanX = valid.reduce((sum, p) => sum + p.x, 0) / valid.length;
  const meanY = valid.reduce((sum, p) => sum + p.y, 0) / valid.length;
  const denominator = valid.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  if (!denominator) return null;
  const slope = valid.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, predict: (x: number) => slope * x + intercept };
}

export function correlationStrength(r: number): 'Strong' | 'Moderate' | 'Weak' {
  const absolute = Math.abs(r);
  return absolute >= 0.6 ? 'Strong' : absolute >= 0.3 ? 'Moderate' : 'Weak';
}

export function pctChange(prev: number, curr: number): number | null {
  return Number.isFinite(prev) && Number.isFinite(curr) && prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
}

export function monthKey(dateStr: string): string {
  return typeof dateStr === 'string' ? dateStr.slice(0, 7) : '';
}

export type MetricName = 'sleep' | 'water' | 'steps' | 'screen';
export type MetricBucket = '<4h' | '4-6h' | '6h+' | '<1L' | '1L-2L' | '2L+' | '<5k' | '5-10k' | '10k+' | '4-8h' | '8h+';

export function metricBucket(log: any, metric: MetricName): string {
  const bucketFields: Record<MetricName, string> = {
    sleep: 'sleepBucket',
    water: 'waterBucket',
    steps: 'stepsBucket',
    screen: 'screenBucket',
  };
  const explicit = log?.[bucketFields[metric]];
  if (typeof explicit === 'string' && explicit) return explicit;
  const value = finite(log?.[metric === 'sleep' ? 'sleepHours' : metric === 'water' ? 'water' : metric === 'steps' ? 'steps' : 'screenTime']);
  if (value === null) return '';
  if (metric === 'sleep') return value < 4 ? '<4h' : value < 6 ? '4-6h' : '6h+';
  if (metric === 'water') return value < 1 ? '<1L' : value < 2 ? '1L-2L' : '2L+';
  if (metric === 'steps') return value < 5000 ? '<5k' : value < 10000 ? '5-10k' : '10k+';
  return value < 4 ? '<4h' : value < 8 ? '4-8h' : '8h+';
}

export function isWorkoutDay(log: any): boolean {
  if (Array.isArray(log?.workoutCategories) && log.workoutCategories.some((category: any) => typeof category === 'string' && category.trim())) {
    return true;
  }
  const legacyCategory = typeof log?.workoutCategory === 'string' ? log.workoutCategory.trim().toLowerCase() : '';
  if (legacyCategory && !['no', 'none', 'rest'].includes(legacyCategory)) return true;
  return Array.isArray(log?.exercises) && log.exercises.some((exercise: any) => typeof exercise?.name === 'string' && exercise.name.trim());
}

export function weightedIntensity(exs: Exercise[]): number {
  let weighted = 0;
  let volume = 0;
  exs.forEach(ex => {
    const weight = finite(ex.weight) ?? 0;
    const sets = finite(ex.sets) ?? 0;
    const reps = finite(ex.reps) ?? 0;
    const exVolume = sets * reps;
    if (exVolume > 0) {
      weighted += weight * exVolume;
      volume += exVolume;
    }
  });
  return volume ? weighted / volume : 0;
}

export interface ExerciseProgress {
  name: string;
  sessions: { date: string; intensity: number; volume: number; topWeight: number }[];
  thisMonth: number;
  lastMonth: number;
  changePct: number | null;
  totalVolume: number;
}

export function exerciseProgress(healthLogs: any[]): ExerciseProgress[] {
  const groups = new Map<string, ExerciseProgress>();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  healthLogs.forEach(log => {
    if (!log?.date || !Array.isArray(log.exercises)) return;
    log.exercises.forEach((raw: any) => {
      const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
      if (!name) return;
      const key = name.toLowerCase();
      const weight = finite(raw.weight) ?? 0;
      const sets = finite(raw.sets) ?? 0;
      const reps = finite(raw.reps) ?? 0;
      const volume = Math.max(0, sets * reps);
      const entry: ExerciseProgress = groups.get(key) ?? { name, sessions: [], thisMonth: 0, lastMonth: 0, changePct: null, totalVolume: 0 };
      entry.name = entry.name || name;
      entry.sessions.push({ date: log.date, intensity: weight, volume, topWeight: weight });
      entry.totalVolume += volume;
      groups.set(key, entry);
    });
  });
  return Array.from(groups.values()).map(entry => {
    entry.sessions.sort((a, b) => a.date.localeCompare(b.date));
    const intensityFor = (month: string) => {
      const sessions = entry.sessions.filter(s => monthKey(s.date) === month);
      return sessions.length ? weightedIntensity(sessions.map(s => ({ name: entry.name, weight: s.intensity, sets: s.volume ? 1 : 0, reps: s.volume }))) : 0;
    };
    entry.thisMonth = intensityFor(currentMonth);
    entry.lastMonth = intensityFor(lastMonth);
    entry.changePct = pctChange(entry.lastMonth, entry.thisMonth);
    return entry;
  }).sort((a, b) => a.name.localeCompare(b.name));
}
