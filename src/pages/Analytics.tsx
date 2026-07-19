import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, auth } from '../App';
import { parseISO, subDays, format } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { moodLabel, moodScore } from '../lib/moods';
import { correlationStrength, linearRegression, monthKey, pearson, pctChange } from '../lib/insights';

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const sectionTitle = 'text-[10px] tracking-[0.2em] uppercase text-gray-500 ml-1';
const moodColors = ['#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa'];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'Health' | 'Study' | 'Work'>('Health');
  const [timeRange, setTimeRange] = useState<7 | 30 | 365>(30);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [studyLogs, setStudyLogs] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [moodLogs, setMoodLogs] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const names = ['healthLogs', 'studyLogs', 'workLogs', 'moodLogs', 'daily'];
        const snapshots = await Promise.all(
          names.map(name =>
            getDocs(
              query(
                collection(db, 'users', uid, name),
                orderBy('date', 'asc'),
                limit(365),
              ),
            ),
          ),
        );
        const values = snapshots.map(snapshot => snapshot.docs.map(doc => doc.data()));
        setHealthLogs(values[0]);
        setStudyLogs(values[1]);
        setWorkLogs(values[2]);
        setMoodLogs(values[3]);
        setDailyLogs(values[4]);
      } catch (error: any) {
        console.warn('Analytics fetch error:', error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filter = (logs: any[]) => {
    if (timeRange === 365) return logs;
    const threshold = subDays(new Date(), timeRange);
    return logs.filter(log => log.date && parseISO(log.date) >= threshold);
  };
  const filteredHealth = useMemo(() => filter(healthLogs), [healthLogs, timeRange]);
  const filteredStudy = useMemo(() => filter(studyLogs), [studyLogs, timeRange]);
  const filteredWork = useMemo(() => filter(workLogs), [workLogs, timeRange]);
  const filteredDaily = useMemo(() => filter(dailyLogs), [dailyLogs, timeRange]);
  const moods = useMemo(() => {
    const map = new Map<string, string>();
    moodLogs.forEach(log => {
      if (log.date && log.mood) map.set(log.date, log.mood);
    });
    healthLogs.forEach(log => {
      if (log.date && log.mood) map.set(log.date, log.mood);
    });
    return Array.from(map.entries())
      .filter(([date]) => timeRange === 365 || parseISO(date) >= subDays(new Date(), timeRange))
      .map(([date, mood]) => ({
        date,
        mood,
        score: moodScore(mood),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [healthLogs, moodLogs, timeRange]);
  const moodMap = useMemo(() => new Map(moods.map(m => [m.date, m.score])), [moods]);
  const workout = (log: any) => Boolean(log.workoutCategory || log.workoutNotes);
  const weightData = filteredHealth
    .map((log, index) => ({
      date: format(parseISO(log.date), 'MMM d'),
      dateRaw: log.date,
      weight: num(log.weight) || null,
      index,
    }))
    .filter(log => log.weight);
  const moodData = moods.map(log => ({
    date: format(parseISO(log.date), 'MMM d'),
    mood: log.score,
    label: moodLabel(log.mood),
  }));
  const goalData = filteredDaily.map(log => {
    const goals = Array.isArray(log.goals)
      ? log.goals.filter((g: any) => (typeof g === 'string' ? g : g.text)?.trim())
      : [];
    return {
      date: format(parseISO(log.date), 'MMM d'),
      completion: goals.length
        ? Math.round(
            (goals.filter((g: any) => typeof g !== 'string' && g.done).length /
              goals.length) *
              100,
          )
        : null,
    };
  }).filter(log => log.completion !== null);
  const goalStats = useMemo(() => {
    const all = filteredDaily
      .flatMap(log => (Array.isArray(log.goals) ? log.goals : []))
      .filter((g: any) => (typeof g === 'string' ? g : g.text)?.trim());
    const done = all.filter((g: any) => typeof g !== 'string' && g.done).length;
    return {
      total: all.length,
      done,
      percent: all.length ? Math.round((done / all.length) * 100) : 0,
      average: goalData.length
        ? Math.round(
            goalData.reduce((sum, day) => sum + (day.completion || 0), 0) /
              goalData.length,
          )
        : 0,
    };
  }, [filteredDaily, goalData]);
  const currentMonth = monthKey(format(new Date(), 'yyyy-MM-dd'));
  const metricAverage = (key: string) => {
    const values = healthLogs
      .filter(log => monthKey(log.date) === currentMonth)
      .map(log => num(log[key]))
      .filter(value => value > 0);
    return values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
      : '--';
  };
  const correlations = useMemo(() => {
    const definitions = [
      {
        name: 'Weight ↔ Mood',
        value: pearson(
          filteredHealth.map(log => num(log.weight)),
          filteredHealth.map(log => moodMap.get(log.date) || 0),
        ),
        sentence: 'Weight and mood move together on your logged days.',
      },
      {
        name: 'Mood ↔ Workout',
        value: pearson(
          filteredHealth.map(log => moodMap.get(log.date) || 0),
          filteredHealth.map(log => (workout(log) ? 1 : 0)),
        ),
        sentence: 'Higher values suggest workouts tend to appear with better moods.',
      },
      {
        name: 'Weight ↔ Workout',
        value: pearson(
          filteredHealth.map(log => num(log.weight)),
          filteredHealth.map(log => (workout(log) ? 1 : 0)),
        ),
        sentence: 'This compares weight with whether a workout was logged.',
      },
    ];
    return definitions
      .filter(definition => definition.value !== null)
      .map(definition => ({
        ...definition,
        value: definition.value as number,
      }));
  }, [filteredHealth, moodMap]);
  const regression = useMemo(
    () =>
      linearRegression(
        weightData.map((point, index) => ({
          x: index,
          y: point.weight as number,
        })),
      ),
    [weightData],
  );
  const projection = regression && weightData.length
    ? [
        { label: '+7 days', value: regression.predict(weightData.length + 7) },
        { label: '+14 days', value: regression.predict(weightData.length + 14) },
      ]
    : [];
  const projectionData = regression && weightData.length
    ? [
        ...weightData.map((point, index) => ({
          date: point.date,
          actual: point.weight,
          projected: regression.predict(index),
        })),
        {
          date: '+7d',
          actual: null,
          projected: regression.predict(weightData.length + 7),
        },
        {
          date: '+14d',
          actual: null,
          projected: regression.predict(weightData.length + 14),
        },
      ]
    : [];
  const nutrition = useMemo(() => {
    const weights = filteredHealth
      .map(log => num(log.weight))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const median = weights.length ? weights[Math.floor(weights.length / 2)] : 0;
    const counts = new Map<string, number>();
    const best = new Map<string, number>();
    filteredHealth.forEach(log => {
      const foods = Array.isArray(log.foodHealthy) ? log.foodHealthy : [];
      const isBest =
        (moodMap.get(log.date) || 0) >= 4 ||
        workout(log) ||
        (median > 0 && num(log.weight) < median);
      foods.forEach((food: any) => {
        if (typeof food !== 'string' || !food.trim()) return;
        const key = food.trim();
        counts.set(key, (counts.get(key) || 0) + 1);
        if (isBest) best.set(key, (best.get(key) || 0) + 1);
      });
    });
    return {
      frequent: Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      best: Array.from(best.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }, [filteredHealth, moodMap]);
  const study = useMemo(() => {
    const total = filteredStudy.reduce(
      (sum, log) => sum + num(log.practiceHours),
      0,
    );
    const days = filteredStudy.filter(log => num(log.practiceHours) > 0).length;
    const currentKey = monthKey(format(new Date(), 'yyyy-MM-dd'));
    const previousDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const previousKey = format(previousDate, 'yyyy-MM');
    const current = studyLogs
      .filter(log => monthKey(log.date) === currentKey)
      .reduce((sum, log) => sum + num(log.practiceHours), 0);
    const previous = studyLogs
      .filter(log => monthKey(log.date) === previousKey)
      .reduce((sum, log) => sum + num(log.practiceHours), 0);
    let streak = 0;
    for (const log of [...studyLogs].sort((a, b) => b.date.localeCompare(a.date))) {
      if (num(log.practiceHours) > 0) streak++;
      else break;
    }
    return {
      total,
      average: filteredStudy.length ? total / filteredStudy.length : 0,
      days,
      consistency: filteredStudy.length
        ? Math.round((days / filteredStudy.length) * 100)
        : 0,
      current,
      previous,
      change: pctChange(previous, current),
      streak,
      trend: filteredStudy.map(log => ({
        date: format(parseISO(log.date), 'MMM d'),
        hours: num(log.practiceHours),
      })),
    };
  }, [filteredStudy, studyLogs]);
  const work = useMemo(() => {
    const rated = filteredWork.filter(log => num(log.workEnjoyment) > 0);
    return {
      trend: rated.map(log => ({
        date: format(parseISO(log.date), 'MMM d'),
        enjoyment: num(log.workEnjoyment),
      })),
      average: rated.length
        ? rated.reduce((sum, log) => sum + num(log.workEnjoyment), 0) / rated.length
        : 0,
      worked: filteredWork.filter(log => log.workNotes?.trim()).length,
      networked: filteredWork.filter(log => log.networkNotes?.trim()).length,
      enjoyed: filteredWork
        .filter(log => num(log.workEnjoyment) >= 4 && log.workNotes?.trim())
        .map(log => log.workNotes)
        .slice(0, 4),
      disliked: filteredWork
        .filter(
          log =>
            num(log.workEnjoyment) <= 2 &&
            num(log.workEnjoyment) > 0 &&
            log.workNotes?.trim(),
        )
        .map(log => log.workNotes)
        .slice(0, 4),
    };
  }, [filteredWork]);
  const monthlyActivity = useMemo(() => {
    const counts = new Map<string, number>();
    filteredHealth.forEach(log => {
      if (!log.date || !workout(log)) return;
      const month = format(parseISO(log.date), 'MMM');
      counts.set(month, (counts.get(month) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [filteredHealth]);
  const moodDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    moods.forEach(mood => {
      const label = moodLabel(mood.mood);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [moods]);
  const tooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#111] border border-gray-800 p-2 text-xs">
        <div>{label}</div>
        <div>{payload[0].value}</div>
      </div>
    );
  };
  const chart = (data: any[], key: string, color: string) => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" />
        <XAxis
          dataKey="date"
          stroke="#4b5563"
          fontSize={9}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={30}
        />
        <YAxis
          stroke="#4b5563"
          fontSize={9}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={tooltip} />
        <Line
          type="monotone"
          dataKey={key}
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
  const card = (label: string, value: string | number, detail?: string) => (
    <div className="bg-bg-secondary border border-bg-tertiary p-5 rounded-lg">
      <div className="text-[10px] tracking-widest uppercase text-text-tertiary mb-2">
        {label}
      </div>
      <div className="text-3xl font-light text-text-primary">{value}</div>
      {detail && <div className="text-[10px] text-text-tertiary mt-1">{detail}</div>}
    </div>
  );

  return (
    <div className="pb-8">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-2">
            {(['Health', 'Study', 'Work'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] tracking-widest uppercase rounded-md ${
                  activeTab === tab ? 'bg-gray-800 text-gray-100' : 'text-gray-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex bg-[#111] rounded p-1 border border-gray-800">
            {[
              { label: '7D', val: 7 },
              { label: '30D', val: 30 },
              { label: 'ALL', val: 365 },
            ].map(item => (
              <button
                key={item.val}
                onClick={() => setTimeRange(item.val as 7 | 30 | 365)}
                className={`px-4 py-1.5 text-[10px] tracking-widest uppercase rounded ${
                  timeRange === item.val ? 'bg-gray-800 text-gray-100' : 'text-gray-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-600 py-20 text-xs tracking-widest uppercase animate-pulse">
            Loading Analytics...
          </div>
        ) : activeTab === 'Health' ? (
          <div className="space-y-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {card('Current', weightData.length ? weightData[weightData.length - 1].weight || '--' : '--', 'kg today')}
              {card('Month Avg', metricAverage('weight'), 'weight kg')}
              {card('Workouts', filteredHealth.filter(workout).length, 'selected range')}
              {card('Goals Avg', `${goalStats.average}%`, 'completion per day')}
            </div>

            <section>
              <h2 className={sectionTitle}>Weight Trend</h2>
              <div className="h-56">
                {weightData.length ? chart(weightData, 'weight', '#fcd34d') : <div className="text-center text-xs text-gray-600 py-10">No data</div>}
              </div>
            </section>

            <section>
              <h2 className={sectionTitle}>Mood Journey</h2>
              <div className="h-56">
                {moodData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={moodData} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} tickMargin={10} minTickGap={30} />
                      <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickFormatter={() => ''} />
                      <Tooltip content={tooltip} />
                      <Line type="step" dataKey="mood" stroke="#2dd4bf" strokeWidth={1.5} dot={{ r: 2, fill: '#fcd34d', stroke: 'none' }} activeDot={{ r: 4, fill: '#2dd4bf' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="text-center text-xs text-gray-600 py-10">No data</div>}
              </div>
            </section>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {card('Sleep Avg', metricAverage('sleepHours'), 'hours')}
              {card('Water Avg', metricAverage('water'), 'glasses')}
              {card('Steps Avg', metricAverage('steps'), 'steps')}
              {card('Screen Avg', metricAverage('screenTime'), 'hours')}
            </div>

            <section>
              <h2 className={sectionTitle}>Goals Completion</h2>
              <div className="h-56">
                {goalData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={goalData}>
                      <CartesianGrid stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} stroke="#4b5563" fontSize={9} />
                      <Bar dataKey="completion" fill="#c8925a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="text-center text-xs text-gray-600 py-10">No goals logged in this range</div>}
              </div>
            </section>

            <section>
              <h2 className={sectionTitle}>Monthly Activity & Mood Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h3 className={sectionTitle}>Monthly Activity</h3>
                  <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 h-64">
                    {monthlyActivity.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyActivity} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                          <CartesianGrid stroke="#1f2937" />
                          <XAxis dataKey="name" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} tickMargin={10} />
                          <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip content={tooltip} />
                          <Bar dataKey="count" name="Workouts" fill="#4b6b63" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="text-center text-xs text-gray-600 py-10">No data</div>}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className={sectionTitle}>Mood Distribution</h3>
                  <div className="bg-[#111] border border-gray-800 rounded-lg p-6 flex items-center gap-8 h-64">
                    {moodDistribution.length ? (
                      <>
                        <div className="w-1/2 h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={moodDistribution} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                                {moodDistribution.map((entry, index) => (
                                  <Cell key={entry.name} fill={moodColors[index % moodColors.length]} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-3">
                          {moodDistribution.map((entry, index) => {
                            const total = moodDistribution.reduce((sum, item) => sum + item.value, 0);
                            const percentage = Math.round((entry.value / total) * 100);
                            return (
                              <div key={entry.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: moodColors[index % moodColors.length] }} />
                                  <span className="text-gray-400">{entry.name}</span>
                                </div>
                                <span className="text-gray-300 font-mono">{percentage}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : <div className="text-center text-xs text-gray-600 py-10 w-full">No data</div>}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className={sectionTitle}>Correlations</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {correlations.map(correlation => (
                  <div key={correlation.name} className="bg-bg-secondary border border-bg-tertiary p-5 rounded-lg">
                    <div className="text-[10px] tracking-widest uppercase text-text-tertiary">{correlation.name}</div>
                    <div className="text-2xl mt-2">{correlation.value.toFixed(2)}</div>
                    <div className="text-xs text-accent-teal">{correlationStrength(correlation.value)}</div>
                    <p className="text-xs text-text-secondary mt-3">{correlation.sentence}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className={sectionTitle}>Weight Projection</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-3 h-48 md:col-span-2">
                  {projectionData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={projectionData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid stroke="#1f2937" />
                        <XAxis dataKey="date" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip content={tooltip} />
                        <Line dataKey="actual" stroke="#fcd34d" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: '#fcd34d' }} />
                        <Line dataKey="projected" stroke="#2dd4bf" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 4, fill: '#2dd4bf' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center text-xs text-gray-600 py-10">Not enough weight data</div>}
                </div>
                {projection.map(point => (
                  card(
                    point.label,
                    `${point.value.toFixed(1)} kg`,
                    regression
                      ? regression.slope > 0.01
                        ? 'Rising'
                        : regression.slope < -0.01
                          ? 'Falling'
                          : 'Stable'
                      : '',
                  )
                ))}
              </div>
            </section>

            <section>
              <h2 className={sectionTitle}>Nutrition Insights</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  ['Most frequent healthy foods', nutrition.frequent],
                  ['Foods on your best days', nutrition.best],
                ].map(([title, entries]) => (
                  <div key={title as string} className="bg-bg-secondary border border-bg-tertiary p-5 rounded-lg">
                    <div className="text-[10px] tracking-widest uppercase text-text-tertiary mb-3">{title as string}</div>
                    {(entries as [string, number][]).length ? (entries as [string, number][]).map(([name, count]) => (
                      <div key={name} className="flex justify-between text-sm py-1">
                        <span>{name}</span><span className="text-text-tertiary">{count}</span>
                      </div>
                    )) : <div className="text-center text-xs text-gray-600 py-4">No nutrition data</div>}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className={sectionTitle}>All-Time Summary</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {card('Workout Rate', `${healthLogs.length ? Math.round(healthLogs.filter(workout).length / healthLogs.length * 100) : 0}%`)}
                {card('Positive Days', `${moods.length ? Math.round(moods.filter(mood => mood.score >= 4).length / moods.length * 100) : 0}%`)}
                {card('Goals Achieved', `${goalStats.percent}%`, `${goalStats.done} of ${goalStats.total} goals`)}
              </div>
            </section>
          </div>
        ) : activeTab === 'Study' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {card('Total Hours', study.total.toFixed(1))}
              {card('Average', study.average.toFixed(1), 'hours per logged day')}
              {card('Consistency', `${study.consistency}%`, `${study.days} days studied`)}
              {card('Streak', study.streak, 'recent days')}
            </div>
            <section>
              <h2 className={sectionTitle}>Hours Trend</h2>
              <div className="h-56">{chart(study.trend, 'hours', '#c8925a')}</div>
            </section>
            <div className="grid md:grid-cols-2 gap-4">
              {card('This Month', study.current.toFixed(1), study.change === null ? 'hours' : `studying ${study.change >= 0 ? 'increased' : 'decreased'} ${Math.abs(study.change).toFixed(0)}%`)}
              {card('Last Month', study.previous.toFixed(1), 'hours')}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {card('Enjoyment Avg', work.average ? work.average.toFixed(1) : '--', work.average ? 'out of 5' : 'Start rating your work')}
              {card('Worked', work.worked, 'days')}
              {card('Networked', work.networked, 'days')}
              {card('Rated Days', work.trend.length, 'days')}
            </div>
            <section>
              <h2 className={sectionTitle}>Work Enjoyment</h2>
              <div className="h-56">{work.trend.length ? chart(work.trend, 'enjoyment', '#c75858') : <div className="text-center text-xs text-gray-600 py-10">Start rating your work to see a trend.</div>}</div>
            </section>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                ['Work you enjoyed', work.enjoyed],
                ['Work you didn’t enjoy', work.disliked],
              ].map(([title, notes]) => (
                <div key={title as string} className="bg-bg-secondary border border-bg-tertiary p-5 rounded-lg">
                  <h3 className={sectionTitle}>{title as string}</h3>
                  {(notes as string[]).length ? (notes as string[]).map((note, index) => (
                    <p key={index} className="text-sm text-text-secondary border-b border-bg-tertiary py-2">{note}</p>
                  )) : <p className="text-center text-xs text-gray-600 py-4">No entries yet.</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
