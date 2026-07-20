// Shared mood definitions and helpers so the logging form and analytics stay in sync.

export interface MoodOption {
  key: string;
  emoji: string;
  text: string;
  color: string;
}

// Ordered best -> worst. `key` is what gets persisted on new entries.
export const MOODS: MoodOption[] = [
  { key: 'energetic', emoji: '🔥', text: 'Energetic', color: '#5a9e8f' },
  { key: 'good/productive', emoji: '😊', text: 'Good/Calm Day', color: '#6aad7e' },
  { key: 'average', emoji: '😐', text: 'Average', color: '#d4b44a' },
  { key: 'bad/zero day', emoji: '😔', text: 'Bad/Zero Day', color: '#e07a5f' },
  { key: 'awful', emoji: '😞', text: 'Awful', color: '#8b7ec8' },
];

// Maps any historical or current mood string to a 1-5 score.
export function moodScore(mood?: string | null): number {
  if (!mood) return 0;
  const m = mood.toLowerCase();
  if (m.includes('energetic') || m.includes('great')) return 5;
  if (m.includes('good') || m.includes('calm') || m.includes('productive')) return 4;
  if (m.includes('average') || m.includes('alright') || m.includes('okay')) return 3;
  if (m.includes('bad') || m.includes('zero') || m.includes('problematic')) return 2;
  if (m.includes('awful') || m.includes('terrible')) return 1;
  return 0;
}

// Canonical display label for a mood value (handles legacy variants).
export function moodLabel(mood?: string | null): string {
  const score = moodScore(mood);
  switch (score) {
    case 5: return 'Energetic';
    case 4: return 'Good/Calm Day';
    case 3: return 'Average';
    case 2: return 'Bad/Zero Day';
    case 1: return 'Awful';
    default: return 'Unknown';
  }
}

export function moodEmoji(mood?: string | null): string {
  const score = moodScore(mood);
  const found = MOODS.find(m => moodScore(m.key) === score);
  return found ? found.emoji : '·';
}

export const MOOD_SCORE_LABELS = ['', 'Awful', 'Bad', 'Average', 'Good', 'Energetic'];
