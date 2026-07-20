import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { db, auth } from '../App';
import { addDoc, collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { appendToSheet } from '../lib/sheets';
import { Plus } from 'lucide-react';
import { MOODS } from '../lib/moods';
import { metricBucket } from '../lib/insights';

type LearningCategory = 'Book' | 'Course' | 'Topic' | 'Skill' | 'Other';
type WorkCategory = 'Project' | 'Task' | 'Networking' | 'Other';
type ItemStatus = 'In progress' | 'Completed' | 'Paused';

interface LearningItem {
  id: string;
  title: string;
  category: LearningCategory;
  status: ItemStatus;
  progressCurrent: number | null;
  progressTotal: number | null;
  unit: string;
  enjoyment: number;
  notes: string;
  startDate: string;
  updatedDate: string;
}

interface WorkItem {
  id: string;
  title: string;
  category: WorkCategory;
  status: ItemStatus;
  enjoyment: number;
  notes: string;
  startDate: string;
  updatedDate: string;
}

const emptyLearningForm = {
  title: '',
  category: 'Topic' as LearningCategory,
  progressCurrent: '',
  progressTotal: '',
  unit: '',
  notes: '',
};

const emptyWorkForm = {
  title: '',
  category: 'Project' as WorkCategory,
  notes: '',
};

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
  const [workoutCategories, setWorkoutCategories] = useState<string[]>([]);
  const [otherWorkout, setOtherWorkout] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [foodHome, setFoodHome] = useState('');
  const [foodOutside, setFoodOutside] = useState('');
  const [foodHealthyOutside, setFoodHealthyOutside] = useState('');
  const [sleepBucket, setSleepBucket] = useState('');
  const [waterBucket, setWaterBucket] = useState('');
  const [stepsBucket, setStepsBucket] = useState('');
  const [screenBucket, setScreenBucket] = useState('');
  const [exercises, setExercises] = useState<{name: string; weight: string; sets: string; reps: string}[]>([]);
  const [savingHealth, setSavingHealth] = useState(false);

  // Study
  const [schoolNotes, setSchoolNotes] = useState('');
  const [learningNotes, setLearningNotes] = useState('');
  const [practiceHours, setPracticeHours] = useState('');
  const [studyEnjoyment, setStudyEnjoyment] = useState('');
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [learningForm, setLearningForm] = useState(emptyLearningForm);
  const [showLearningForm, setShowLearningForm] = useState(false);
  const [savingLearningItem, setSavingLearningItem] = useState(false);
  const [savingStudy, setSavingStudy] = useState(false);

  // Work
  const [workNotes, setWorkNotes] = useState('');
  const [networkNotes, setNetworkNotes] = useState('');
  const [workEnjoyment, setWorkEnjoyment] = useState('');
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [workForm, setWorkForm] = useState(emptyWorkForm);
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [savingWorkItem, setSavingWorkItem] = useState(false);
  const [savingWork, setSavingWork] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const [learningSnap, workItemsSnap] = await Promise.all([
          getDocs(collection(db, 'users', uid, 'learningItems')),
          getDocs(collection(db, 'users', uid, 'workItems')),
        ]);
        setLearningItems(learningSnap.docs.map(item => ({ id: item.id, ...item.data() } as LearningItem)));
        setWorkItems(workItemsSnap.docs.map(item => ({ id: item.id, ...item.data() } as WorkItem)));
        
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
          const loadedCategories = Array.isArray(data.workoutCategories)
            ? data.workoutCategories.filter((category: any) => typeof category === 'string' && category.trim())
            : data.workoutCategory && !['no', 'none', 'rest'].includes(String(data.workoutCategory).trim().toLowerCase())
              ? [data.workoutCategory]
              : [];
          setWorkoutCategories(loadedCategories);
          setOtherWorkout(loadedCategories.find((category: string) => !['Push', 'Pull', 'Legs', 'Core', 'Yoga/Mobility', 'Arms', 'Running', 'Sports', 'Other'].includes(category)) || '');
          setWorkoutNotes(data.workoutNotes || '');
          setFoodHome(data.foodHome?.join(', ') || data.foodHealthy?.join(', ') || '');
          setFoodOutside(data.foodOutside?.join(', ') || data.foodOut?.join(', ') || data.foodJunk?.join(', ') || '');
          setFoodHealthyOutside(data.foodHealthyOutside?.join(', ') || '');
          setMood(data.mood || '');
          setSleepBucket(metricBucket(data, 'sleep'));
          setWaterBucket(metricBucket(data, 'water'));
          setStepsBucket(metricBucket(data, 'steps'));
          setScreenBucket(metricBucket(data, 'screen'));
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
          setStudyEnjoyment(data.studyEnjoyment ?? '');
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
        workoutCategory: workoutCategories.join(', '),
        workoutCategories,
        workoutNotes,
        foodHome: foodHome.split(',').map(s=>s.trim()).filter(Boolean),
        foodOutside: foodOutside.split(',').map(s=>s.trim()).filter(Boolean),
        foodHealthyOutside: foodHealthyOutside.split(',').map(s=>s.trim()).filter(Boolean),
        mood,
        sleepBucket,
        waterBucket,
        stepsBucket,
        screenBucket,
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
          workoutCategories.join(', '),
          workoutNotes,
          `Home: ${foodHome}\nOutside: ${foodOutside}\nHealthy outside: ${foodHealthyOutside}`,
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
        studyEnjoyment: Number(studyEnjoyment) || 0,
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

  const updateLearningItem = async (id: string, changes: Partial<LearningItem>) => {
    if (!auth.currentUser) return;
    const updatedDate = dateStr;
    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'learningItems', id), {
      ...changes,
      updatedDate,
      updatedAt: new Date(),
    });
    setLearningItems(items => items.map(item => item.id === id ? { ...item, ...changes, updatedDate } : item));
  };

  const addLearningItem = async () => {
    if (!auth.currentUser || !learningForm.title.trim()) return;
    setSavingLearningItem(true);
    try {
      const payload = {
        title: learningForm.title.trim(),
        category: learningForm.category,
        status: 'In progress' as ItemStatus,
        progressCurrent: learningForm.progressCurrent === '' ? null : Number(learningForm.progressCurrent),
        progressTotal: learningForm.progressTotal === '' ? null : Number(learningForm.progressTotal),
        unit: learningForm.unit.trim(),
        enjoyment: 0,
        notes: learningForm.notes.trim(),
        startDate: dateStr,
        updatedDate: dateStr,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const ref = await addDoc(collection(db, 'users', auth.currentUser.uid, 'learningItems'), payload);
      setLearningItems(items => [...items, { id: ref.id, ...payload }]);
      setLearningForm(emptyLearningForm);
      setShowLearningForm(false);
    } catch (err: any) {
      console.warn('Learning item save error:', err.message);
      alert(`Error saving learning item: ${err.message}`);
    } finally {
      setSavingLearningItem(false);
    }
  };

  const updateWorkItem = async (id: string, changes: Partial<WorkItem>) => {
    if (!auth.currentUser) return;
    const updatedDate = dateStr;
    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'workItems', id), {
      ...changes,
      updatedDate,
      updatedAt: new Date(),
    });
    setWorkItems(items => items.map(item => item.id === id ? { ...item, ...changes, updatedDate } : item));
  };

  const addWorkItem = async () => {
    if (!auth.currentUser || !workForm.title.trim()) return;
    setSavingWorkItem(true);
    try {
      const payload = {
        title: workForm.title.trim(),
        category: workForm.category,
        status: 'In progress' as ItemStatus,
        enjoyment: 0,
        notes: workForm.notes.trim(),
        startDate: dateStr,
        updatedDate: dateStr,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const ref = await addDoc(collection(db, 'users', auth.currentUser.uid, 'workItems'), payload);
      setWorkItems(items => [...items, { id: ref.id, ...payload }]);
      setWorkForm(emptyWorkForm);
      setShowWorkForm(false);
    } catch (err: any) {
      console.warn('Work item save error:', err.message);
      alert(`Error saving work item: ${err.message}`);
    } finally {
      setSavingWorkItem(false);
    }
  };

  const categories = ['Push', 'Pull', 'Legs', 'Core', 'Arms', 'Yoga/Mobility', 'Running', 'Sports', 'Other'];
  const toggleWorkoutCategory = (category: string) => {
    if (category === 'Other') {
      setWorkoutCategories(current => current.includes('Other')
        ? current.filter(item => item !== 'Other')
        : [...current, 'Other']);
      return;
    }
    setWorkoutCategories(current => current.includes(category)
      ? current.filter(item => item !== category)
      : [...current, category]);
  };
  const addOtherWorkout = () => {
    const value = otherWorkout.trim();
    if (!value) return;
    setWorkoutCategories(current => current.includes(value) ? current : [...current, value]);
    setOtherWorkout('');
  };
  const stepWeight = (delta: number) => {
    const current = Number(weight) || 0;
    setWeight((Math.round((current + delta) * 10) / 10).toFixed(1));
  };
  const bucketSelector = (
    label: string,
    value: string,
    setter: (next: string) => void,
    options: string[],
  ) => (
    <div className="rounded-[10px] border-[0.5px] border-border-subtle bg-bg-primary/40 p-3.5 space-y-3">
      <label className="block text-[10px] tracking-[0.2em] uppercase text-text-tertiary">{label}</label>
      <div className="grid grid-cols-1 gap-1.5">
        {options.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => setter(value === option ? '' : option)}
            className={`rounded-lg border-[0.5px] px-2 py-2 text-[10px] tracking-wide transition-colors ${
              value === option
                ? 'border-accent-teal bg-accent-teal/10 text-accent-teal'
                : 'border-border-subtle text-text-secondary hover:border-accent-teal/60'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
  const enjoymentSelector = (value: number, setter: (next: string) => void, accent: string) => (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(rating => (
        <button
          key={rating}
          type="button"
          onClick={() => setter(String(value === rating ? 0 : rating))}
          className={`w-8 h-8 rounded-lg border text-[10px] transition-colors ${
            value === rating
              ? accent === 'accent-amber'
                ? 'border-accent-amber bg-accent-amber/10 text-accent-amber'
                : 'border-accent-red bg-accent-red/10 text-accent-red'
              : 'border-bg-tertiary text-text-secondary hover:border-text-tertiary'
          }`}
        >
          {rating}
        </button>
      ))}
    </div>
  );
  const sortedLearningItems = [...learningItems].sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (a.status !== 'Completed' && b.status === 'Completed') return -1;
    return a.title.localeCompare(b.title);
  });
  const sortedWorkItems = [...workItems].sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (a.status !== 'Completed' && b.status === 'Completed') return -1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="p-6 pb-24 max-w-xl mx-auto space-y-8">
      <div className="text-center space-y-1 mb-8">
        <h1 className="font-serif text-[60px] font-light leading-none text-text-primary">{format(date, 'dd')}</h1>
        <div className="text-[11px] text-text-secondary tracking-[0.25em] uppercase">
          {format(date, 'MMMM yyyy')} • {dayName}
        </div>
      </div>

      {/* GOALS */}
      <section className="bg-bg-secondary p-4 rounded-[10px] border-[0.5px] border-border-subtle space-y-5">
        <h2 className="text-[10px] tracking-[0.25em] uppercase text-text-tertiary border-b-[0.5px] border-border-subtle pb-3">Today's Goals</h2>
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
                className={`flex-1 bg-bg-primary border-[0.5px] border-border-subtle rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent-amber transition-colors ${goal.done ? 'line-through text-text-tertiary' : ''}`}
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
            className="w-full mt-4 py-4 bg-accent-amber text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-[10px] uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingGoals ? 'Saving...' : 'Save Goals'}
        </button>
      </section>

      {/* HEALTH & MOOD */}
      <section className="bg-bg-secondary p-4 rounded-[10px] border-[0.5px] border-border-subtle space-y-7">
        <h2 className="text-[10px] tracking-[0.25em] uppercase text-accent-amber border-b-[0.5px] border-border-subtle pb-3">Health & Mood</h2>
        
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h3 className="text-[10px] tracking-[0.25em] uppercase text-text-tertiary">Mood Check-in</h3>
            <span className="text-[9px] tracking-wide text-text-tertiary">Tap again to deselect</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMood(m.key === mood ? '' : m.key)}
                className={`min-h-[74px] last:col-span-2 rounded-[10px] border-[0.5px] transition-all flex flex-col items-center justify-center gap-1 ${
                  mood === m.key
                    ? 'border-accent-amber bg-accent-amber/10 text-accent-amber'
                    : 'border-border-subtle bg-bg-primary/40 text-text-secondary hover:border-border-strong hover:bg-bg-primary'
                }`}
                title={m.text}
              >
                <span className="text-[22px] leading-none">{m.emoji}</span>
                <span className="text-[11px] text-center leading-tight">{m.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border-[0.5px] border-border-subtle bg-bg-primary/40 px-4 py-5 text-center">
          <label className="block text-[10px] tracking-[0.25em] uppercase text-text-tertiary mb-4">Weight (kg)</label>
          <div className="flex items-center justify-center gap-7">
            <button type="button" onClick={() => stepWeight(-0.1)} className="w-11 h-11 rounded-full border border-bg-tertiary text-xl text-text-secondary hover:border-accent-teal hover:text-accent-teal transition-colors">−</button>
            <div className="min-w-[148px]">
              <div className="font-mono text-[46px] font-normal leading-none text-text-primary border-b border-border-strong pb-1">{weight || '––.–'}</div>
              <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-text-tertiary">kilograms</div>
            </div>
            <button type="button" onClick={() => stepWeight(0.1)} className="w-11 h-11 rounded-full border border-bg-tertiary text-xl text-text-secondary hover:border-accent-teal hover:text-accent-teal transition-colors">+</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {bucketSelector('Sleep', sleepBucket, setSleepBucket, ['<4h', '4-6h', '6h+'])}
          {bucketSelector('Water', waterBucket, setWaterBucket, ['<1L', '1L-2L', '2L+'])}
          {bucketSelector('Steps', stepsBucket, setStepsBucket, ['<5k', '5-10k', '10k+'])}
          {bucketSelector('Screen time', screenBucket, setScreenBucket, ['<4h', '4-8h', '8h+'])}
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] tracking-[0.25em] uppercase text-text-tertiary">Workout</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => toggleWorkoutCategory(cat)}
                className={`min-h-[52px] rounded-[10px] border-[0.5px] text-[11px] transition-colors ${
                  workoutCategories.includes(cat)
                    ? 'border-accent-teal bg-accent-teal/10 text-accent-teal' 
                    : 'border-border-subtle bg-bg-primary/40 text-text-secondary hover:border-border-strong hover:bg-bg-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {workoutCategories.some(category => !categories.includes(category)) || workoutCategories.includes('Other') ? (
            <div className="flex gap-2">
              <input
                value={otherWorkout}
                onChange={e => setOtherWorkout(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addOtherWorkout(); }}
                className="min-w-0 flex-1 bg-bg-primary border-[0.5px] border-border-subtle rounded-lg px-3 py-3 text-xs focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary"
                placeholder="Custom workout · e.g. Chest and back"
              />
              <button type="button" onClick={addOtherWorkout} className="rounded-lg border-[0.5px] border-accent-teal/50 px-3 text-[10px] uppercase tracking-widest text-accent-teal">Add</button>
            </div>
          ) : null}
          <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary mt-5">Workout Journal</label>
          <textarea 
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            className="w-full bg-bg-primary border-[0.5px] border-border-subtle rounded-[10px] px-4 py-4 text-sm min-h-[100px] focus:outline-none focus:border-accent-teal transition-colors placeholder:text-text-tertiary"
            placeholder="e.g. Bench Press: 4x6 @ 60kg"
          />
          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary">Structured Exercises</label>
              <span className="text-[9px] text-text-tertiary">Progressive overload</span>
            </div>
            {exercises.map((exercise, i) => (
              <div key={i} className="rounded-[10px] border-[0.5px] border-border-subtle bg-bg-primary/40 p-3 grid grid-cols-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-2.5 items-end">
                {(['name', 'weight', 'sets', 'reps'] as const).map(field => (
                  <label key={field} className="min-w-0 space-y-1.5">
                    <span className="block text-[8px] tracking-[0.12em] uppercase text-text-tertiary">{field === 'weight' ? 'Weight kg' : field}</span>
                    <input type={field === 'name' ? 'text' : 'number'} placeholder={field === 'name' ? 'Exercise' : field === 'weight' ? '0' : '0'} value={exercise[field]} onChange={e => setExercises(exercises.map((item, index) => index === i ? { ...item, [field]: e.target.value } : item))} className="min-w-0 w-full bg-bg-secondary border-[0.5px] border-border-subtle rounded-lg px-2.5 py-2.5 text-xs focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" />
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
          <input type="text" value={foodHome} onChange={e=>setFoodHome(e.target.value)} className="w-full bg-bg-primary border-[0.5px] border-border-subtle rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" placeholder="Home-cooked · e.g. Rice, eggs" />
          <input type="text" value={foodOutside} onChange={e=>setFoodOutside(e.target.value)} className="w-full bg-bg-primary border-[0.5px] border-border-subtle rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" placeholder="Outside food · e.g. Pizza" />
          <input type="text" value={foodHealthyOutside} onChange={e=>setFoodHealthyOutside(e.target.value)} className="w-full bg-bg-primary border-[0.5px] border-border-subtle rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent-teal placeholder:text-text-tertiary" placeholder="Healthy outside · e.g. Salad bowl" />
        </div>

        <button 
          onClick={saveHealth}
          disabled={savingHealth}
          className="w-full py-4 bg-accent-amber text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-[10px] uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingHealth ? 'Saving...' : 'Save Health & Mood'}
        </button>
      </section>

      {/* STUDY */}
      <section className="bg-bg-secondary p-4 rounded-[10px] border-[0.5px] border-border-subtle space-y-7">
        <h2 className="text-[10px] tracking-[0.25em] uppercase text-accent-amber border-b-[0.5px] border-border-subtle pb-3">Study & Learning</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-text-secondary">Learning Items</h3>
            <button type="button" onClick={() => setShowLearningForm(!showLearningForm)} className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-accent-amber hover:text-text-primary transition-colors">
              <Plus size={14} /> Add item
            </button>
          </div>
          {sortedLearningItems.length ? (
            <div className="space-y-3">
              {sortedLearningItems.map(item => {
                const completion = item.progressTotal && item.progressTotal > 0 && item.progressCurrent !== null
                  ? Math.min(100, Math.round((item.progressCurrent / item.progressTotal) * 100))
                  : null;
                return (
                    <div key={item.id} className={`rounded-[10px] border-[0.5px] border-border-subtle bg-bg-primary/40 p-4 space-y-3 ${item.status === 'Completed' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-text-primary truncate">{item.title}</div>
                        <div className="mt-1 text-[9px] tracking-[0.14em] uppercase text-text-tertiary">{item.category} · {item.status}</div>
                      </div>
                      <select value={item.status} onChange={e => updateLearningItem(item.id, { status: e.target.value as ItemStatus })} className="bg-bg-secondary border border-bg-tertiary rounded-lg px-2 py-1 text-[10px] text-text-secondary focus:outline-none">
                        {(['In progress', 'Paused', 'Completed'] as ItemStatus[]).map(status => <option key={status}>{status}</option>)}
                      </select>
                    </div>
                    {item.status !== 'Completed' && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <button type="button" onClick={() => updateLearningItem(item.id, { progressCurrent: Math.min(item.progressTotal ?? Infinity, (item.progressCurrent ?? 0) + 1) })} className="rounded-xl border border-accent-amber/40 px-3 py-2 text-[10px] tracking-wide text-accent-amber hover:bg-accent-amber/10 transition-colors">+ Progress</button>
                          <div className="text-[10px] text-text-tertiary">{item.progressCurrent ?? 0}{item.progressTotal ? ` / ${item.progressTotal}` : ''} {item.unit}</div>
                        </div>
                        {completion !== null && (
                          <div className="space-y-1">
                            <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden"><div className="h-full rounded-full bg-accent-amber" style={{ width: `${completion}%` }} /></div>
                            <div className="text-right text-[9px] text-text-tertiary">{completion}% complete</div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] tracking-[0.12em] uppercase text-text-tertiary">Enjoyment</span>
                      {enjoymentSelector(item.enjoyment, value => updateLearningItem(item.id, { enjoyment: Number(value) }), 'accent-amber')}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-xs text-text-tertiary">Track books, courses, topics, and skills here.</p>}
          {showLearningForm && (
            <div className="rounded-[10px] border-[0.5px] border-accent-amber/30 bg-bg-primary/40 p-4 space-y-3">
              <input value={learningForm.title} onChange={e => setLearningForm({ ...learningForm, title: e.target.value })} placeholder="What are you learning?" className="w-full bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-accent-amber placeholder:text-text-tertiary" />
              <div className="grid grid-cols-2 gap-2">
                <select value={learningForm.category} onChange={e => setLearningForm({ ...learningForm, category: e.target.value as LearningCategory })} className="bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs text-text-secondary focus:outline-none">
                  {(['Book', 'Course', 'Topic', 'Skill', 'Other'] as LearningCategory[]).map(category => <option key={category}>{category}</option>)}
                </select>
                <input value={learningForm.unit} onChange={e => setLearningForm({ ...learningForm, unit: e.target.value })} placeholder="Unit · pages" className="bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs focus:outline-none focus:border-accent-amber placeholder:text-text-tertiary" />
                <input type="number" value={learningForm.progressCurrent} onChange={e => setLearningForm({ ...learningForm, progressCurrent: e.target.value })} placeholder="Current" className="bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs focus:outline-none focus:border-accent-amber placeholder:text-text-tertiary" />
                <input type="number" value={learningForm.progressTotal} onChange={e => setLearningForm({ ...learningForm, progressTotal: e.target.value })} placeholder="Total" className="bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs focus:outline-none focus:border-accent-amber placeholder:text-text-tertiary" />
              </div>
              <textarea value={learningForm.notes} onChange={e => setLearningForm({ ...learningForm, notes: e.target.value })} placeholder="Notes (optional)" className="w-full bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs min-h-[70px] focus:outline-none focus:border-accent-amber placeholder:text-text-tertiary" />
              <button type="button" onClick={addLearningItem} disabled={savingLearningItem || !learningForm.title.trim()} className="w-full py-3 rounded-xl bg-accent-amber text-[#1a0f07] text-[10px] font-semibold tracking-[0.18em] uppercase disabled:opacity-50">{savingLearningItem ? 'Saving...' : 'Save Learning Item'}</button>
            </div>
          )}
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

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-[10px] tracking-[0.2em] uppercase text-text-secondary">Did you enjoy studying?</label>
            <span className="text-[9px] tracking-wide text-text-tertiary">Tap again to clear</span>
          </div>
          {enjoymentSelector(Number(studyEnjoyment), setStudyEnjoyment, 'accent-amber')}
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
          className="w-full py-4 bg-accent-amber text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-[10px] uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingStudy ? 'Saving...' : 'Save Study Log'}
        </button>
      </section>

      {/* WORK */}
      <section className="bg-bg-secondary p-4 rounded-[10px] border-[0.5px] border-border-subtle space-y-7">
        <h2 className="text-[10px] tracking-[0.25em] uppercase text-accent-amber border-b-[0.5px] border-border-subtle pb-3">Work</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-text-secondary">Work Items</h3>
            <button type="button" onClick={() => setShowWorkForm(!showWorkForm)} className="flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase text-accent-red hover:text-text-primary transition-colors">
              <Plus size={14} /> Add item
            </button>
          </div>
          {sortedWorkItems.length ? (
            <div className="space-y-3">
              {sortedWorkItems.map(item => (
                    <div key={item.id} className={`rounded-[10px] border-[0.5px] border-border-subtle bg-bg-primary/40 p-4 space-y-3 ${item.status === 'Completed' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary truncate">{item.title}</div>
                      <div className="mt-1 text-[9px] tracking-[0.14em] uppercase text-text-tertiary">{item.category} · {item.status}</div>
                    </div>
                    <select value={item.status} onChange={e => updateWorkItem(item.id, { status: e.target.value as ItemStatus })} className="bg-bg-secondary border border-bg-tertiary rounded-lg px-2 py-1 text-[10px] text-text-secondary focus:outline-none">
                      {(['In progress', 'Paused', 'Completed'] as ItemStatus[]).map(status => <option key={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] tracking-[0.12em] uppercase text-text-tertiary">Enjoyment</span>
                    {enjoymentSelector(item.enjoyment, value => updateWorkItem(item.id, { enjoyment: Number(value) }), 'accent-red')}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-text-tertiary">Track projects, tasks, and networking here.</p>}
          {showWorkForm && (
            <div className="rounded-[10px] border-[0.5px] border-accent-red/30 bg-bg-primary/40 p-4 space-y-3">
              <input value={workForm.title} onChange={e => setWorkForm({ ...workForm, title: e.target.value })} placeholder="What are you working on?" className="w-full bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-accent-red placeholder:text-text-tertiary" />
              <select value={workForm.category} onChange={e => setWorkForm({ ...workForm, category: e.target.value as WorkCategory })} className="w-full bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs text-text-secondary focus:outline-none">
                {(['Project', 'Task', 'Networking', 'Other'] as WorkCategory[]).map(category => <option key={category}>{category}</option>)}
              </select>
              <textarea value={workForm.notes} onChange={e => setWorkForm({ ...workForm, notes: e.target.value })} placeholder="Notes (optional)" className="w-full bg-bg-secondary border border-bg-tertiary rounded-xl px-3 py-3 text-xs min-h-[70px] focus:outline-none focus:border-accent-red placeholder:text-text-tertiary" />
              <button type="button" onClick={addWorkItem} disabled={savingWorkItem || !workForm.title.trim()} className="w-full py-3 rounded-xl bg-accent-red text-[#1a0f07] text-[10px] font-semibold tracking-[0.18em] uppercase disabled:opacity-50">{savingWorkItem ? 'Saving...' : 'Save Work Item'}</button>
            </div>
          )}
        </div>

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
          className="w-full py-4 bg-accent-amber text-[#1a0f07] font-semibold tracking-[0.2em] text-[10px] rounded-[10px] uppercase active:scale-95 transition-transform disabled:opacity-50"
        >
          {savingWork ? 'Saving...' : 'Save Work Log'}
        </button>
      </section>
    </div>
  );
}
