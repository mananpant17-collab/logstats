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
  if (typeof log?.workoutDone === 'number' && Number.isFinite(log.workoutDone)) {
    return Boolean(log.workoutDone);
  }
  if (Array.isArray(log?.workoutCategories) && log.workoutCategories.some((category: any) => typeof category === 'string' && category.trim())) {
    return true;
  }
  const legacyCategory = typeof log?.workoutCategory === 'string' ? log.workoutCategory.trim().toLowerCase() : '';
  if (legacyCategory && !['no', 'none', 'rest'].includes(legacyCategory)) return true;
  return Array.isArray(log?.exercises) && log.exercises.some((exercise: any) => typeof exercise?.name === 'string' && exercise.name.trim());
}
