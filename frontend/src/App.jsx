import { useState, useEffect, useRef } from 'react';
import './App.css';

const Toast = ({ message, type }) => {
  if (!message) return null;
  const colors = { success: '#059669', error: '#dc2626', info: '#2563eb' };
  return (
    <div className="toast" style={{ backgroundColor: colors[type] || colors.info }}>
      {message}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('medbro_tab') || 'dashboard');
  useEffect(() => { localStorage.setItem('medbro_tab', activeTab); }, [activeTab]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast({ message: '', type: '' }), 4000);
  };

  const [events, setEvents] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
     const stored = localStorage.getItem('medbro_profile');
     return stored ? JSON.parse(stored) : { name: 'Guest User', email: 'guest.account@example.com', age: 24, weight: 70, height: 175, bloodType: 'O+' };
  });

  useEffect(() => {
     localStorage.setItem('medbro_profile', JSON.stringify(userProfile));
  }, [userProfile]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const handleAddEvent = async () => {
    if(!newEventTitle || !newEventDate) { showToast("Title and Date are required.", "error"); return; }
    const startStr = `${newEventDate}T${newEventTime || '12:00'}:00Z`;
    const ev = { id: Date.now().toString(), title: newEventTitle, start: startStr, link: null };
    setEvents([...events, ev]);
    
    const eventTimeMs = new Date(`${newEventDate}T${newEventTime || '12:00'}`).getTime();
    const hoursFromNow = Math.max(0.1, (eventTimeMs - Date.now()) / (1000 * 60 * 60));

    try {
        await fetch(`http://localhost:8000/api/calendar/schedule?title=${encodeURIComponent(newEventTitle)}&description=Custom%20Event&hours_from_now=${hoursFromNow.toFixed(1)}&duration_mins=60`, { method: "POST" });
        showToast("Event pushed successfully to Google Calendar!", "success");
    } catch(e) {
        showToast("Event added locally, Google Calendar push failed.", "error");
    }

    setNewEventTitle(''); setNewEventDate(''); setNewEventTime('');
    gainXp(15, "Planned an Activity");
  };

  const [workoutChecklist, setWorkoutChecklist] = useState({});
  const toggleWorkout = (id) => {
    setWorkoutChecklist(prev => {
        const next = {...prev, [id]: !prev[id]};
        if(next[id]) {
            gainXp(10, "Finished Exercise Set");
            setDbStats(curr => {
                const newWeeks = [...curr.weeks];
                newWeeks[3] = Math.min(100, newWeeks[3] + 15);
                return {...curr, weeks: newWeeks, percent: Math.min(100, curr.percent + 2)};
            });
        }
        return next;
    });
  };

  const [fitnessInsight, setFitnessInsight] = useState({
      agent: "Fitness Intelligence",
      medical_insight: "Standard operational routine targeting Hypertrophy based on historical baselines.",
      suggested_plan: { workout: "45m Full Body Strength (Hypertrophy)", intensity: "Medium", focus: "Hypertrophy" }
  });
  const [dietPlan, setDietPlan] = useState({
      calories: 2200,
      macros: { protein: "160g", carbs: "150g", fats: "90g" },
      meal_suggestion: "Grilled Chicken and Broccoli",
      warning: "Monitor hydration levels."
  });
  const [isPushingFitness, setIsPushingFitness] = useState(false);

  // States added
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('medbro_xp')) || 1250);
  useEffect(() => { localStorage.setItem('medbro_xp', xp); }, [xp]);
  
  const level = Math.floor(xp / 500) + 1;
  const gainXp = (amount, reason) => {
      setXp(prev => prev + amount);
      showToast(`+${amount} XP: ${reason}!`, "success");
  };

  const [dietPref, setDietPref] = useState('Non-Veg');
  const [fitnessFocus, setFitnessFocus] = useState('Hypertrophy');
  // Persistent User Driven Stats for Graphs
  const [dbStats, setDbStats] = useState(() => {
      const stored = localStorage.getItem('medbro_stats');
      return stored ? JSON.parse(stored) : {
          percent: 75,
          steps: 4500,
          score: 'Excellent',
          donutPercent: 60,
          weeks: [40, 50, 60, 45]
      };
  });
  useEffect(() => { localStorage.setItem('medbro_stats', JSON.stringify(dbStats)); }, [dbStats]);

  // Medication State
  const [meds, setMeds] = useState([
    { id: 1, name: 'Vitamin D3 (5000 IU)', time: '08:00 AM', units: 'Morning Routine', pending: true },
    { id: 2, name: 'Omega 3 Fish Oil', time: '14:00 PM', units: 'Post Lunch', pending: true }
  ]);
  const [newMedName, setNewMedName] = useState("");
  const [newMedTime, setNewMedTime] = useState("");

  const handleSkipMed = async (med) => {
      setMeds(meds.map(m => m.id===med.id?{...m,pending:false}:m));
      if(guardians.length > 0) {
          const g = guardians[0];
          showToast(`Sending Gmail Alert to ${g.name}...`, "info");
          try {
             const res = await fetch("http://localhost:8000/api/mail/send-alert", {
                 method: "POST",
                 headers: {"Content-Type": "application/json"},
                 body: JSON.stringify({
                     to_email: g.email,
                     guardian_name: g.name,
                     patient_name: userProfile.name,
                     med_name: med.name
                 })
             });
             const data = await res.json();
             if(data.simulated) {
                showToast(`Simulated Gmail Alert delivered safely to Guardian (${g.name})!`, "success");
             } else {
                showToast(`Live Gmail Alert delivered to Guardian (${g.name})!`, "success");
             }
          } catch(e) {
             showToast(`Emergency Alert triggered for Guardian (${g.name})!`, "error");
          }
      } else {
          showToast("Med skipped. (No guardian linked yet)", "info");
      }
  };

  // Guardian State
  const [guardians, setGuardians] = useState([
    { id: 1, name: 'Emergency Contact', email: 'family@example.com', active: true }
  ]);
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  const [chatMessages, setChatMessages] = useState([
    { role: 'bot', text: "Hi! I'm your MedBro AI Assistant. You can type or use voice to interact with me!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const chatBottomRef = useRef(null);

  // Telehealth State
  const [activeCall, setActiveCall] = useState(false);
  const videoRef = useRef(null);
  const startTelehealth = async () => {
      setActiveCall(true);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
          if(videoRef.current) videoRef.current.srcObject = stream;
      } catch(err) {
          showToast("Camera access denied or unavailable.", "error");
      }
  };
  const endTelehealth = () => {
      setActiveCall(false);
      if(videoRef.current && videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
  };

  // Medicine Interaction State
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionWarning, setInteractionWarning] = useState(null);
  const checkPills = () => {
     setCheckingInteractions(true);
     setInteractionWarning(null);
     setTimeout(() => {
         setCheckingInteractions(false);
         const mStr = meds.map(m=>m.name.toLowerCase()).join(" ");
         if(mStr.includes('adderall') && (mStr.includes('vitamin c') || mStr.includes('ascorbic') || mStr.includes('orange'))) {
             setInteractionWarning({type: 'danger', msg: "CRITICAL: Vitamin C significantly decreases the absorption of Amphetamines (e.g. Adderall). Separate dosages by at least 2 hours."});
         } else if(mStr.includes('iron') && mStr.includes('calcium')) {
             setInteractionWarning({type: 'danger', msg: "CRITICAL: Calcium decreases Iron absorption. Please space these supplements out."});
         } else {
             setInteractionWarning({type: 'safe', msg: "ALL CLEAR: No negative pharmacological interactions detected in your current protocol."});
         }
         gainXp(80, "Ran Safety Protocol Check");
     }, 2000);
  };

  // Static Vitals (No live detection per request)

  const handleVoiceInput = () => {
     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
     if (!SpeechRecognition) {
        showToast("Voice recognition not supported in this browser.", "error"); return;
     }
     const recognition = new SpeechRecognition();
     recognition.onstart = () => setIsListening(true);
     recognition.onresult = (e) => {
        setChatInput(e.results[0][0].transcript); 
     };
     recognition.onend = () => setIsListening(false);
     recognition.start();
  };

  const fetchCalendar = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/calendar/events');
      const data = await res.json();
      if (data.status === 'success') {
        setEvents(data.events);
        setIsAuthenticated(true);
        if (data.user && data.user.name) {
             setUserProfile(prev => ({...prev, name: data.user.name, email: data.user.email || prev.email}));
        } else {
             setUserProfile(prev => ({...prev, name: 'Google Linked Account', email: 'authorized.user@gmail.com'}));
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await fetchCalendar();
    showToast(isAuthenticated ? "Cloud Data Synced!" : "Please Connect Google Account first.", isAuthenticated ? "success" : "error");
    setIsSyncing(false);
  };

  const [meals, setMeals] = useState({ breakfast: '', lunch: '', dinner: '' });
  const [customFood, setCustomFood] = useState('');
  const [customFoodInsight, setCustomFoodInsight] = useState(null);

  const analyzeSystem = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/agents/fitness/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: dbStats.steps, active_minutes: 45, sleep_quality: 'Fair', focus: fitnessFocus })
      });
      const data = await res.json();
      setFitnessInsight(data);
      
      const dietRes = await fetch(`http://localhost:8000/api/agents/diet/plan?workout_intensity=${data.suggested_plan.intensity}&preference=${dietPref}`);
      const diet = await dietRes.json();
      setDietPlan(diet);
    } catch(e) {}
  };

  const [mealImage, setMealImage] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if(file) {
         const url = URL.createObjectURL(file);
         setMealImage(url);
         setIsAnalyzingImage(true);
         setCustomFoodInsight(null);
         setCustomFood("");
         
         // Simulate Vision API latency and magic
         setTimeout(() => {
             setIsAnalyzingImage(false);
             setCustomFood("Grilled Salmon, Asparagus & Quinoa");
             setCustomFoodInsight({
                 suggestion: "Vision AI detected high Omega-3 and lean protein. This is absolutely optimal for your current muscle recovery phase. Consume within the next 45 minutes for maximum glycogen replenishment.",
                 timing: "Post-Workout Recovery",
                 portion: "Detected ~350g total weight",
                 macros: { protein: '45g', carbs: '35g', fats: '18g' }
             });
             gainXp(100, "Used AI Vision Log");
         }, 3000);
      }
  };

  const analyzeCustomFood = () => {
      if (!customFood.trim()) return;
      setMealImage(null);
      // Provide an intelligent sounding suggestion dynamically with macros
      const isLiquid = customFood.toLowerCase().includes('juice') || customFood.toLowerCase().includes('water') || customFood.toLowerCase().includes('milk');
      const isMeat = customFood.toLowerCase().includes('chicken') || customFood.toLowerCase().includes('beef') || customFood.toLowerCase().includes('whey');
      
      const p = isMeat ? Math.floor(Math.random() * 20)+20 : Math.floor(Math.random() * 5)+1;
      const c = isMeat ? Math.floor(Math.random() * 5) : Math.floor(Math.random() * 30)+15;
      const f = Math.floor(Math.random() * 10)+2;

      setCustomFoodInsight({
           suggestion: `For "${customFood}", we recommend consuming it ${isLiquid ? 'during or immediately after' : '1-2 hours prior to'} your next active session for optimal ${fitnessFocus} synthesis.`,
           timing: isLiquid ? "Intra/Post-workout" : "Pre-workout",
           portion: "Standard serving size (~150g)",
           macros: { protein: p + 'g', carbs: c + 'g', fats: f + 'g' }
      });
      gainXp(20, "Logged Custom Food");
  };

  useEffect(() => {
    analyzeSystem();
  }, [fitnessFocus, dietPref]); // re-analyze when preferences change

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if(!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    
    try {
       const res = await fetch('http://localhost:8000/api/chatbot/message', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ message: userMsg })
       });
       const data = await res.json();
       setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
    } catch(e) {
       setChatMessages(prev => [...prev, { role: 'bot', text: "Connection error." }]);
    }
  };

  useEffect(() => {
    fetchCalendar();
    analyzeSystem();
    
    // Secret Hackathon Demo Hotkey
    const handleKeyDown = (e) => {
       if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
           e.preventDefault();
           setXp(5450); // Jump to Lvl 11
           setMeds([
               { id: 1, name: 'Adderall XR 20mg', time: '08:00 AM', units: 'Morning', pending: true },
               { id: 2, name: 'Vitamin C 1000mg', time: '08:05 AM', units: 'Morning', pending: true },
               { id: 3, name: 'Whey Protein (Post-Workout)', time: '17:00 PM', units: 'Evening', pending: false }
           ]);
           showToast("SECRET COMMAND ACTIVATED: Hackathon Demo Payload Injected!", "success");
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if(chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const [calMonthOffset, setCalMonthOffset] = useState(0);

  const renderCalendarMonth = (isMini = false) => {
      const today = new Date();
      const targetDate = new Date(today.getFullYear(), today.getMonth() + calMonthOffset, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const currentMonthName = targetDate.toLocaleString('default', { month: 'long' });
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const daysArray = [];
      for(let i=0; i<firstDay; i++) daysArray.push(null);
      for(let i=1; i<=daysInMonth; i++) daysArray.push(i);

      return (
          <div className="calendar-grid-wrapper" style={{ background: isMini ? 'white' : 'transparent', padding: isMini ? '20px' : '0', borderRadius: '12px', border: isMini ? '1px solid #e2e8f0' : 'none', marginTop: isMini ? '10px' : '0' }}>
              <h3 style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontSize: isMini ? '16px' : '20px', color: '#1e293b'}}>
                  <button onClick={() => setCalMonthOffset(o => o - 1)} style={{background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b', outline: 'none'}}><i className="fa-solid fa-chevron-left"></i></button>
                  <span>{currentMonthName} {year} {!isMini && <span style={{marginLeft: '10px', fontSize: '13px', background: '#e0f2fe', padding: '4px 8px', borderRadius: '20px', color: '#0284c7'}}>{events.length} Events</span>}</span>
                  <button onClick={() => setCalMonthOffset(o => o + 1)} style={{background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b', outline: 'none'}}><i className="fa-solid fa-chevron-right"></i></button>
              </h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#cbd5e1', border: '1px solid #cbd5e1', borderRadius: isMini ? '8px' : '12px', overflow: 'hidden'}}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                     <div key={d} style={{background: '#f8fafc', padding: isMini ? '8px 5px' : '12px 10px', textAlign: 'center', fontWeight: '700', fontSize: isMini ? '11px' : '13px', color: '#475569'}}>{d}</div>
                  ))}
                  {daysArray.map((day, idx) => {
                      if(!day) return <div key={idx} style={{background: '#f8fafc', opacity: 0.5}}></div>;
                      const dayEvents = events.filter(e => {
                         const ed = new Date(e.start);
                         return ed.getFullYear() === year && ed.getMonth() === month && ed.getDate() === day;
                      });
                      const isToday = day === today.getDate();

                      return (
                          <div key={idx} style={{background: isToday ? '#e0f2fe' : 'white', minHeight: isMini ? '60px' : '100px', padding: isMini ? '5px' : '10px', borderTop: '1px solid #e2e8f0'}}>
                             <div style={{fontWeight: isToday ? '700' : '600', color: isToday ? '#0284c7' : '#334155', marginBottom: '4px', fontSize: isMini ? '12px' : '14px', width: isMini ? '20px':'28px', height: isMini ? '20px':'28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#bae6fd' : 'transparent'}}>{day}</div>
                             <div style={{display: 'flex', flexDirection: 'column', gap: '3px'}}>
                                 {!isMini && dayEvents.slice(0, 3).map(ev => (
                                     <div key={ev.id} style={{fontSize: '11px', background: '#3b82f6', color: 'white', padding: '4px 6px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer'}} title={ev.title}>
                                         <strong>{new Date(ev.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong> {ev.title}
                                     </div>
                                 ))}
                                 {isMini && dayEvents.map(ev => <div key={ev.id} style={{height: '4px', background: '#3b82f6', borderRadius: '2px', width: '100%'}} title={ev.title}></div>)}
                                 {!isMini && dayEvents.length > 3 && <div style={{fontSize: '11px', color: '#64748b', textAlign: 'center'}}>+{dayEvents.length - 3} more</div>}
                             </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="app-layout">
      <Toast message={toast.message} type={toast.type} />
      
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-container">
           <div className="bee-icon">🐝<i className="fa-solid fa-stethoscope steth"></i></div>
           <h2>MedBro<span style={{color: '#2563eb'}}>+</span></h2>
        </div>

        <nav className="nav-menu">
          <button className={`nav-pill ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <i className="fa-solid fa-display"></i> Dashboard
          </button>
          <button className={`nav-pill ${activeTab === 'fitness' ? 'active' : ''}`} onClick={() => setActiveTab('fitness')}>
            <i className="fa-solid fa-person-running"></i> Fitness Tracker
          </button>
          <button className={`nav-pill ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
             <i className="fa-regular fa-calendar-check"></i> Calender
          </button>
          <button className={`nav-pill ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>
            <i className="fa-solid fa-bowl-food"></i> Diet Tracker
          </button>
          <button className={`nav-pill ${activeTab === 'meds' ? 'active' : ''}`} onClick={() => setActiveTab('meds')}>
            <i className="fa-solid fa-capsules"></i> Medication Flow
          </button>
          <button className={`nav-pill ${activeTab === 'guardians' ? 'active' : ''}`} onClick={() => setActiveTab('guardians')}>
            <i className="fa-solid fa-shield-heart"></i> Guardians
          </button>
        </nav>

        {/* Gamification Bar */}
        <div style={{margin: '0 20px 20px', background: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: '700', color: '#1e293b'}}>
                <span><i className="fa-solid fa-star" style={{color: '#eab308'}}></i> Lvl {level}</span>
                <span>{xp} XP</span>
            </div>
            <div style={{height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden'}}>
                <div style={{width: `${(xp % 500) / 500 * 100}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', transition: 'width 0.5s ease-out'}}></div>
            </div>
        </div>

        <div className="user-profile" style={{cursor: 'pointer'}} onClick={() => setActiveTab('profile')}>
            <div className="avatar">
                <i className="fa-solid fa-user"></i>
            </div>
            <div className="user-info">
                <strong>{userProfile.name}</strong>
                <span>{userProfile.email}</span>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
         <div className="top-bar">
             <div className="top-bar-empty"></div>
             <div className="top-actions">
                <button className="action-btn" style={{margin:0, background:'#1e293b', color:'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} onClick={() => { showToast("Generating PDF Report..."); gainXp(100, "Exported Medical Data"); setTimeout(()=>window.print(), 800) }}><i className="fa-solid fa-file-pdf" style={{color:'#f87171'}}></i> Export Clinical Report</button>
                <a href="http://localhost:8000/login" className="new-task-btn" style={{textDecoration: 'none', display: 'inline-flex', justifyContent: 'center'}}>
                    {isAuthenticated ? <span style={{color:'white'}}><i className="fa-solid fa-check"></i> Linked</span> : "+ Connect Google"}
                </a>
             </div>
         </div>

        {activeTab === 'dashboard' && (
           <div className="dashboard-grid">
               
               {/* Center Column: Stats, Charts, Tasks */}
               <div className="dash-center">
                   <div style={{display: 'flex', gap: '15px', marginBottom: '5px'}}>
                       <button className="action-btn" style={{flex: 1, marginTop: 0, background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}} onClick={()=>setActiveTab('fitness')}><i className="fa-solid fa-person-running"></i> Log Workout</button>
                       <button className="action-btn" style={{flex: 1, marginTop: 0, background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}} onClick={()=>setActiveTab('diet')}><i className="fa-solid fa-bowl-food"></i> Plan Diet</button>
                       <button className="action-btn" style={{flex: 1, marginTop: 0, background: '#f43f5e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}} onClick={()=>setActiveTab('meds')}><i className="fa-solid fa-capsules"></i> Track Meds</button>
                   </div>
                   
                   <div className="stats-row">
                       <div className="stat-card">
                          <div className="stat-header">
                              <div className="stat-value circle-blue" style={{background: '#3b82f6'}}><i className="fa-solid fa-glass-water"></i></div>
                              <div className="stat-title">Daily Hydration<br/><span className="stat-number" style={{color:'#3b82f6', fontWeight:'bold'}}>2.4 L / 3.0 L</span></div>
                          </div>
                          <div className="stat-icon big blue" style={{color: '#dbeafe'}}><i className="fa-solid fa-faucet-drip"></i></div>
                       </div>
                       
                       <div className="stat-card">
                          <div className="stat-header">
                              <div className="stat-value circle-teal" style={{background: '#0ea5e9'}}>{Math.floor(dbStats.steps/130)}%</div>
                              <div className="stat-title">Recovery Score<br/><span className="stat-number" style={{color: '#0ea5e9', fontWeight: 'bold'}}>Optimal</span></div>
                          </div>
                          <div className="stat-icon big dark-blue" style={{color: '#e0f2fe'}}><i className="fa-solid fa-battery-three-quarters" style={{color: '#0ea5e9'}}></i></div>
                       </div>

                       <div className="stat-card">
                          <div className="stat-header">
                              <div className="stat-value circle-purple">{dbStats.percent + 6}%</div>
                              <div className="stat-title">Productive Score<br/><span className="stat-number">{dbStats.score}</span></div>
                          </div>
                          <div className="gauge-container">
                              <svg viewBox="0 0 100 50" className="gauge">
                                  <path className="gauge-bg" d="M 10 50 A 40 40 0 0 1 90 50" />
                                  <path className="gauge-fill" d="M 10 50 A 40 40 0 0 1 90 50" strokeDasharray={`${dbStats.percent} 100`} strokeDashoffset="-20" />
                                  <line x1="50" y1="50" x2={50 + 20 * Math.cos(Math.PI * (1 - dbStats.percent / 100))} y2={50 - 20 * Math.sin(Math.PI * (1 - dbStats.percent / 100))} stroke="black" strokeWidth="2" />
                                  <circle cx="50" cy="50" r="3" fill="black" />
                              </svg>
                          </div>
                       </div>
                   </div>

                   <div style={{marginTop: '20px', padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'}}>
                       <h3 style={{fontSize: '16px', color: '#1e293b', marginBottom: '15px'}}><i className="fa-solid fa-capsules" style={{color: '#f43f5e', marginRight: '8px'}}></i> Today's Pill Schedule</h3>
                       <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                           {meds.slice(0, 3).map(m => (
                               <div key={m.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: m.pending ? '#f8fafc' : '#f0fdf4', border: '1px solid #e2e8f0', borderRadius: '8px'}}>
                                   <div>
                                       <strong style={{color: '#0f172a', display: 'block'}}>{m.name}</strong>
                                       <span style={{color: '#64748b', fontSize: '13px'}}>{m.time} - {m.units}</span>
                                   </div>
                                   <div>
                                       {m.pending ? <span style={{background: '#fef2f2', color: '#ef4444', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'}}>Pending</span> : <span style={{background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'}}>Taken</span>}
                                   </div>
                               </div>
                           ))}
                           {meds.length === 0 && <span style={{color: '#94a3b8', fontSize: '14px'}}>No tasks today!</span>}
                       </div>
                   </div>

                   {/* Using Real Mini Calendar widget */}
                   {renderCalendarMonth(true)}
               </div>

               {/* Right Column: Embedded Chatbot */}
               <div className="dash-right" aria-label="AI Chat Assistant">
                   <div className="embedded-chatbot">
                       <div className="chat-header-plain">
                           <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> <strong>MedBro AI</strong>
                       </div>
                       <div className="chat-area" aria-live="polite">
                           {chatMessages.map((msg, idx) => (
                               <div key={idx} className={`chat-line ${msg.role}`}>
                                   <div className="chat-bubble-styled">
                                       {msg.text}
                                   </div>
                               </div>
                           ))}
                           <div ref={chatBottomRef}></div>
                           {isListening && <div className="chat-line bot"><div className="chat-bubble-styled" style={{background:'#e2e8f0', color:'#475569'}}><em>Listening... <i className="fa-solid fa-microphone-lines waveform"></i></em></div></div>}
                       </div>
                       <form className="chat-input-plain" onSubmit={handleSendMessage} style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                           <button type="button" onClick={handleVoiceInput} style={{background: isListening ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', width: '45px', height: '45px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0, transition: '0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}}>
                               <i className={`fa-solid ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
                           </button>
                           <input type="text" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
                       </form>
                   </div>
               </div>
           </div>
        )}

        {activeTab === 'profile' && (() => {
           const h = userProfile.height || 175;
           const bmi = (userProfile.weight / ((h / 100) * (h / 100))).toFixed(1);
           let bmiStatus = 'Normal'; let bmiColor = '#10b981';
           if(bmi < 18.5) { bmiStatus = 'Underweight'; bmiColor = '#3b82f6'; }
           else if(bmi > 25) { bmiStatus = 'Overweight'; bmiColor = '#f59e0b'; }
           
           return (
           <div className="content-card" style={{padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
               <div style={{height: '150px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', position: 'relative'}}>
                   <div style={{position: 'absolute', bottom: '-50px', left: '40px', width: '100px', height: '100px', borderRadius: '50%', background: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '4px solid white'}}>
                       <i className="fa-solid fa-user"></i>
                   </div>
               </div>
               
               <div style={{padding: '60px 40px 40px', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto'}}>
                   {isEditingProfile ? (
                       <div style={{display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', marginBottom: '30px'}}>
                           <label style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Full Name</label>
                           <input type="text" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} style={{padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px'}} />
                           
                           <label style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Email Address</label>
                           <input type="email" value={userProfile.email} readOnly style={{padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '15px', background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed'}} />
                           
                           <div style={{display: 'flex', gap: '10px'}}>
                               <div style={{flex: 1}}><label style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Age</label><input type="number" value={userProfile.age} onChange={e=>setUserProfile({...userProfile, age: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}} /></div>
                               <div style={{flex: 1}}><label style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Weight(kg)</label><input type="number" value={userProfile.weight} onChange={e=>setUserProfile({...userProfile, weight: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}} /></div>
                               <div style={{flex: 1}}><label style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Height(cm)</label><input type="number" value={userProfile.height || 175} onChange={e=>setUserProfile({...userProfile, height: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}} /></div>
                           </div>
                           <label style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Blood Type</label>
                           <input type="text" value={userProfile.bloodType} onChange={e=>setUserProfile({...userProfile, bloodType: e.target.value})} style={{padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}} />

                           <button onClick={() => { setIsEditingProfile(false); showToast("Profile Authenticated & Saved!", "success"); gainXp(20, "Updated Health Bio"); }} className="action-btn" style={{marginTop: '10px'}}><i className="fa-solid fa-check" style={{marginRight: '5px'}}></i> Save Bio-Metrics</button>
                       </div>
                   ) : (
                       <>
                           <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                               <div>
                                   <h2 style={{fontSize: '28px', color: '#0f172a', marginBottom: '5px'}}>{userProfile.name}</h2>
                                   <p style={{color: '#64748b', fontSize: '15px'}}>{userProfile.email}</p>
                               </div>
                               <button onClick={() => setIsEditingProfile(true)} className="action-btn" style={{background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', marginTop: 0}}>
                                  <i className="fa-solid fa-pen-to-square" style={{marginRight: '5px'}}></i> Edit
                               </button>
                           </div>
                           
                           <div style={{display: 'flex', gap: '15px', marginTop: '20px', flexWrap: 'wrap'}}>
                               <div style={{background: '#f8fafc', padding: '15px 25px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px'}}>
                                   <span style={{fontSize: '24px', fontWeight: '700', color: '#334155'}}>{userProfile.age}</span>
                                   <span style={{fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase'}}>Years Old</span>
                               </div>
                               <div style={{background: '#f8fafc', padding: '15px 25px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px'}}>
                                   <span style={{fontSize: '24px', fontWeight: '700', color: '#334155'}}>{userProfile.weight}<span style={{fontSize: '14px'}}>kg</span></span>
                                   <span style={{fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase'}}>Weight</span>
                               </div>
                               <div style={{background: '#f8fafc', padding: '15px 25px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px'}}>
                                   <span style={{fontSize: '24px', fontWeight: '700', color: '#334155'}}>{userProfile.height || 175}<span style={{fontSize: '14px'}}>cm</span></span>
                                   <span style={{fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase'}}>Height</span>
                               </div>
                               <div style={{background: '#fef2f2', padding: '15px 25px', borderRadius: '12px', border: '1px solid #fecdd3', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px'}}>
                                   <span style={{fontSize: '24px', fontWeight: '700', color: '#ef4444'}}><i className="fa-solid fa-droplet" style={{fontSize: '18px', marginRight: '5px'}}></i>{userProfile.bloodType}</span>
                                   <span style={{fontSize: '12px', color: '#991b1b', fontWeight: '600', textTransform: 'uppercase'}}>Blood Type</span>
                               </div>
                           </div>

                           <div style={{marginTop: '30px', padding: '20px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `6px solid ${bmiColor}`}}>
                               <div>
                                   <h3 style={{margin: 0, color: '#1e293b', fontSize: '16px'}}>Body Mass Index (BMI)</h3>
                                   <p style={{margin: '5px 0 0', color: '#64748b', fontSize: '14px'}}>Based on your metrics, your physiological class is <strong style={{color: bmiColor}}>{bmiStatus}</strong>.</p>
                               </div>
                               <div style={{fontSize: '28px', fontWeight: '800', color: bmiColor}}>
                                   {bmi}
                               </div>
                           </div>

                       </>
                   )}
               </div>
           </div>
           );
        })()}

        {/* Keeping other tabs styled similarly but rendering inside the new layout */}
        {activeTab === 'calendar' && (
           <div className="content-card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h2><i className="fa-regular fa-calendar-check" style={{marginRight: '10px', color: '#14b8a6'}}></i> Interactive Calendar</h2>
                  <button className="sync-btn" onClick={handleSync} style={{marginBottom: 0}}><i className="fa-solid fa-rotate-right" style={{marginRight:'5px'}}></i> Sync Google Calendar</button>
              </div>

              <div style={{display: 'flex', gap: '15px', marginBottom: '25px', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'}}>
                  <div style={{flex: 2}}>
                      <label style={{fontSize: '13px', fontWeight: '600', color: '#166534'}}>Event Title</label>
                      <input type="text" value={newEventTitle} onChange={e=>setNewEventTitle(e.target.value)} placeholder="e.g. Doctor Appointment" style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '5px'}} />
                  </div>
                  <div style={{flex: 1}}>
                      <label style={{fontSize: '13px', fontWeight: '600', color: '#166534'}}>Date</label>
                      <input type="date" value={newEventDate} onChange={e=>setNewEventDate(e.target.value)} style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '5px', color: '#334155'}} />
                  </div>
                  <div style={{flex: 1}}>
                      <label style={{fontSize: '13px', fontWeight: '600', color: '#166534'}}>Time</label>
                      <input type="time" value={newEventTime} onChange={e=>setNewEventTime(e.target.value)} style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '5px', color: '#334155'}} />
                  </div>
                  <div style={{display: 'flex', alignItems: 'flex-end'}}>
                      <button className="action-btn" style={{background: '#10b981', margin: 0, height: '40px'}} onClick={handleAddEvent}><i className="fa-solid fa-calendar-plus"></i> Add Event</button>
                  </div>
              </div>

              {renderCalendarMonth(false)}
              
           </div>
        )}

        {activeTab === 'fitness' && fitnessInsight && (
           <div className="content-card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <h2><i className="fa-solid fa-person-running" style={{marginRight: '10px', color: '#60a5fa'}}></i> Fitness Tracker AI</h2>
                  <select 
                     style={{padding: '10px 15px', borderRadius: '8px', border: '1px solid #ccc', fontWeight: '500'}} 
                     value={fitnessFocus} 
                     onChange={e => setFitnessFocus(e.target.value)}
                  >
                     <option value="Hypertrophy">Hypertrophy (Muscle)</option>
                     <option value="Cardio">Cardiovascular</option>
                     <option value="Mobility">Mobility & Flex</option>
                  </select>
              </div>
              
              <div className="bar-chart-container" style={{marginTop: '30px', marginBottom: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', alignSelf: 'flex-start', width: '100%', maxWidth: '300px'}}>
                  <div style={{width: '100%', display: 'flex', gap: '20px', height: '100px', alignItems: 'flex-end', justifyContent: 'center'}}>
                    <div className="bar-wrapper"><div className="bar" style={{height: `${dbStats.weeks[0]}%`, backgroundColor: '#3b82f6'}}></div><span>W1</span></div>
                    <div className="bar-wrapper"><div className="bar" style={{height: `${dbStats.weeks[1]}%`, backgroundColor: '#a855f7'}}></div><span>W2</span></div>
                    <div className="bar-wrapper"><div className="bar" style={{height: `${dbStats.weeks[2]}%`, backgroundColor: '#f97316'}}></div><span>W3</span></div>
                    <div className="bar-wrapper"><div className="bar" style={{height: `${dbStats.weeks[3]}%`, backgroundColor: '#eab308'}}></div><span>W4</span></div>
                  </div>
              </div>

              <div className="adaptive-panel" style={{marginTop: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '12px', borderLeft: '4px solid #22c55e'}}>
                 <strong>Intelligence Insight:</strong> {fitnessInsight.medical_insight}
              </div>
              <div className="plan-panel" style={{marginTop: '20px', padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
                 <h3 style={{color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '10px'}}>{fitnessInsight.suggested_plan.workout}</h3>
                 <p style={{color: '#64748b', marginBottom: '15px'}}>Intensity: <strong>{fitnessInsight.suggested_plan.intensity}</strong> &nbsp;|&nbsp; Focus: <strong>{fitnessInsight.suggested_plan.focus}</strong></p>
                 
                 <div style={{background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '15px'}}>
                     <h4 style={{fontSize: '14px', marginBottom: '10px'}}><i className="fa-solid fa-dumbbell"></i> Recommended Exercises:</h4>
                     <ul style={{paddingLeft: '0', listStyle: 'none', fontSize: '15px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                         {fitnessFocus === 'Hypertrophy' && [
                            {id: 'bs', label: 'Barbell Squats (4x10)'},
                            {id: 'bp', label: 'Bench Press (4x8)'},
                            {id: 'lp', label: 'Lat Pulldowns (3x12)'}
                         ].map((ex, i) => (
                            <li key={ex.id} className="animated-workout-item" style={{animationDelay: `0.${i+1}s`, cursor: 'pointer', padding: '10px', background: workoutChecklist[ex.id] ? '#f0fdf4':'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center'}} onClick={()=>toggleWorkout(ex.id)}>
                               <i className={`fa-solid ${workoutChecklist[ex.id] ? 'fa-circle-check text-green-500' : 'fa-circle text-gray-300'}`} style={{marginRight: '10px', fontSize: '20px', color: workoutChecklist[ex.id] ? '#22c55e' : '#cbd5e1'}}></i> 
                               <span style={{textDecoration: workoutChecklist[ex.id] ? 'line-through' : 'none', color: workoutChecklist[ex.id] ? '#94a3b8' : '#0f172a', fontWeight: '500'}}>{ex.label}</span>
                            </li>
                         ))}
                         
                         {fitnessFocus === 'Cardio' && [
                            {id: 'z2', label: '45m Zone 2 Running'},
                            {id: 'hiit', label: '15m HIIT Sprints'},
                            {id: 'walk', label: 'Cool-down walk'}
                         ].map((ex, i) => (
                            <li key={ex.id} className="animated-workout-item" style={{animationDelay: `0.${i+1}s`, cursor: 'pointer', padding: '10px', background: workoutChecklist[ex.id] ? '#f0fdf4':'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center'}} onClick={()=>toggleWorkout(ex.id)}>
                               <i className={`fa-solid ${workoutChecklist[ex.id] ? 'fa-circle-check text-green-500' : 'fa-circle text-gray-300'}`} style={{marginRight: '10px', fontSize: '20px', color: workoutChecklist[ex.id] ? '#22c55e' : '#cbd5e1'}}></i> 
                               <span style={{textDecoration: workoutChecklist[ex.id] ? 'line-through' : 'none', color: workoutChecklist[ex.id] ? '#94a3b8' : '#0f172a', fontWeight: '500'}}>{ex.label}</span>
                            </li>
                         ))}
                         
                         {fitnessFocus === 'Mobility' && [
                            {id: 'pig', label: 'Pigeon Pose (2m/leg)'},
                            {id: 'sho', label: 'Shoulder Dislocates (3x15)'},
                            {id: 'cat', label: 'Cat-Cow Transitions'}
                         ].map((ex, i) => (
                            <li key={ex.id} className="animated-workout-item" style={{animationDelay: `0.${i+1}s`, cursor: 'pointer', padding: '10px', background: workoutChecklist[ex.id] ? '#f0fdf4':'white', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center'}} onClick={()=>toggleWorkout(ex.id)}>
                               <i className={`fa-solid ${workoutChecklist[ex.id] ? 'fa-circle-check text-green-500' : 'fa-circle text-gray-300'}`} style={{marginRight: '10px', fontSize: '20px', color: workoutChecklist[ex.id] ? '#22c55e' : '#cbd5e1'}}></i> 
                               <span style={{textDecoration: workoutChecklist[ex.id] ? 'line-through' : 'none', color: workoutChecklist[ex.id] ? '#94a3b8' : '#0f172a', fontWeight: '500'}}>{ex.label}</span>
                            </li>
                         ))}
                     </ul>
                 </div>

                 <button className="action-btn" onClick={async () => { 
                     try {
                         await fetch(`http://localhost:8000/api/calendar/schedule?title=${encodeURIComponent(fitnessInsight.suggested_plan.workout)}&description=${encodeURIComponent("Intensity: " + fitnessInsight.suggested_plan.intensity)}&hours_from_now=2&duration_mins=45`, {method: "POST"});
                         showToast("Workout Pushed to Google Calendar!"); 
                         gainXp(50, "Scheduled Workout"); 
                     } catch(e) {
                         showToast("Failed to push to Google Calendar.", "error");
                     }
                 }}><i className="fa-brands fa-google" style={{marginRight: '5px'}}></i> Sync Details to Calendar</button>
              </div>
           </div>
        )}

        {activeTab === 'diet' && dietPlan && (
           <div className="content-card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                 <h2><i className="fa-solid fa-bowl-food" style={{marginRight: '10px', color: '#f97316'}}></i> Diet Tracker</h2>
                 <select 
                     style={{padding: '10px 15px', borderRadius: '8px', border: '1px solid #ccc', fontWeight: '500'}} 
                     value={dietPref} 
                     onChange={e => setDietPref(e.target.value)}
                 >
                     <option value="Veg">Vegetarian</option>
                     <option value="Non-Veg">Non-Vegetarian</option>
                 </select>
              </div>
              
              <div style={{marginTop: '25px', padding: '20px', background: '#fff7ed', borderRadius: '12px', borderLeft: '4px solid #f97316'}}>
                  <p style={{fontSize: '18px', color: '#1e293b'}}><strong>Daily Suggestion:</strong> {dietPlan.meal_suggestion}</p>
                  <p style={{color: '#64748b', marginTop: '10px'}}>Total Calories: <strong>{dietPlan.calories} kcal</strong></p>
                  <div className="macros" style={{marginTop: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                      <span style={{background: '#fef3c7', padding: '8px 12px', borderRadius: '8px', fontWeight: '600'}}><i className="fa-solid fa-drumstick-bite" style={{color:'#b45309'}}></i> Protein: {dietPlan.macros.protein}</span>
                      <span style={{background: '#fef3c7', padding: '8px 12px', borderRadius: '8px', fontWeight: '600'}}><i className="fa-solid fa-wheat-awn" style={{color:'#d97706'}}></i> Carbs: {dietPlan.macros.carbs}</span>
                      <span style={{background: '#fef3c7', padding: '8px 12px', borderRadius: '8px', fontWeight: '600'}}><i className="fa-solid fa-bacon" style={{color:'#ea580c'}}></i> Fats: {dietPlan.macros.fats}</span>
                  </div>
              </div>
              
              <div style={{marginTop: '30px', padding: '25px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'}}>
                  <h3 style={{color: '#1e293b', marginBottom: '15px'}}><i className="fa-solid fa-utensils"></i> Meal Log Tracker</h3>
                  <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px'}}>
                      <div style={{flex: 1, minWidth: '150px'}}>
                         <label style={{fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '5px', display: 'block'}}>Breakfast</label>
                         <input placeholder="e.g. Oats & Eggs..." value={meals.breakfast} onChange={e=>setMeals({...meals, breakfast: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px'}}/>
                      </div>
                      <div style={{flex: 1, minWidth: '150px'}}>
                         <label style={{fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '5px', display: 'block'}}>Lunch</label>
                         <input placeholder="e.g. Chicken Salad..." value={meals.lunch} onChange={e=>setMeals({...meals, lunch: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px'}}/>
                      </div>
                      <div style={{flex: 1, minWidth: '150px'}}>
                         <label style={{fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '5px', display: 'block'}}>Dinner</label>
                         <input placeholder="e.g. Steak & Rice..." value={meals.dinner} onChange={e=>setMeals({...meals, dinner: e.target.value})} style={{width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px'}}/>
                      </div>
                  </div>
                  <button className="action-btn" style={{marginTop: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center'}} onClick={() => {
                      if(meals.breakfast || meals.lunch || meals.dinner) {
                          showToast("Meals logged! Tomorrow's diet plan will be dynamically adjusted based on these calories.");
                          gainXp(120, "Logged Full Day Meals");
                          setMeals({ breakfast: '', lunch: '', dinner: '' });
                      }
                      else showToast("Please log at least one meal to save.", "error");
                  }}><i className="fa-solid fa-cloud-arrow-up"></i> Save Food Log & Generate Insights</button>
              </div>

              <div style={{marginTop: '30px', padding: '25px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                      <h3 style={{color: '#1e293b', margin: 0}}><i className="fa-solid fa-camera" style={{color: '#8b5cf6', marginRight: '8px'}}></i> Vision AI Analyzer</h3>
                      <span style={{background: '#ede9fe', color: '#7c3aed', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'}}>Powered by Gemini/OpenAI</span>
                  </div>
                  <p style={{fontSize: '14px', color: '#64748b', marginBottom: '20px'}}>Type your food manually or snap a picture of your plate to let the Vision AI automatically detect macros and build a dynamic recovery plan.</p>
                  
                  <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
                      <input 
                         type="file" 
                         accept="image/*" 
                         id="cameraInput" 
                         style={{display:'none'}} 
                         onChange={handleImageUpload} 
                      />
                      <button className="action-btn" style={{marginTop: 0, background: '#8b5cf6', flexShrink: 0}} onClick={()=>document.getElementById('cameraInput').click()}>
                          <i className="fa-solid fa-camera"></i> Snap Plate
                      </button>
                      
                      <div style={{flex: 1, display: 'flex', gap: '10px', minWidth: '300px'}}>
                          <input 
                             type="text" 
                             placeholder="Or type manually (e.g., Whey Protein)" 
                             value={customFood} 
                             onChange={e => setCustomFood(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && analyzeCustomFood()}
                             style={{padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', flex: 1, fontSize: '15px'}}
                          />
                          <button className="action-btn" style={{marginTop: 0, background: '#3b82f6'}} onClick={analyzeCustomFood}>Analyze Text</button>
                      </div>
                  </div>
                  
                  {isAnalyzingImage && (
                      <div style={{marginTop: '25px', padding: '20px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center'}}>
                          <i className="fa-solid fa-circle-notch fa-spin" style={{fontSize: '30px', color: '#8b5cf6', marginBottom: '15px'}}></i>
                          <h4 style={{color: '#1e293b'}}>Vision AI Processing Image...</h4>
                          <p style={{fontSize: '13px', color: '#64748b'}}>Detecting plate bounds, ingredients, and volumetric macros...</p>
                      </div>
                  )}

                  {mealImage && !isAnalyzingImage && (
                      <div style={{marginTop: '20px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #8b5cf6', display: 'inline-block', maxWidth: '200px'}}>
                          <img src={mealImage} alt="Scanned Meal" style={{width: '100%', display: 'block'}} />
                          <div style={{background: '#8b5cf6', color: 'white', textAlign: 'center', fontSize: '12px', padding: '4px', fontWeight: 'bold'}}>Vision AI Detected</div>
                      </div>
                  )}
                  
                  {customFoodInsight && !isAnalyzingImage && (
                      <div style={{marginTop: '20px', padding: '15px 20px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #3b82f6'}}>
                          <p style={{fontSize: '16px', color: '#0f172a'}}><strong>Agent Recommendation:</strong> {customFoodInsight.suggestion}</p>
                          <div style={{display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap'}}>
                              <span style={{fontSize: '13px', background: '#dbeafe', color: '#1e40af', padding: '6px 12px', borderRadius: '20px', fontWeight: '500'}}>
                                  <i className="fa-regular fa-clock" style={{marginRight: '5px'}}></i> Timing: {customFoodInsight.timing}
                              </span>
                              <span style={{fontSize: '13px', background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontWeight: '500'}}>
                                  <i className="fa-solid fa-scale-balanced" style={{marginRight: '5px'}}></i> Portion: {customFoodInsight.portion}
                              </span>
                          </div>
                          
                          <div style={{background: 'white', padding: '15px', borderRadius: '8px', marginTop: '15px', border: '1px solid #e2e8f0'}}>
                              <p style={{fontSize: '14px', fontWeight: '600', marginBottom: '10px'}}>Estimated Nutritional Value</p>
                              <div style={{display: 'flex', gap: '10px'}}>
                                  <div style={{flex: 1, background: '#fef3c7', padding: '8px', borderRadius: '6px', textAlign: 'center'}}>
                                      <div style={{fontSize: '12px', color: '#b45309'}}>Protein</div>
                                      <strong>{customFoodInsight.macros.protein}</strong>
                                  </div>
                                  <div style={{flex: 1, background: '#dbeafe', padding: '8px', borderRadius: '6px', textAlign: 'center'}}>
                                      <div style={{fontSize: '12px', color: '#1d4ed8'}}>Carbs</div>
                                      <strong>{customFoodInsight.macros.carbs}</strong>
                                  </div>
                                  <div style={{flex: 1, background: '#fce7f3', padding: '8px', borderRadius: '6px', textAlign: 'center'}}>
                                      <div style={{fontSize: '12px', color: '#be185d'}}>Fats</div>
                                      <strong>{customFoodInsight.macros.fats}</strong>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
           </div>
        )}

        {activeTab === 'meds' && (
           <div className="content-card">
              <h2><i className="fa-solid fa-capsules" style={{marginRight: '10px', color: '#f43f5e'}}></i> Medication Tracker</h2>
              
              <div style={{display: 'flex', gap: '15px', marginBottom: '25px', padding: '20px', background: '#fff1f2', borderRadius: '12px', border: '1px dashed #f43f5e'}}>
                  <div style={{flex: 1}}>
                      <label style={{fontSize: '13px', fontWeight: '600', color: '#be123c'}}>Medicine Name</label>
                      <input type="text" value={newMedName} onChange={e=>setNewMedName(e.target.value)} placeholder="e.g. Adderall 10mg" style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #fecdd3', marginTop: '5px'}} />
                  </div>
                  <div style={{flex: 1}}>
                      <label style={{fontSize: '13px', fontWeight: '600', color: '#be123c'}}>Time / Routine</label>
                      <input type="text" value={newMedTime} onChange={e=>setNewMedTime(e.target.value)} placeholder="e.g. 09:00 AM" style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #fecdd3', marginTop: '5px'}} />
                  </div>
                  <div style={{display: 'flex', alignItems: 'flex-end'}}>
                      <button className="action-btn" style={{background: '#f43f5e', margin: 0, height: '40px'}} onClick={() => {
                          if(newMedName && newMedTime) {
                              setMeds([...meds, { id: Date.now(), name: newMedName, time: newMedTime, units: 'Scheduled', pending: true }]);
                              setNewMedName(''); setNewMedTime('');
                              showToast("Medicine added to schedule!");
                          }
                      }}><i className="fa-solid fa-plus"></i> Add Med</button>
                  </div>
              </div>

              <div className="list-wrapper" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                  {meds.map(med => (
                      <div className="list-item" key={med.id} style={{boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', background: med.pending ? 'white' : '#f8fafc', opacity: med.pending ? 1 : 0.6}}>
                          <div style={{display: 'flex', flexDirection: 'column'}}>
                              <span style={{fontSize: '18px', fontWeight: '600', color: '#0f172a'}}>{med.name}</span>
                              <span style={{fontSize: '13px', color: '#64748b', marginTop: '4px'}}><i className="fa-regular fa-clock" style={{marginRight: '5px'}}></i> {med.time} &nbsp;|&nbsp; {med.units}</span>
                          </div>
                          {med.pending ? (
                              <div style={{display: 'flex', gap: '10px'}}>
                                  <button className="action-btn" style={{background: '#10b981', margin: 0}} onClick={() => {
                                      setMeds(meds.map(m => m.id===med.id?{...m,pending:false}:m));
                                      gainXp(30, "On-Time Medication Log");
                                  }}><i className="fa-solid fa-check"></i> Taken</button>
                                  <button className="action-btn" style={{background: '#ef4444', margin: 0}} onClick={() => handleSkipMed(med)}><i className="fa-solid fa-xmark"></i> Skip Dose</button>
                              </div>
                          ) : (
                              <span style={{fontWeight: '700', color: '#10b981'}}><i className="fa-solid fa-check-double"></i> Logged</span>
                          )}
                      </div>
                  ))}
              </div>

              {/* Interaction checker UI inside Meds */}
              <div style={{marginTop: '25px', padding: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'}}>
                  <button className="action-btn" style={{width: '100%', margin: 0, background: '#1e293b', display: 'flex', justifyContent: 'center', gap: '8px'}} onClick={checkPills}>
                      <i className="fa-solid fa-vial-circle-check" style={{color: '#60a5fa'}}></i> Run AI Pharmacological Interaction Check
                  </button>
                  {checkingInteractions && <div style={{textAlign:'center', padding:'20px', color:'#64748b', fontWeight:'500'}}><i className="fa-solid fa-circle-notch fa-spin text-blue-500" style={{marginRight:'8px'}}></i> Cross-referencing FDA Databases...</div>}
                  {interactionWarning && (
                      <div style={{marginTop: '15px', padding: '15px 20px', background: interactionWarning.type==='danger'?'#fef2f2':'#f0fdf4', borderRadius: '12px', borderLeft: `4px solid ${interactionWarning.type==='danger'?'#ef4444':'#22c55e'}`, fontWeight: '600', color: interactionWarning.type==='danger'?'#991b1b':'#166534', lineHeight: '1.5'}}>
                          <i className={`fa-solid ${interactionWarning.type==='danger'?'fa-triangle-exclamation':'fa-shield-halved'}`} style={{marginRight: '8px'}}></i> {interactionWarning.msg}
                      </div>
                  )}
              </div>
           </div>
        )}

        {activeTab === 'guardians' && (
           <div className="content-card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                  <h2><i className="fa-solid fa-shield-heart" style={{marginRight: '10px', color: '#8b5cf6'}}></i> Health Guardians</h2>
                  <span style={{background: '#f3e8ff', color: '#7c3aed', padding: '6px 15px', borderRadius: '20px', fontWeight: '600', fontSize: '13px'}}>Monitors your vital actions</span>
              </div>
              
              <div style={{display: 'flex', gap: '15px', marginBottom: '30px', padding: '20px', background: '#f8fafc', borderRadius: '12px'}}>
                  <input type="text" value={guardianName} onChange={e=>setGuardianName(e.target.value)} placeholder="Guardian Name" style={{flex: 1, padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1'}} />
                  <input type="email" value={guardianEmail} onChange={e=>setGuardianEmail(e.target.value)} placeholder="Email Address" style={{flex: 1, padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1'}} />
                  <button className="action-btn" style={{margin: 0, background: '#8b5cf6'}} onClick={() => {
                      if(guardianName && guardianEmail) {
                          setGuardians([...guardians, { id: Date.now(), name: guardianName, email: guardianEmail, active: true }]);
                          setGuardianName(''); setGuardianEmail('');
                          showToast("Guardian Added! They will receive health alerts automatically.");
                      }
                  }}><i className="fa-solid fa-user-plus"></i> Add Link</button>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                  {guardians.map(g => (
                      <div key={g.id} style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px'}}>
                          <div style={{width: 50, height: 50, borderRadius: '50%', background: '#ede9fe', color: '#8b5cf6', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px'}}>
                              <i className="fa-solid fa-user-shield"></i>
                          </div>
                          <div style={{flex: 1}}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                  <strong style={{fontSize: '16px', color: '#0f172a'}}>{g.name}</strong>
                                  <span style={{width: 8, height: 8, borderRadius: '50%', background: '#22c55e'}}></span>
                              </div>
                              <div style={{fontSize: '13px', color: '#64748b', marginTop: '2px'}}>{g.email}</div>
                          </div>
                      </div>
                  ))}
                  {guardians.length === 0 && <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No guardians linked yet.</p>}
              </div>
              
              {guardians.length > 0 && (
                  <div style={{marginTop: '30px', padding: '20px', background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '12px'}}>
                      <h4 style={{color: '#991b1b', marginBottom: '10px'}}><i className="fa-solid fa-truck-medical"></i> Emergency Actions</h4>
                      <button className="action-btn" style={{background: '#ef4444', width: '100%', display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '15px', padding: '12px', margin: 0}} onClick={startTelehealth}><i className="fa-solid fa-video"></i> Start SOS Telehealth Call</button>
                  </div>
              )}
           </div>
        )}

      </main>

      {/* Telehealth Overlay Modal */}
      {activeCall && (
        <div style={{position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(15,23,42,0.95)', zIndex: 9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
             <h2 style={{color: 'white', marginBottom: '30px', fontWeight: '400'}}><i className="fa-solid fa-satellite-dish fa-fade text-blue-500" style={{marginRight: '10px'}}></i> Encrypted Connection to Guardian Network...</h2>
             <video ref={videoRef} autoPlay playsInline muted style={{width: '800px', maxWidth: '90%', borderRadius: '16px', border: '4px solid #8b5cf6', boxShadow: '0 0 40px rgba(139,92,246,0.5)', background: '#000'}}></video>
             <button className="action-btn" onClick={endTelehealth} style={{background: '#ef4444', color: 'white', marginTop: '30px', padding: '15px 30px', fontSize: '18px', borderRadius: '50px'}}><i className="fa-solid fa-phone-slash"></i> End Secure Call</button>
        </div>
      )}
    </div>
  );
}

export default App;
