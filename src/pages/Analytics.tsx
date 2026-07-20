import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, auth } from '../App';
import { format, parseISO, subDays } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MOODS, moodLabel, moodScore } from '../lib/moods';
import { correlationStrength, isWorkoutDay, linearRegression, metricBucket, pearson } from '../lib/insights';

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const sectionTitle = 'text-[10px] tracking-[0.25em] uppercase text-text-tertiary';
const cardClass = 'bg-bg-secondary border-[0.5px] border-border-subtle rounded-[10px] p-4';

const ChartTooltip = ({ active, payload, label }: any) => active && payload?.length ? (
  <div className="bg-bg-elevated border-[0.5px] border-border-strong rounded-lg px-3 py-2 text-xs shadow-xl">
    <div className="font-mono text-[10px] text-text-tertiary">{label}</div>
    <div className="mt-1 font-mono text-text-primary">{payload[0].value}</div>
  </div>
) : null;

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'Health' | 'Study' | 'Work'>('Health');
  const [timeRange, setTimeRange] = useState<7 | 30 | 365>(30);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [studyLogs, setStudyLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [moodLogs, setMoodLogs] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [learningItems, setLearningItems] = useState<any[]>([]);
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const names = ['healthLogs', 'studyLogs', 'workLogs', 'moodLogs', 'daily'];
        const snapshots = await Promise.all([
          ...names.map(name => getDocs(query(collection(db, 'users', uid, name), orderBy('date', 'asc'), limit(365)))),
          getDocs(collection(db, 'users', uid, 'learningItems')),
          getDocs(collection(db, 'users', uid, 'workItems')),
        ]);
        setHealthLogs(snapshots[0].docs.map(item => item.data()));
        setStudyLogs(snapshots[1].docs.map(item => item.data()));
        setWorkLogs(snapshots[2].docs.map(item => item.data()));
        setMoodLogs(snapshots[3].docs.map(item => item.data()));
        setDailyLogs(snapshots[4].docs.map(item => item.data()));
        setLearningItems(snapshots[5].docs.map(item => ({ id: item.id, ...item.data() })));
        setWorkItems(snapshots[6].docs.map(item => ({ id: item.id, ...item.data() })));
      } catch (error: any) {
        console.warn('Analytics fetch error:', error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filter = (logs: any[]) => timeRange === 365
    ? logs
    : logs.filter(log => log.date && parseISO(log.date) >= subDays(new Date(), timeRange));
  const filteredHealth = useMemo(() => filter(healthLogs), [healthLogs, timeRange]);
  const filteredStudy = useMemo(() => filter(studyLogs), [studyLogs, timeRange]);
  const filteredWork = useMemo(() => filter(workLogs), [workLogs, timeRange]);
  const filteredDaily = useMemo(() => filter(dailyLogs), [dailyLogs, timeRange]);
  const moods = useMemo(() => {
    const map = new Map<string, string>();
    moodLogs.forEach(log => { if (log.date && log.mood) map.set(log.date, log.mood); });
    healthLogs.forEach(log => { if (log.date && log.mood) map.set(log.date, log.mood); });
    return Array.from(map.entries())
      .filter(([date]) => timeRange === 365 || parseISO(date) >= subDays(new Date(), timeRange))
      .map(([date, mood]) => ({ date, mood, score: moodScore(mood) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [healthLogs, moodLogs, timeRange]);
  const moodMap = useMemo(() => new Map(moods.map(item => [item.date, item.score])), [moods]);
  const workout = isWorkoutDay;
  const weightData = useMemo(() => filteredHealth.map(log => ({
    date: format(parseISO(log.date), 'd MMM'),
    weight: num(log.weight) || null,
  })).filter(item => item.weight !== null), [filteredHealth]);
  const weightValues = weightData.map(item => item.weight as number);
  const weightDomain: [number, number] = weightValues.length
    ? [Math.floor(Math.min(...weightValues) - 2), Math.ceil(Math.max(...weightValues) + 2)]
    : [0, 100];
  const moodData = moods.map(item => ({ date: format(parseISO(item.date), 'd MMM'), mood: item.score, label: moodLabel(item.mood) }));
  const goalData = filteredDaily.map(log => {
    const goals = Array.isArray(log.goals) ? log.goals.filter((goal: any) => (typeof goal === 'string' ? goal : goal?.text)?.trim()) : [];
    return {
      date: format(parseISO(log.date), 'd MMM'),
      completion: goals.length ? Math.round(goals.filter((goal: any) => typeof goal !== 'string' && goal.done).length / goals.length * 100) : null,
    };
  }).filter(item => item.completion !== null);
  const goalStats = useMemo(() => {
    const goals = filteredDaily.flatMap(log => Array.isArray(log.goals) ? log.goals : []).filter((goal: any) => (typeof goal === 'string' ? goal : goal?.text)?.trim());
    const done = goals.filter((goal: any) => typeof goal !== 'string' && goal.done).length;
    return {
      done,
      total: goals.length,
      percent: goals.length ? Math.round(done / goals.length * 100) : 0,
      average: goalData.length ? Math.round(goalData.reduce((sum, item) => sum + Number(item.completion), 0) / goalData.length) : 0,
    };
  }, [filteredDaily, goalData]);
  const correlations = useMemo(() => [
    { name: 'Weight ↔ Mood', a: 'Weight', b: 'Mood', value: pearson(filteredHealth.map(log => num(log.weight)), filteredHealth.map(log => moodMap.get(log.date) || 0)) },
    { name: 'Mood ↔ Workout', a: 'Mood', b: 'Workout', value: pearson(filteredHealth.map(log => moodMap.get(log.date) || 0), filteredHealth.map(log => workout(log) ? 1 : 0)) },
    { name: 'Weight ↔ Workout', a: 'Weight', b: 'Workout', value: pearson(filteredHealth.map(log => num(log.weight)), filteredHealth.map(log => workout(log) ? 1 : 0)) },
  ].filter(item => item.value !== null).map(item => {
    const value = item.value as number;
    const strength = correlationStrength(value);
    return { ...item, value, strength, sentence: `${item.a} and ${item.b} ${strength.toLowerCase()} tend to move ${value >= 0 ? 'together' : 'in opposite directions'} (r = ${value.toFixed(2)}).` };
  }), [filteredHealth, moodMap]);
  const regression = useMemo(() => linearRegression(weightValues.map((weight, index) => ({ x: index, y: weight }))), [weightValues]);
  const projectionData = regression && weightData.length ? Array.from({ length: weightData.length + 15 }, (_, index) => ({
    date: index < weightData.length ? weightData[index].date : `+${index - weightData.length + 1}d`,
    actual: index < weightData.length ? weightData[index].weight : null,
    projected: regression.predict(index),
  })) : [];
  const projections = regression && weightData.length ? [regression.predict(weightData.length + 7), regression.predict(weightData.length + 14)] : [];
  const trendLabel = regression ? regression.slope > 0.01 ? '↑ Rising' : regression.slope < -0.01 ? '↓ Falling' : '→ Stable' : '→ Stable';
  const monthlyActivity = useMemo(() => {
    const counts = new Map<string, number>();
    filteredHealth.filter(log => log.date && workout(log)).forEach(log => counts.set(log.date.slice(0, 7), (counts.get(log.date.slice(0, 7)) || 0) + 1));
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ name: format(parseISO(`${key}-01`), 'MMM'), count }));
  }, [filteredHealth]);
  const moodDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    moods.forEach(item => counts.set(moodLabel(item.mood), (counts.get(moodLabel(item.mood)) || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value, color: MOODS.find(mood => mood.text === name)?.color || '#6b7280' })).sort((a, b) => b.value - a.value);
  }, [moods]);
  const lifestyle = useMemo(() => [
    { key: 'sleep' as const, label: 'Sleep', buckets: ['<4h', '4-6h', '6h+'] },
    { key: 'water' as const, label: 'Water', buckets: ['<1L', '1L-2L', '2L+'] },
    { key: 'steps' as const, label: 'Steps', buckets: ['<5k', '5-10k', '10k+'] },
    { key: 'screen' as const, label: 'Screen time', buckets: ['<4h', '4-8h', '8h+'] },
  ].map(definition => ({
    ...definition,
    counts: definition.buckets.map(bucket => ({ bucket, count: filteredHealth.filter(log => metricBucket(log, definition.key) === bucket).length })),
  })), [filteredHealth]);
  const nutrition = useMemo(() => [
    { label: 'Home-cooked', field: 'foodHome' },
    { label: 'Outside food', field: 'foodOutside' },
    { label: 'Healthy outside', field: 'foodHealthyOutside' },
  ].map(item => ({ ...item, count: filteredHealth.filter(log => Array.isArray(log[item.field]) && log[item.field].length > 0).length })), [filteredHealth]);
  const study = useMemo(() => {
    const withProgress = learningItems.filter(item => num(item.progressTotal) > 0);
    return {
      statusCounts: ['In progress', 'Completed', 'Paused'].map(status => ({ status, count: learningItems.filter(item => item.status === status).length })),
      completion: withProgress.length ? Math.round(withProgress.reduce((sum, item) => sum + Math.min(100, num(item.progressCurrent) / num(item.progressTotal) * 100), 0) / withProgress.length) : 0,
      averageEnjoyment: filteredStudy.filter(log => num(log.studyEnjoyment) > 0).reduce((sum, log, _, arr) => sum + num(log.studyEnjoyment) / arr.length, 0),
      enjoyed: learningItems.filter(item => num(item.enjoyment) >= 4),
      timeline: [...learningItems].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))),
      categoryCounts: Array.from(new Set(learningItems.map(item => item.category).filter(Boolean))).map(category => ({ category, count: learningItems.filter(item => item.category === category).length })),
    };
  }, [learningItems, filteredStudy]);
  const work = useMemo(() => ({
    statusCounts: ['In progress', 'Completed', 'Paused'].map(status => ({ status, count: workItems.filter(item => item.status === status).length })),
    averageEnjoyment: filteredWork.filter(log => num(log.workEnjoyment) > 0).reduce((sum, log, _, arr) => sum + num(log.workEnjoyment) / arr.length, 0),
    enjoyed: workItems.filter(item => num(item.enjoyment) >= 4),
    disliked: workItems.filter(item => num(item.enjoyment) > 0 && num(item.enjoyment) <= 2),
    timeline: [...workItems].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))),
  }), [workItems, filteredWork]);
  const chart = (data: any[], key: string, color: string, domain?: [number, number]) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeOpacity={0.35} /><XAxis dataKey="date" stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} /><YAxis domain={domain} allowDecimals={key !== 'weight'} stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} tickMargin={8} /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
  const card = (label: string, value: string | number, detail?: string) => <div className={cardClass}><div className="text-[10px] tracking-[0.15em] uppercase text-text-tertiary mb-2">{label}</div><div className="font-mono text-[22px] text-text-primary leading-tight">{value}</div>{detail && <div className="mt-1 text-[11px] text-text-tertiary">{detail}</div>}</div>;
  const itemList = (items: any[], empty: string) => items.length ? <div className="space-y-2">{items.slice(0, 8).map(item => <div key={item.id} className="rounded-lg border-[0.5px] border-border-subtle bg-bg-primary/40 px-3 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm text-text-primary">{item.title}</span><span className="font-mono text-[10px] text-text-tertiary">{item.enjoyment}/5</span></div><div className="mt-1 text-[9px] tracking-widest uppercase text-text-tertiary">{item.category} · {item.status}</div></div>)}</div> : <p className="text-xs text-text-tertiary">{empty}</p>;

  return (
    <div className="pb-24"><div className="max-w-6xl mx-auto p-5 sm:p-6 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2">{(['Health', 'Study', 'Work'] as const).map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-[10px] tracking-[0.16em] uppercase transition-colors ${activeTab === tab ? 'bg-accent-amber text-[#1a0f07]' : 'border-[0.5px] border-border-subtle text-text-tertiary hover:text-text-primary'}`}>{tab}</button>)}</div><div className="flex w-fit gap-1 rounded-lg border-[0.5px] border-border-subtle bg-bg-secondary p-1">{[{ label: '7D', value: 7 }, { label: '30D', value: 30 }, { label: 'ALL', value: 365 }].map(item => <button key={item.value} onClick={() => setTimeRange(item.value as 7 | 30 | 365)} className={`rounded px-3 py-1.5 text-[10px] font-mono tracking-widest uppercase ${timeRange === item.value ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary'}`}>{item.label}</button>)}</div></div>
      {loading ? <div className="py-20 text-center text-xs tracking-widest uppercase text-text-tertiary animate-pulse">Loading analytics...</div> : activeTab === 'Health' ? <div className="space-y-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{card('Current', weightData.length ? `${weightData[weightData.length - 1].weight}` : '--', 'kg')}{card('Range average', weightValues.length ? (weightValues.reduce((sum, value) => sum + value, 0) / weightValues.length).toFixed(1) : '--', 'kg')}{card('Workouts', filteredHealth.filter(workout).length, 'selected range')}{card('Goals avg', `${goalStats.average}%`, 'per logged day')}</div>
        <section><h2 className={sectionTitle}>Weight Trend</h2><div className="mt-3 h-60">{weightData.length ? chart(weightData, 'weight', '#c8925a', weightDomain) : <div className="py-10 text-center text-xs text-text-tertiary">No weight data.</div>}</div></section>
        <section><h2 className={sectionTitle}>Mood Journey</h2><div className="mt-3 h-60">{moodData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={moodData} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#334155" strokeOpacity={0.35} /><XAxis dataKey="date" stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} /><YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={() => ''} stroke="#4a4a4a" fontSize={9} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="mood" stroke="#5a9e8f" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#5a9e8f' }} /></LineChart></ResponsiveContainer> : <div className="py-10 text-center text-xs text-text-tertiary">No mood data.</div>}</div></section>
        <section><h2 className={sectionTitle}>Lifestyle distributions</h2><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{lifestyle.map(metric => { const max = Math.max(1, ...metric.counts.map(item => item.count)); return <div key={metric.key} className={`${cardClass} space-y-3`}><h3 className="text-xs text-text-primary">{metric.label}</h3>{metric.counts.map(item => <div key={item.bucket} className="space-y-1"><div className="flex justify-between text-[10px] text-text-tertiary"><span>{item.bucket}</span><span>{item.count} days</span></div><div className="h-2 overflow-hidden rounded-full bg-bg-tertiary"><div className="h-full rounded-full bg-accent-teal" style={{ width: `${item.count / max * 100}%` }} /></div></div>)}</div>; })}</div></section>
        <section><h2 className={sectionTitle}>Goals Completion</h2><div className="mt-3 h-56">{goalData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={goalData} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#334155" strokeOpacity={0.35} /><XAxis dataKey="date" stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} /><YAxis domain={[0, 100]} stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="completion" fill="#c8925a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="py-10 text-center text-xs text-text-tertiary">No goals logged in this range.</div>}</div></section>
        <section><h2 className={sectionTitle}>Monthly Activity & Mood Distribution</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><div className={`${cardClass} h-72`}><h3 className={sectionTitle}>Monthly Activity</h3>{monthlyActivity.length ? <ResponsiveContainer width="100%" height="90%"><BarChart data={monthlyActivity} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#334155" strokeOpacity={0.35} /><XAxis dataKey="name" stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} /><YAxis stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="count" fill="#5a9e8f" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="py-10 text-center text-xs text-text-tertiary">No workouts in this range.</div>}</div><div className={`${cardClass} flex h-72 items-center gap-4`}><div className="h-full w-1/2">{moodDistribution.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={moodDistribution} innerRadius="58%" outerRadius="78%" dataKey="value" paddingAngle={2} stroke="none">{moodDistribution.map(item => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer> : null}</div><div className="w-1/2 space-y-3">{moodDistribution.length ? moodDistribution.map(item => <div key={item.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-text-secondary"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><span className="font-mono text-text-tertiary">{Math.round(item.value / moods.length * 100)}%</span></div>) : <span className="text-xs text-text-tertiary">No mood data.</span>}</div></div></div></section>
        <section><h2 className={sectionTitle}>Correlations</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{correlations.length ? correlations.map(item => <div key={item.name} className={`${cardClass} space-y-3`}><div className="text-[10px] tracking-widest uppercase text-text-tertiary">{item.name}</div><div className="relative h-[3px] rounded-full bg-border-subtle"><span className="absolute left-1/2 top-[-2px] h-[7px] w-px bg-border-strong" /><span className={`absolute top-0 h-full rounded-full ${item.value >= 0 ? 'bg-accent-teal' : 'bg-accent-red'}`} style={{ left: item.value >= 0 ? '50%' : `${50 + item.value * 50}%`, width: `${Math.abs(item.value) * 50}%` }} /></div><div className="flex items-baseline justify-between"><span className={`font-mono text-xl ${item.value >= 0 ? 'text-accent-teal' : 'text-accent-red'}`}>r = {item.value.toFixed(2)}</span><span className="text-[11px] text-text-secondary">{item.strength}</span></div><p className="text-xs leading-relaxed text-text-tertiary">{item.sentence}</p></div>) : <p className="text-xs text-text-tertiary">Not enough aligned data for correlations.</p>}</div></section>
        <section><h2 className={sectionTitle}>Weight Projection</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><div className={`${cardClass} h-64 md:col-span-2`}>{projectionData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={projectionData} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#334155" strokeOpacity={0.35} /><XAxis dataKey="date" stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} minTickGap={30} /><YAxis domain={weightDomain} allowDecimals={false} stroke="#4a4a4a" fontSize={9} tick={{ fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} /><Tooltip content={<ChartTooltip />} /><Line name="Actual" dataKey="actual" stroke="#c8925a" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: '#c8925a' }} /><Line name="Projected" dataKey="projected" stroke="#5a9e8f" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 3, fill: '#5a9e8f' }} /></LineChart></ResponsiveContainer> : <div className="py-10 text-center text-xs text-text-tertiary">Not enough weight data.</div>}</div>{card('+7 days', projections.length ? `${projections[0].toFixed(1)} kg` : '--')}{card('+14 days', projections.length ? `${projections[1].toFixed(1)} kg` : '--')}</div><div className="mt-3 text-sm text-text-secondary">Current trend: <span className="font-mono text-text-primary">{trendLabel}</span>.</div><p className="proj-note mt-2 text-xs leading-relaxed text-text-tertiary">Based on linear regression across all recorded weights. Assumes habits remain constant.</p><div className="chart-legend mt-3 flex gap-4 text-[11px] text-text-secondary"><span className="flex items-center gap-2"><span className="h-[3px] w-3 rounded bg-accent-amber" />Actual</span><span className="flex items-center gap-2"><span className="h-[3px] w-3 rounded bg-accent-teal" />Projected</span></div></section>
        <section><h2 className={sectionTitle}>Nutrition Insights</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{nutrition.map(item => card(item.label, item.count, 'days logged'))}</div></section>
        <section><h2 className={sectionTitle}>All-Time Summary</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{card('Workout Rate', `${healthLogs.length ? Math.round(healthLogs.filter(workout).length / healthLogs.length * 100) : 0}%`)}{card('Positive Days', `${moods.length ? Math.round(moods.filter(item => item.score >= 4).length / moods.length * 100) : 0}%`)}{card('Goals Achieved', `${goalStats.percent}%`, `${goalStats.done} of ${goalStats.total} goals`)}</div></section>
      </div> : activeTab === 'Study' ? <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{study.statusCounts.map(item => card(item.status, item.count))}{card('Completion', `${study.completion}%`, 'average tracked progress')}</div>
        <div className="grid gap-4 md:grid-cols-2"><section className={`${cardClass} space-y-4`}><h2 className={sectionTitle}>Most enjoyed learning</h2>{itemList(study.enjoyed, 'Rate learning items 4 or 5 to see them here.')}</section><section className={`${cardClass} space-y-4`}><h2 className={sectionTitle}>Category breakdown</h2>{study.categoryCounts.length ? study.categoryCounts.map(item => <div key={item.category} className="flex justify-between border-b-[0.5px] border-border-subtle py-2 text-sm"><span>{item.category}</span><span className="font-mono text-text-tertiary">{item.count}</span></div>) : <p className="text-xs text-text-tertiary">No learning items yet.</p>}</section></div>
        <section className={`${cardClass} space-y-4`}><div className="flex items-center justify-between"><h2 className={sectionTitle}>Learning timeline</h2><span className="text-xs text-text-tertiary">{study.averageEnjoyment ? `Daily enjoyment ${study.averageEnjoyment.toFixed(1)}/5` : ''}</span></div>{study.timeline.length ? <div className="space-y-3">{study.timeline.map(item => <div key={item.id} className="flex gap-3 border-b-[0.5px] border-border-subtle pb-3 last:border-0"><div className="w-20 shrink-0 font-mono text-[10px] tracking-widest text-text-tertiary">{item.startDate || '—'}</div><div><div className="text-sm text-text-primary">{item.title}</div><div className="mt-1 text-[9px] tracking-widest uppercase text-text-tertiary">{item.category} · {item.status}</div></div></div>)}</div> : <p className="text-xs text-text-tertiary">No learning items yet. Add books, courses, topics, or skills from the Log tab.</p>}</section>
      </div> : <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{work.statusCounts.map(item => card(item.status, item.count))}{card('Daily enjoyment', work.averageEnjoyment ? work.averageEnjoyment.toFixed(1) : '--', 'out of 5')}</div>
        <div className="grid gap-4 md:grid-cols-2"><section className={`${cardClass} space-y-4`}><h2 className={sectionTitle}>Most enjoyed work</h2>{itemList(work.enjoyed, 'Rate work items 4 or 5 to see them here.')}</section><section className={`${cardClass} space-y-4`}><h2 className={sectionTitle}>Least enjoyed work</h2>{itemList(work.disliked, 'No low-rated work items yet.')}</section></div>
        <section className={`${cardClass} space-y-4`}><h2 className={sectionTitle}>Work timeline</h2>{work.timeline.length ? <div className="space-y-3">{work.timeline.map(item => <div key={item.id} className="flex gap-3 border-b-[0.5px] border-border-subtle pb-3 last:border-0"><div className="w-20 shrink-0 font-mono text-[10px] tracking-widest text-text-tertiary">{item.startDate || '—'}</div><div><div className="text-sm text-text-primary">{item.title}</div><div className="mt-1 text-[9px] tracking-widest uppercase text-text-tertiary">{item.category} · {item.status} · {item.enjoyment}/5</div></div></div>)}</div> : <p className="text-xs text-text-tertiary">No work items yet. Add projects, tasks, or networking from the Log tab.</p>}</section>
        <section><h2 className={sectionTitle}>Daily Work Enjoyment</h2><div className="mt-3 h-56">{filteredWork.some(log => num(log.workEnjoyment) > 0) ? chart(filteredWork.filter(log => num(log.workEnjoyment) > 0).map(log => ({ date: format(parseISO(log.date), 'd MMM'), enjoyment: num(log.workEnjoyment) })), 'enjoyment', '#e07a5f', [1, 5]) : <div className="py-10 text-center text-xs text-text-tertiary">Start rating daily work to see a trend.</div>}</div></section>
      </div>}
    </div></div>
  );
}
