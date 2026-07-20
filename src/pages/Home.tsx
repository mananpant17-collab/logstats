import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { db, auth } from '../App';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { appendToSheet } from '../lib/sheets';
import { Plus } from 'lucide-react';
import { MOODS } from '../lib/moods';

export default function Home() {
  const [date] = useState(new Date());
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayName = format(date, 'EEEE');

  // Goals
  const [goals, setGoals] = useState<{text: string, done: boolean}[]>([{text: '', done: false}, {text: '', done: false}, {text: '', done: false}]);
  const [savingGoals, setSavingGoals] = useState(false);

  // Health & Mood
  const [mood, setMood] = useState('');
  const [weight, setWeight] = useState('');
  const [workoutCategory, setWorkoutCategory] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [foodHealthy, setFoodHealthy] = useState('');
  const [foodJunk, setFoodJunk] = useState('');
  const [foodOut, setFoodOut] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [water, setWater] = useState('');
  const [steps, setSteps] = useState('');
  const [screenTime, setScreenTime] = useState('');
  const [exercises, setExercises] = useState<{name: string; weight: string; sets: string; reps: string}[]>([]);
  const [savingHealth, setSavingHealth] = useState(false);

  // Study
  const [schoolNotes, setSchoolNotes] = useState('');
  const [learningNotes, setLearningNotes] = useState('');
  const [practiceHours, setPracticeHours] = useState('');
  const [savingStudy, setSavingStudy] = useState(false);

  // Work
  const [workNotes, setWorkNotes] = useState('');
  const [networkNotes, setNetworkNotes] = useState('');
  const [workEnjoyment, setWorkEnjoyment] = useState('');
  const [savingWork, setSavingWork] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        
        // Load Goals
        const gSnap = await getDoc(doc(db, 'users', uid, 'daily', dateStr));
        if (gSnap.exists()) {
          const data = gSnap.data();
          if (data.goals) setGoals(data.goals.map((g: any) => typeof g === 'string' ? { text: g, done: false } : g));
        }

        // Load Health & Mood
        const hSnap = await getDoc(doc(db, 'users', uid, 'healthLogs', dateStr));
        if (hSnap.exists()) {
          const data = hSnap.data();
          setWeight(data.weight || '');
          setWorkoutCategory(data.workoutCategory || '');
          setWorkoutNotes(data.workoutNotes || '');
          setFoodHealthy(data.foodHealthy?.join(', ') || '');
          setFoodJunk(data.foodJunk?.join(', ') || '');
          setFoodOut(data.foodOut?.join(', ') || '');
          setMood(data.mood || '');
          setSleepHours(data.sleepHours ?? '');
          setWater(data.water ?? '');
          setSteps(data.steps ?? '');
          setScreenTime(data.screenTime ?? '');
          setExercises(Array.isArray(data.exercises) ? data.exercises.map((e: any) => ({ name: e.name || '', weight: e.weight ?? '', sets: e.sets ?? '', reps: e.reps ?? '' })) : []);
        } else {
          // Fallback if mood is in old moodLogs
          const mSnap = await getDoc(doc(db, 'users', uid, 'moodLogs', dateStr));
          if (mSnap.exists()) {
            setMood(mSnap.data().mood || '');
          }
        }

        // Load Study
        const sSnap = await getDoc(doc(db, 'users', uid, 'studyLogs', dateStr));
        if (sSnap.exists()) {
          const data = sSnap.data();
          setSchoolNotes(data.schoolNotes || '');
          setLearningNotes(data.learningNotes || '');
          setPracticeHours(data.practiceHours || '');
        }

        // Load Work
        const wSnap = await getDoc(doc(db, 'users', uid, 'workLogs', dateStr));
        if (wSnap.exists()) {
          const data = wSnap.data();
          setWorkNotes(data.workNotes || '');
          setNetworkNotes(data.networkNotes || '');
          setWorkEnjoyment(data.workEnjoyment ?? '');
        }
        
      } catch (err: any) {
        console.warn("Firestore load error:", err.message);
      }
    }
    loadData();
  }, [dateStr]);

  const saveGoals = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save goals to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingGoals(true);
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'daily', dateStr), { date: dateStr, goals }, { merge: true });
      await appendToSheet('Sheet1!A:J', [[dateStr, goals.map(g => g.text).join(' | '), '', '', '', '', '', '', '', '']]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingGoals(false);
    }
  };

  const handleGoalChange = (index: number, val: string) => {
    const newGoals = [...goals];
    newGoals[index].text = val;
    setGoals(newGoals);
  };
  const toggleGoalDone = (index: number) => {
    const newGoals = [...goals];
    newGoals[index].done = !newGoals[index].done;
    setGoals(newGoals);
  };

  const addGoal = () => {
    setGoals([...goals, { text: '', done: false }]);
  };

  const saveHealth = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save health log to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingHealth(true);
      
      const docRef = doc(db, 'users', auth.currentUser.uid, 'healthLogs', dateStr);
      await setDoc(docRef, {
        date: dateStr,
        weight: Number(weight) || 0,
        workoutCategory,
        workoutNotes,
        foodHealthy: foodHealthy.split(',').map(s=>s.trim()).filter(Boolean),
        foodJunk: foodJunk.split(',').map(s=>s.trim()).filter(Boolean),
        foodOut: foodOut.split(',').map(s=>s.trim()).filter(Boolean),
        mood,
        sleepHours: Number(sleepHours) || 0,
        water: Number(water) || 0,
        steps: Number(steps) || 0,
        screenTime: Number(screenTime) || 0,
        exercises: exercises.filter(e => e.name.trim()).map(e => ({ name: e.name.trim(), weight: Number(e.weight) || 0, sets: Number(e.sets) || 0, reps: Number(e.reps) || 0 })),
        updatedAt: new Date()
      }, { merge: true });

      // Save to old moodLogs as well for backwards compatibility in history
      await setDoc(doc(db, 'users', auth.currentUser.uid, 'moodLogs', dateStr), {
        date: dateStr, mood, updatedAt: new Date()
      }, { merge: true });

      await appendToSheet('Sheet1!A:J', [
        [
          dateStr,
          '',
          mood,
          weight,
          workoutCategory,
          workoutNotes,
          `Healthy: ${foodHealthy}\nJunk: ${foodJunk}\nOut: ${foodOut}`,
          '',
          '',
          ''
        ]
      ]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingHealth(false);
    }
  };

  const saveStudy = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save study log to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingStudy(true);
      const docRef = doc(db, 'users', auth.currentUser.uid, 'studyLogs', dateStr);
      await setDoc(docRef, {
        date: dateStr,
        schoolNotes,
        learningNotes,
        practiceHours: Number(practiceHours) || 0,
        updatedAt: new Date()
      }, { merge: true });

      await appendToSheet('Sheet1!A:J', [
        [
          dateStr,
          '',
          '',
          '',
          '',
          '',
          '',
          practiceHours,
          `School: ${schoolNotes}\nLearning: ${learningNotes}`,
          ''
        ]
      ]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingStudy(false);
    }
  };

  const saveWork = async () => {
    if (!auth.currentUser) return;
    try {
      const confirmed = window.confirm('Save work log to Firebase and append to Google Sheets?');
      if (!confirmed) return;
      setSavingWork(true);
      const docRef = doc(db, 'users', auth.currentUser.uid, 'workLogs', dateStr);
      await setDoc(docRef, {
        date: dateStr,
        workNotes,
        networkNotes,
        workEnjoyment: Number(workEnjoyment) || 0,
        updatedAt: new Date()
      }, { merge: true });

      await appendToSheet('Sheet1!A:J', [
        [
          dateStr,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `Work: ${workNotes}\nNet: ${networkNotes}`
        ]
      ]);
    } catch (err: any) {
      console.warn("Save error:", err.message);
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingWork(false);
    }
  };

  const categories = ['Push', 'Pull', 'Legs', 'Core', 'Mobility', 'Running', 'Sports'];
  const stepWeight = (delta: number) => {
    const current = Number(weight) || 0;
    setWeight((Math.round((current + delta) * 10) / 10).toFixed(1));
  };

  return (
    <div className="p-5 sm:p-6 pb-24 max-w-xl mx-auto space-y-8 sm:space-y-12">
      <div className="text-center space-y-3 mb-10">
        <h1 className="font-serif text-6xl font-light leading-none text-text-primary">{format(date, 'dd')}</h1>
        <div className="text-[10px] text-text-secondary tracking-[0.35em] uppercase">
          {format(date, 'MMMM yyyy')} • {dayName}
        </div>
      </div>

      {/* GOALS */}
      <section className="bg-bg-secondary p-6 rounded-2xl border border-bg-tertiary space-y-6">
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-text-primary border-b border-bg-tertiary pb-4">Today's Goals</h2>
        <div className="space-y-3">
          {goals.map((goal, i) => (
            <div key={i} className="flex items-center gap-3">
              <button 
                onClick={() => toggleGoalDone(i)}
                className={`w-6 h-6 flex-shrink-0 flex items-center justify-center border rounded-full text-xs transition-colors ${goal.done ? 'bg-accent-amber border-accent-amber text-bg-primary' : 'border-bg-tertiary text-text-tertiary hover:border-text-secondary'}`}
              >
                {goal.done ? '✓' : i + 1}
              </button>
              <input 
                type="text"
                value={goal.text}
                onChange={(e) => handleGoalChange(i, e.target.value)}
                placeholder="Set a goal..."
                className={`flex-1 bg-bg-primary border border-bg-tertiary rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-amber transition-colors ${goal.done ? 'line-through text-text-tertiary' : ''}`}
              />
            </div>
          ))}
          <button 
            onClick={addGoal}
            className="flex items-center gap-2 text-xs text-text-tertiary uppercase tracking-widest hover:text-accent-amber transition-colors ml-9 mt-2"
          >
            <Plus size={14} /> Add Goal
          </button>
        </div>
          <button
            onClick={saveGoals}
            disabled={savingGoals}
          className="w-full mt-5 py-3.5 bg-bg-tertiary text-text-primary font-semibold tracking-[0.2em] text-[10px] rounded-xl uppercase active:scale-95 transition-transform disabled:opacity-50 hover:bg-bg-tertiary/80"
        >
          {savingGoals ? 'Saving...' : 'Save Goals'}
        </button>
      </section>

      {/* HEALTH & MOOD */}
      <section className="bg-bg-secondary p-6 rounded-2xl border border-bg-tertiary space-y-9">
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-accent-teal border-b border-bg-tertiary pb-4">Health & Mood</h2>
        
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-text-secondary">Mood Check-in</h3>
            <span className="text-[9px] tracking-wide text-text-tertiary">Tap again to deselect</span>
          </div>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMood(m.key === mood ? '' : m.key)}
                className={`min-h-[108px] rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 ${
                  mood === m.key
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal shadow-[0_0_0_1px_rgba(90,158,143,0.2)]'
                    : 'border-bg-tertiary bg-bg-primary/40 text-text-secondary hover:border-accent-teal/60 hover:bg-bg-primary'
                }`}
                title={m.text}
              >
                <span className="text-4xl leading-none">{m.emoji}</span>
                <span className="text-[10px] tracking-[0.12em] uppercase">{m.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-bg-tertiary bg-bg-primary/40 px-5 py-6 text-center">
          <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary mb-4">Weight</label>
          <div className="flex items-center justify-center gap-7">
            <button type="button" onClick={() => stepWeight(-0.1)} className="w-11 h-11 rounded-full border border-bg-tertiary text-xl text-text-secondary hover:border-accent-teal hover:text-accent-teal transition-colors">−</button>
            <div className="min-w-[120px]">
              <div className="font-serif text-5xl font-light leading-none text-text-primary">{weight || '—'}</div>
              <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-text-tertiary">kilograms</div>
            </div>
            <button type="button" onClick={() => stepWeight(0.1)} className="w-11 h-11 rounded-full border border-bg-tertiary text-xl text-text-secondary hover:border-accent-teal hover:text-accent-teal transition-colors">+</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Sleep (hours)', sleepHours, setSleepHours],
            ['Water (glasses)', water, setWater],
            ['Steps', steps, setSteps],
            ['Screen time (hours)', screenTime, setScreenTime],
          ].map(([label, value, setter]) => (
            <div key={label as string} className="rounded-2xl border border-bg-tertiary bg-bg-primary/40 p-3.5 space-y-2">
              <label className="block text-[9px] tracking-[0.14em] uppercase text-text-tertiary">{label as string}</label>
              <input type="number" value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)} className="w-full bg-transparent text-base text-text-primary focus:outline-none placeholder:text-text-tertiary" placeholder="—" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary">Workout Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setWorkoutCategory(cat === workoutCategory ? '' : cat)}
                className={`min-h-[60px] rounded-2xl border text-xs tracking-[0.12em] uppercase transition-colors ${
                  workoutCategory === cat 
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal' 
                    : 'border-bg-tertiary bg-bg-primary/40 text-text-secondary hover:border-accent-teal/60 hover:bg-bg-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary mt-5">Workout Journal</label>
          <textarea 
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-2xl px-4 py-4 text-sm min-h-[100px] focus:outline-none focus:border-accent-teal transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. Bench Press: 4x6 @ 60kg"
          />
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary">Structured Exercises</label>
              <span className="text-[9px] text-text-tertiary">Progressive overload</span>
            </div>
            {exercises.map((exercise, i) => (
              <div key={i} className="rounded-2xl border border-bg-tertiary bg-bg-primary/40 p-3 grid grid-cols-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2.5 items-end">
                {(['name', 'weight', 'sets', 'reps'] as const).map(field => (
                  <label key={field} className="min-w-0 space-y-1.5">
                    <span className="block text-[8px] tracking-[0.12em] uppercase text-text-tertiary">{field === 'weight' ? 'Weight kg' : field}</span>
                    <input type={field === 'name' ? 'text' : 'number'} placeholder={field === 'name' ? 'Exercise' : field === 'weight' ? '0' : '0'} value={exercise[field]} onChange={e => setExercises(exercises.map((item, index) => index === i ? { ...item, [field]: e.target.value } : item))} className="min-w-0 w-full bg-bg-secondary border border-bg-tertiary rounded-xl px-2.5 py-2.5 text-xs focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" />
                  </label>
                ))}
                <button type="button" onClick={() => setExercises(exercises.filter((_, index) => index !== i))} className="col-span-2 sm:col-span-4 text-left text-[9px] uppercase tracking-[0.15em] text-text-tertiary hover:text-accent-red transition-colors">× Remove exercise</button>
              </div>
            ))}
            <button type="button" onClick={() => setExercises([...exercises, { name: '', weight: '', sets: '', reps: '' }])} className="flex items-center gap-2 text-[10px] text-text-tertiary uppercase tracking-[0.18em] hover:text-accent-teal transition-colors"><Plus size={14} /> Add Exercise</button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary mb-2">Nutrition</label>
          <input type="text" value={foodHealthy} onChange={e=>setFoodHealthy(e.target.value)} className="w-full bg-bg-primary border border-bg-tertiary rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" placeholder="Healthy · e.g. Salad" />
          <input type="text" value={foodJunk} onChange={e=>setFoodJunk(e.target.value)} className="w-full bg-bg-primary border border-bg-tertiary rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" placeholder="Junk · e.g. Chips" />
          <input type="text" value={foodOut} onChange={e=>setFoodOut(e.target.value)} className="w-full bg-bg-primary border border-bg-tertiary rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" placeholder="Eating out · e.g. Sushi" />
        </div>

        <button 
          onClick={saveHealth}
          disabled={savingHealth}
          className="w-full py-4 bg-accent-teal text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-2xl uppercase active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-accent-teal/10"
        >
          {savingHealth ? 'Saving...' : 'Save Health & Mood'}
        </button>
      </section>

      {/* STUDY */}
      <section className="bg-bg-secondary p-6 rounded-2xl border border-bg-tertiary space-y-7">
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-accent-amber border-b border-bg-tertiary pb-4">Study & Learning</h2>
        
        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Practice Hours</label>
          <input 
            type="number" 
            value={practiceHours}
            onChange={(e) => setPracticeHours(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-accent-amber transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. 2.5"
          />
        </div>
        
        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">School / Formal Coursework</label>
          <textarea 
            value={schoolNotes}
            onChange={(e) => setSchoolNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-2xl px-4 py-4 text-sm min-h-[100px] focus:outline-none focus:border-accent-amber transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. Math: Revised Chapter 4."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Self-Learning</label>
          <textarea 
            value={learningNotes}
            onChange={(e) => setLearningNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-2xl px-4 py-4 text-sm min-h-[100px] focus:outline-none focus:border-accent-amber transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. Read 20 pages of a book."
          />
        </div>

        <button 
          onClick={saveStudy}
          disabled={savingStudy}
          className="w-full py-4 bg-accent-amber text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-2xl uppercase active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-accent-amber/10"
        >
          {savingStudy ? 'Saving...' : 'Save Study Log'}
        </button>
      </section>

      {/* WORK */}
      <section className="bg-bg-secondary p-6 rounded-2xl border border-bg-tertiary space-y-7">
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-accent-red border-b border-bg-tertiary pb-4">Work</h2>
        
        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Did you enjoy today's work?</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(value => <button key={value} onClick={() => setWorkEnjoyment(String(value === Number(workEnjoyment) ? '' : value))} className={`w-11 h-11 rounded-xl border text-xs transition-colors ${Number(workEnjoyment) === value ? 'border-accent-red bg-accent-red/10 text-accent-red' : 'border-bg-tertiary text-text-secondary hover:border-accent-red/60'}`}>{value}</button>)}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Projects & Jobs</label>
          <textarea 
            value={workNotes}
            onChange={(e) => setWorkNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-2xl px-4 py-4 text-sm min-h-[100px] focus:outline-none focus:border-accent-red transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. Built feature X for work."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] tracking-widest uppercase text-text-secondary">Networking</label>
          <textarea 
            value={networkNotes}
            onChange={(e) => setNetworkNotes(e.target.value)}
            className="w-full bg-bg-primary border border-bg-tertiary rounded-2xl px-4 py-4 text-sm min-h-[100px] focus:outline-none focus:border-accent-red transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. Met with team regarding Y."
          />
        </div>

        <button 
          onClick={saveWork}
          disabled={savingWork}
          className="w-full py-4 bg-accent-red text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-2xl uppercase active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-accent-red/10"
        >
          {savingWork ? 'Saving...' : 'Save Work Log'}
        </button>
      </section>
    </div>
  );
}
