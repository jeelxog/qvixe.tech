import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken,
  signInAnonymously,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  orderBy,
  getDoc,
  increment,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { 
  Briefcase, User, MessageSquare, Shield, LogOut, Search, 
  CheckSquare, Clock, DollarSign, Lock, Star, Bell, 
  FileText, Upload, CreditCard, X, ChevronRight, Menu,
  Layout, Send, ExternalLink, AlertCircle, Sparkles, Database, RefreshCw, Settings, Mail, KeyRound, Loader2
} from 'lucide-react';

// --- 1. CONFIGURATION & SETUP ---

// In a real deployment, replace this with your Firebase Console config object
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  // Placeholders to prevent crash if config is missing locally
  apiKey: "demo-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo-project"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'qvixe-production-v1';

// Constants
const ROLES = { CREATOR: 'creator', BRAND: 'brand', ADMIN: 'admin' };
const STATUS = { 
  PENDING: 'pending', 
  APPROVED: 'approved', 
  REJECTED: 'rejected', 
  OPEN: 'open', 
  IN_PROGRESS: 'in_progress', 
  REVIEW: 'review', 
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};
const CATEGORIES = ['Design', 'Development', 'Writing', 'Video', 'Marketing', 'Other'];

// --- 2. UTILITIES & SERVICES ---

const formatCurrency = (amount) => `₹${Number(amount).toLocaleString('en-IN')}`;

const formatDate = (timestamp) => {
  if (!timestamp) return 'Just now';
  // Handle Firestore Timestamp or JS Date
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Gemini AI Service
const callGemini = async (prompt) => {
  const apiKey = ""; // Injected by environment at runtime. For production, use process.env.REACT_APP_GEMINI_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (!response.ok) throw new Error(`AI Error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI could not generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI service unavailable. Please try again later.";
  }
};

// Stackby Sync Service
const syncToStackby = async (project, config) => {
  const { apiKey, stackId, tableName } = config;
  const url = `https://stackby.com/api/v1/rowcreate/${stackId}/${tableName}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [{
          fields: {
            "Name": project.title,
            "Budget": Number(project.budget),
            "Status": project.status,
            "Client": project.brandName || "Unknown"
          }
        }]
      })
    });

    if (!response.ok) {
       const text = await response.text();
       throw new Error(`Stackby Sync Error: ${text}`);
    }
    return true;
  } catch (error) {
    console.error("Stackby Failed:", error);
    throw error;
  }
};

// --- 3. UI COMPONENTS (DESIGN SYSTEM) ---

const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, type = 'button', icon: Icon, loading = false }) => {
  const baseStyle = "font-bold uppercase tracking-wider transition-all border-2 border-black flex items-center justify-center gap-2 select-none active:scale-[0.98]";
  const sizes = { sm: "px-3 py-1 text-xs", md: "px-6 py-3 text-sm", lg: "px-8 py-4 text-base" };
  const variants = {
    primary: "bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-600 disabled:cursor-not-allowed",
    secondary: "bg-white text-black hover:bg-zinc-100 disabled:opacity-50",
    outline: "bg-transparent text-black hover:bg-zinc-50 border-black disabled:opacity-50",
    danger: "border-red-600 text-red-600 hover:bg-red-50",
    ai: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-none hover:shadow-lg"
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : (Icon && <Icon size={16} />)}
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false, area = false, icon: Icon, rightElement, className = "" }) => (
  <div className="mb-4 w-full">
    <div className="flex justify-between items-center mb-2">
      {label && <label className="block text-xs font-bold uppercase tracking-wide text-gray-800">{label}</label>}
      {rightElement}
    </div>
    <div className="relative group">
      {Icon && <Icon size={16} className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-black transition-colors" />}
      {area ? (
        <textarea
          value={value} onChange={onChange} placeholder={placeholder} required={required} rows={5}
          className={`w-full bg-white border-2 border-black p-3 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all font-mono text-sm resize-none ${className}`}
        />
      ) : (
        <input
          type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
          className={`w-full bg-white border-2 border-black p-3 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all font-mono text-sm ${Icon ? 'pl-10' : ''} ${className}`}
        />
      )}
    </div>
  </div>
);

const Card = ({ children, className = '', title, action }) => (
  <div className={`border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-300 ${className}`}>
    {(title || action) && (
      <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
        {title && <h3 className="font-bold text-lg uppercase tracking-tight">{title}</h3>}
        {action}
      </div>
    )}
    {children}
  </div>
);

const Badge = ({ children, color = 'default' }) => {
  const colors = {
    default: 'bg-gray-100 text-black',
    success: 'bg-green-100 text-green-800 border-green-800',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-800',
    danger: 'bg-red-100 text-red-800 border-red-800'
  };
  return <span className={`px-2 py-1 text-[10px] font-bold uppercase border ${colors[color] || colors.default}`}>{children}</span>;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border-2 border-black w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] animate-scale-up">
        <div className="flex justify-between items-center p-4 border-b-2 border-black bg-black text-white">
          <h3 className="font-bold uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform"><X size={20} /></button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// --- 4. FEATURE: AUTHENTICATION ---

const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState(ROLES.CREATOR);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // OTP Logic
  const [otpStep, setOtpStep] = useState(false);
  const [serverOtp, setServerOtp] = useState('');
  const [userOtp, setUserOtp] = useState('');
  const [simulatedEmail, setSimulatedEmail] = useState(null);

  const fillDemoAdmin = () => {
    setFormData({ email: 'admin@qvixe.com', password: 'admin', name: 'Demo Admin' });
    setIsLogin(true);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');

    try {
      // Step 1: Pre-Checks
      if (isLogin) {
        const q = query(usersRef, where('email', '==', formData.email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) throw new Error("Account not found. Please Sign Up.");
        if (snapshot.docs[0].data().password !== formData.password) throw new Error("Incorrect password.");
      } else {
        const q = query(usersRef, where('email', '==', formData.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) throw new Error("Email already used. Please Log In.");
      }

      // Step 2: Generate & Show OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setServerOtp(code);
      setOtpStep(true);
      setSimulatedEmail({ to: formData.email, code });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    if (userOtp !== serverOtp) {
      setError("Invalid Code. Check the popup.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Login: Fetch User
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', formData.email));
        const snapshot = await getDocs(q);
        onLogin(snapshot.docs[0].data());
      } else {
        // Signup: Create User
        const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const derivedRole = formData.email.includes('admin') ? ROLES.ADMIN : role;
        
        const newUser = {
          uid: newUserId,
          name: formData.name,
          email: formData.email,
          password: formData.password, // In real apps, HASH THIS
          role: derivedRole,
          status: derivedRole === ROLES.CREATOR ? STATUS.PENDING : STATUS.APPROVED, // Creators need approval, Brands/Admins dont
          createdAt: serverTimestamp(),
          bio: '', skills: [], portfolio: [],
          wallet: { balance: 0, escrow: 0, totalEarned: 0 },
          rating: 0, reviewCount: 0
        };

        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', newUserId), newUser);
        onLogin(newUser);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4 font-sans text-black relative">
      
      {/* Simulated Email Toast */}
      {simulatedEmail && (
        <div className="fixed top-4 right-4 z-50 animate-bounce-in">
          <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-xs">
            <div className="flex justify-between items-center mb-2 border-b pb-2">
              <span className="font-bold text-xs uppercase flex items-center gap-2"><Mail size={14}/> New Message</span>
              <button onClick={() => setSimulatedEmail(null)}><X size={14}/></button>
            </div>
            <p className="text-xs text-gray-500">Subject: Verification Code</p>
            <div className="text-3xl font-black text-center my-3 tracking-widest bg-gray-50 py-2 border-2 border-dashed border-gray-300">
              {simulatedEmail.code}
            </div>
            <p className="text-[10px] text-center text-gray-400">System Notification</p>
          </div>
        </div>
      )}

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-7xl font-black tracking-tighter mb-2">QVIXE</h1>
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-gray-500">Premium Freelance Network</p>
        </div>

        <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          {!otpStep ? (
            <>
              <div className="flex mb-8 border-2 border-black">
                <button onClick={() => { setIsLogin(true); setError(''); }} className={`flex-1 py-3 text-xs font-bold uppercase ${isLogin ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}>Log In</button>
                <button onClick={() => { setIsLogin(false); setError(''); }} className={`flex-1 py-3 text-xs font-bold uppercase ${!isLogin ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}>Sign Up</button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <>
                    <Input label="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {[ROLES.CREATOR, ROLES.BRAND].map(r => (
                        <div key={r} onClick={() => setRole(r)} className={`cursor-pointer border-2 p-3 text-center text-xs font-bold uppercase transition-all ${role === r ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-400 hover:border-black'}`}>
                          {r}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Input label="Email" type="email" icon={Mail} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                <Input label="Password" type="password" icon={Lock} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
                
                {error && <div className="text-red-600 text-xs font-bold border border-red-600 p-3 bg-red-50 flex items-center gap-2"><AlertCircle size={14}/> {error}</div>}
                
                <Button type="submit" className="w-full" loading={loading} variant="primary">
                  {isLogin ? 'Secure Login' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-dashed border-gray-300 text-center">
                <p className="text-xs text-gray-400 mb-2">Platform Testing Tools</p>
                <button onClick={fillDemoAdmin} className="text-xs font-bold underline hover:text-purple-600">Auto-Fill Demo Admin</button>
              </div>
            </>
          ) : (
            <form onSubmit={verifyOtp} className="text-center animate-fade-in">
              <div className="flex justify-center mb-4"><div className="bg-black text-white p-3 rounded-full"><KeyRound size={24}/></div></div>
              <h3 className="font-bold text-lg mb-2">Two-Factor Auth</h3>
              <p className="text-sm text-gray-600 mb-6">Enter the code sent to <strong>{formData.email}</strong></p>
              
              <Input label="OTP Code" value={userOtp} onChange={e => setUserOtp(e.target.value)} required placeholder="000000" className="text-center text-xl tracking-[0.5em] font-black" />
              
              {error && <div className="text-red-600 text-xs font-bold mb-4">{error}</div>}
              
              <Button type="submit" className="w-full" loading={loading}>Verify & Enter</Button>
              <button type="button" onClick={() => setOtpStep(false)} className="text-xs text-gray-400 mt-4 hover:underline">Cancel Verification</button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

// --- 5. MAIN DASHBOARD ---

const Dashboard = ({ user, onLogout }) => {
  const [view, setView] = useState('projects');
  const [userProfile, setUserProfile] = useState(user); // Real-time profile data
  const [activeChat, setActiveChat] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Real-time listener for user profile (to detect status changes like approval)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (doc) => {
      if (doc.exists()) setUserProfile(doc.data());
    });
    return () => unsub();
  }, [user.uid]);

  // Notifications Listener
  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(data);
    });
    return () => unsub();
  }, [user.uid]);

  const markRead = async (id) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', id), { read: true });
  };

  const NavItem = ({ id, icon: Icon, label, count }) => (
    <button onClick={() => { setView(id); setActiveChat(null); }} className={`flex items-center justify-between w-full p-4 text-xs font-bold uppercase transition-colors border-b border-gray-100 ${view === id ? 'bg-black text-white border-black' : 'hover:bg-gray-100 text-gray-600'}`}>
      <div className="flex items-center gap-3"><Icon size={16} />{label}</div>
      {count > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden font-sans text-black">
      <aside className="w-64 bg-white border-r-2 border-black flex flex-col z-20">
        <div className="p-6 border-b-2 border-black">
          <h2 className="text-2xl font-black tracking-tighter">QVIXE</h2>
          <div className="mt-2 flex items-center gap-2 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${userProfile?.status === STATUS.APPROVED ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="uppercase">{userProfile?.role}</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto">
          {userProfile?.role === ROLES.ADMIN ? (
            <>
              <NavItem id="admin_dash" icon={Layout} label="Overview" />
              <NavItem id="admin_users" icon={User} label="Approvals" />
              <NavItem id="admin_integrations" icon={Database} label="Integrations" />
            </>
          ) : (
            <>
              <NavItem id="projects" icon={Search} label={userProfile?.role === ROLES.BRAND ? "My Projects" : "Find Work"} />
              <NavItem id="workspace" icon={Briefcase} label="Workspace" />
              <NavItem id="messages" icon={MessageSquare} label="Messages" />
              <NavItem id="wallet" icon={CreditCard} label="Wallet" />
              <NavItem id="profile" icon={User} label="Profile" />
            </>
          )}
        </nav>

        <div className="p-4 border-t-2 border-black bg-gray-50">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-xs rounded-sm">
                {userProfile?.name?.charAt(0)}
             </div>
             <div className="overflow-hidden">
               <p className="text-xs font-bold truncate">{userProfile?.name}</p>
               <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
             </div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout} className="w-full text-xs"><LogOut size={12} /> Sign Out</Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b-2 border-black flex justify-between items-center px-6 shrink-0">
          <h1 className="text-lg font-black uppercase tracking-wide">{view.replace(/_/g, ' ')}</h1>
          <div className="flex items-center gap-4">
             {userProfile?.role === ROLES.CREATOR && (
                <div className="hidden md:flex items-center gap-1 text-xs font-bold border border-black px-3 py-1 bg-yellow-400">
                  <Star size={12} fill="black" /> {userProfile?.rating?.toFixed(1) || 'NEW'}
                </div>
             )}
             <div className="relative group cursor-pointer">
                <Bell size={20} className={notifications.some(n => !n.read) ? 'text-black' : 'text-gray-400'} />
                {notifications.some(n => !n.read) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                <div className="absolute right-0 top-8 w-72 bg-white border-2 border-black shadow-lg hidden group-hover:block max-h-60 overflow-y-auto z-50">
                   {notifications.length === 0 ? <div className="p-4 text-xs text-gray-400 text-center">No new notifications</div> : 
                    notifications.map(n => (
                      <div key={n.id} onClick={() => markRead(n.id)} className={`p-3 border-b border-gray-100 text-xs hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50' : ''}`}>
                         {n.message}
                      </div>
                    ))
                   }
                </div>
             </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
           {userProfile?.status === STATUS.PENDING && userProfile?.role === ROLES.CREATOR ? (
             <div className="flex h-full items-center justify-center">
               <Card className="max-w-xl text-center py-12">
                 <Lock size={48} className="mx-auto mb-6 text-gray-300" />
                 <h2 className="text-2xl font-black uppercase mb-2">Access Restricted</h2>
                 <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                   Your Creator profile is currently under review by our administrators. 
                   <br/>Approval typically takes 24 hours.
                 </p>
                 <div className="bg-gray-100 p-3 text-xs font-mono inline-block border border-gray-200">Ref ID: {user.uid.slice(0,8)}</div>
                 <div className="mt-6 text-xs text-gray-400">Tip: Ask an Admin (admin@qvixe.com) to approve you.</div>
               </Card>
             </div>
           ) : (
             <>
               {view === 'projects' && (userProfile?.role === ROLES.BRAND ? <BrandManager user={user} /> : <Marketplace user={user} userProfile={userProfile} />)}
               {view === 'workspace' && <Workspace user={user} userProfile={userProfile} setActiveChat={setActiveChat} setView={setView} />}
               {view === 'messages' && <ChatSystem user={user} activeChat={activeChat} setActiveChat={setActiveChat} />}
               {view === 'wallet' && <Wallet user={user} userProfile={userProfile} />}
               {view === 'profile' && <ProfileManager user={user} userProfile={userProfile} />}
               {view === 'admin_users' && <AdminUserList />}
               {view === 'admin_dash' && <AdminOverview user={user} />}
               {view === 'admin_integrations' && <AdminIntegrations user={user} />}
             </>
           )}
        </div>
      </main>
    </div>
  );
};

// --- 6. FEATURE MODULES ---

const AdminUserList = () => {
   const [users, setUsers] = useState([]);
   useEffect(() => {
     const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('status', '==', STATUS.PENDING));
     return onSnapshot(q, snap => setUsers(snap.docs.map(d => ({id: d.id, ...d.data()}))));
   }, []);
   
   const approve = async (uid) => {
     await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid), {status: STATUS.APPROVED});
   };

   return (
     <Card title="Pending Approvals">
       {users.length === 0 ? <p className="text-gray-400 text-sm">No pending users found.</p> : users.map(u => (
         <div key={u.id} className="flex justify-between items-center border-b p-3 last:border-0 hover:bg-gray-50">
            <div>
              <div className="font-bold">{u.name}</div>
              <div className="text-xs text-gray-500">{u.email} • {u.role}</div>
            </div>
            <Button size="sm" variant="success" onClick={() => approve(u.id)}>Approve Access</Button>
         </div>
       ))}
     </Card>
   );
};

const AdminIntegrations = ({ user }) => {
  const [config, setConfig] = useState({ apiKey: 'NBQriCjinvzmPSlC', stackId: 'e23a55572c1134c5', tableName: 'Projects' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'integrations', 'stackby')).then(snap => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'integrations', 'stackby'), config);
    setSaving(false);
  };

  return (
    <div className="max-w-2xl">
      <Card title="Database Connections">
        <div className="mb-6 bg-indigo-50 border border-indigo-200 p-4 rounded text-sm text-indigo-900">
           <h4 className="font-bold flex items-center gap-2 mb-2"><Database size={14} /> Stackby Integration Active</h4>
           <p className="mb-2">Projects will sync to your external database automatically.</p>
        </div>
        <div className="space-y-4">
           <Input label="Stackby API Key" type="password" value={config.apiKey} onChange={e => setConfig({...config, apiKey: e.target.value})} />
           <Input label="Stack ID" value={config.stackId} onChange={e => setConfig({...config, stackId: e.target.value})} />
           <Input label="Table Name" value={config.tableName} onChange={e => setConfig({...config, tableName: e.target.value})} />
           <Button onClick={saveConfig} loading={saving}>Save Configuration</Button>
        </div>
      </Card>
    </div>
  );
};

const AdminOverview = ({ user }) => {
  const [stats, setStats] = useState({ users: 0, projects: 0 });
  const [projects, setProjects] = useState([]);
  const [stackbyConfig, setStackbyConfig] = useState(null);
  const [syncStatus, setSyncStatus] = useState({});

  useEffect(() => {
    const qUsers = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
    const qProjects = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'));

    getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'integrations', 'stackby')).then(snap => {
       if(snap.exists()) setStackbyConfig(snap.data());
    });

    onSnapshot(qUsers, s => setStats(prev => ({...prev, users: s.size})));
    onSnapshot(qProjects, s => {
      setStats(prev => ({...prev, projects: s.size}));
      setProjects(s.docs.map(d => ({id: d.id, ...d.data()})));
    });
  }, []);

  const handleSync = async (project) => {
    if (!stackbyConfig || !stackbyConfig.apiKey) return alert("Please configure Integrations first.");
    setSyncStatus(prev => ({...prev, [project.id]: 'loading'}));
    try {
      await syncToStackby(project, stackbyConfig);
      setSyncStatus(prev => ({...prev, [project.id]: 'success'}));
    } catch (err) {
      console.error(err);
      setSyncStatus(prev => ({...prev, [project.id]: 'error'}));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-black text-white h-32 flex flex-col items-center justify-center">
          <span className="text-4xl font-black">{stats.users}</span>
          <span className="text-xs uppercase opacity-70">Total Users</span>
        </Card>
        <Card className="h-32 flex flex-col items-center justify-center">
           <span className="text-4xl font-black">{stats.projects}</span>
           <span className="text-xs uppercase opacity-70">Total Projects</span>
        </Card>
      </div>

      <Card title="Live Project Monitor">
        <div className="overflow-x-auto">
           <table className="w-full text-left text-sm">
             <thead className="bg-gray-100 uppercase text-xs font-bold">
               <tr><th className="p-3">Project</th><th className="p-3">Brand</th><th className="p-3">Budget</th><th className="p-3">External Sync</th></tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {projects.map(p => (
                 <tr key={p.id} className="hover:bg-gray-50">
                   <td className="p-3 font-medium">{p.title}</td>
                   <td className="p-3 text-gray-500">{p.brandName}</td>
                   <td className="p-3">{formatCurrency(p.budget)}</td>
                   <td className="p-3">
                      {syncStatus[p.id] === 'success' ? (
                        <span className="text-green-600 font-bold text-xs flex items-center gap-1"><CheckSquare size={12}/> Synced</span>
                      ) : (
                        <Button variant="stackby" size="sm" className="text-[10px] py-1 px-2 h-8" onClick={() => handleSync(p)} loading={syncStatus[p.id] === 'loading'}>
                           Sync Database
                        </Button>
                      )}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </Card>
    </div>
  );
};

const BrandManager = ({ user }) => {
  const [projects, setProjects] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', budget: '', category: 'Other' });
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), where('brandId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjects(data);
    });
  }, [user]);

  const handlePost = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), { ...newProject, brandId: user.uid, brandName: user.name, status: STATUS.OPEN, createdAt: serverTimestamp() });
    setIsPosting(false);
    setNewProject({ title: '', description: '', budget: '', category: 'Other' });
  };

  const generateDescription = async () => {
    if (!newProject.title) return;
    setAiLoading(true);
    const text = await callGemini(`Write a concise project description for: ${newProject.title}. Budget: ${newProject.budget}.`);
    setNewProject({...newProject, description: text});
    setAiLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold uppercase">Your Projects</h2><Button onClick={() => setIsPosting(true)}>Post New Project</Button></div>
      {isPosting && (
        <Card className="mb-8 border-black shadow-lg">
          <form onSubmit={handlePost}>
            <div className="grid gap-4">
              <Input label="Title" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                 <Input label="Budget (INR)" type="number" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} required />
                 <div className="mb-4"><label className="block text-xs font-bold uppercase mb-2">Category</label><select className="w-full p-3 border-2 border-black focus:outline-none" value={newProject.category} onChange={e => setNewProject({...newProject, category: e.target.value})}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <Input label="Description" area value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} required rightElement={<button type="button" onClick={generateDescription} disabled={aiLoading || !newProject.title} className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:text-purple-800 disabled:opacity-50"><Sparkles size={12} /> {aiLoading ? 'Enhancing...' : 'AI Enhance'}</button>} />
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsPosting(false)}>Cancel</Button><Button type="submit">Launch Project</Button></div>
            </div>
          </form>
        </Card>
      )}
      <div className="space-y-4">{projects.map(p => <ProjectApplicants key={p.id} project={p} />)}</div>
    </div>
  );
};

const ProjectApplicants = ({ project }) => {
  const [proposals, setProposals] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'proposals'), where('projectId', '==', project.id));
    return onSnapshot(q, snap => setProposals(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [isOpen, project.id]);

  const hire = async (proposal) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id), { status: STATUS.IN_PROGRESS, assignedTo: proposal.creatorId, creatorName: proposal.creatorName });
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'proposals', proposal.id), { status: STATUS.APPROVED });
    
    // Create Chat
    const chatRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'));
    batch.set(chatRef, { participants: [project.brandId, proposal.creatorId], projectId: project.id, projectTitle: project.title, lastMessage: 'Project started!', updatedAt: serverTimestamp() });
    
    // Notification
    const notifRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'));
    batch.set(notifRef, { userId: proposal.creatorId, message: `Hired for ${project.title}`, read: false, createdAt: serverTimestamp() });

    await batch.commit();
  };

  return (
    <Card className="py-4">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
         <div><h4 className="font-bold">{project.title}</h4><div className="text-xs text-gray-500 mt-1 flex gap-2"><span>{formatCurrency(project.budget)}</span><span>•</span><Badge>{project.status}</Badge></div></div>
         <ChevronRight className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
           <h5 className="text-xs font-bold uppercase mb-3">Applications</h5>
           {proposals.length === 0 ? <p className="text-sm text-gray-400">No applicants yet.</p> : (
             <div className="space-y-3">{proposals.map(prop => (
                 <div key={prop.id} className="flex flex-col bg-gray-50 p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-xs rounded-full">{prop.creatorName[0]}</div>
                          <div><div className="font-bold text-sm">{prop.creatorName}</div><div className="text-xs flex items-center gap-1"><Star size={10} /> {prop.creatorRating ? prop.creatorRating.toFixed(1) : 'New'}</div></div>
                        </div>
                        {project.status === STATUS.OPEN && <Button size="sm" onClick={() => hire(prop)}>Hire</Button>}
                    </div>
                    <div className="text-xs text-gray-600 bg-white p-3 border border-gray-100 italic">"{prop.pitch || "No specific pitch provided."}"</div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}
    </Card>
  );
};

const Marketplace = ({ user, userProfile }) => {
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState({ category: 'All', search: '' });
  const [applyModal, setApplyModal] = useState(null); 
  const [pitch, setPitch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'));
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjects(all.filter(p => p.status === STATUS.OPEN));
    });
    return () => unsub();
  }, []);

  const filtered = projects.filter(p => {
    const matchCat = filter.category === 'All' || p.category === filter.category;
    const matchSearch = p.title.toLowerCase().includes(filter.search.toLowerCase());
    return matchCat && matchSearch;
  });

  const generatePitch = async () => {
    if (!applyModal) return;
    setAiLoading(true);
    const prompt = `Write a short, professional freelance proposal for a project titled '${applyModal.title}'. Requirements: '${applyModal.description}'. My Role: ${userProfile.role}. Keep it under 100 words, persuasive.`;
    const text = await callGemini(prompt);
    setPitch(text);
    setAiLoading(false);
  };

  const submitApplication = async () => {
    if(!user || !applyModal) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'proposals'), {
      projectId: applyModal.id,
      projectTitle: applyModal.title,
      creatorId: user.uid,
      creatorName: userProfile.name,
      creatorRating: userProfile.rating || 0,
      brandId: applyModal.brandId,
      status: STATUS.PENDING,
      budget: applyModal.budget,
      pitch: pitch,
      createdAt: serverTimestamp()
    });
    setApplyModal(null);
    setPitch('');
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
           <Search className="absolute left-3 top-3.5 text-gray-400" size={16} />
           <input className="w-full pl-10 pr-4 py-3 border-2 border-black focus:outline-none focus:ring-4 focus:ring-gray-200" placeholder="Search projects..." value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})} />
        </div>
        <select className="p-3 border-2 border-black bg-white focus:outline-none font-bold text-sm" value={filter.category} onChange={e => setFilter({...filter, category: e.target.value})}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="hover:shadow-lg transition-all flex flex-col md:flex-row justify-between gap-4">
            <div>
              <div className="flex gap-2 mb-2"><Badge>{p.category}</Badge><span className="text-xs text-gray-400 font-mono uppercase pt-1">{formatDate(p.createdAt)}</span></div>
              <h3 className="font-bold text-lg">{p.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mt-1 max-w-2xl">{p.description}</p>
            </div>
            <div className="flex flex-col items-end justify-between min-w-[150px]">
              <div className="text-lg font-black">{formatCurrency(p.budget)}</div>
              <Button size="sm" onClick={() => setApplyModal(p)}>Apply Now</Button>
            </div>
          </Card>
        ))}
      </div>
      <Modal isOpen={!!applyModal} onClose={() => setApplyModal(null)} title={`Apply to ${applyModal?.title}`}>
         <Input area label="Your Pitch" value={pitch} onChange={e => setPitch(e.target.value)} rightElement={<button onClick={generatePitch} disabled={aiLoading} className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:text-purple-800 disabled:opacity-50"><Sparkles size={12} /> {aiLoading ? 'Generating...' : 'Auto-Write Pitch'}</button>} />
         <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setApplyModal(null)}>Cancel</Button>
            <Button onClick={submitApplication} disabled={!pitch.trim()}>Submit Proposal</Button>
         </div>
      </Modal>
    </div>
  );
};

const Workspace = ({ user, userProfile, setActiveChat, setView }) => {
  const [activeProjects, setActiveProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [deliverableLink, setDeliverableLink] = useState('');

  const isBrand = userProfile.role === ROLES.BRAND;

  useEffect(() => {
    const field = isBrand ? 'brandId' : 'assignedTo';
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), where(field, '==', user.uid));
    return onSnapshot(q, snap => {
      const allData = snap.docs.map(d => ({id: d.id, ...d.data()}));
      setActiveProjects(allData.filter(p => [STATUS.IN_PROGRESS, STATUS.REVIEW, STATUS.COMPLETED].includes(p.status)));
    });
  }, [user, isBrand]);

  const submitWork = async () => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', selectedProject.id), { status: STATUS.REVIEW, deliverables: [{ link: deliverableLink, submittedAt: new Date().toISOString() }] });
    setSelectedProject(null);
  };

  const approveWork = async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'projects', selectedProject.id), { status: STATUS.COMPLETED, completedAt: serverTimestamp() });
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'users', selectedProject.assignedTo), { "wallet.balance": increment(Number(selectedProject.budget)), "wallet.totalEarned": increment(Number(selectedProject.budget)) });
    await batch.commit();
    setSelectedProject(null);
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeProjects.map(project => (
          <Card key={project.id} className="relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-2"><Badge color={project.status === STATUS.COMPLETED ? 'success' : 'warning'}>{project.status}</Badge></div>
             <h3 className="font-bold text-lg mb-1">{project.title}</h3>
             <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setView('messages')}><MessageSquare size={14} /> Chat</Button>
                {project.status === STATUS.IN_PROGRESS && !isBrand && <Button size="sm" onClick={() => setSelectedProject(project)}>Submit</Button>}
                {project.status === STATUS.REVIEW && isBrand && <Button size="sm" variant="primary" onClick={() => setSelectedProject(project)}>Review</Button>}
             </div>
          </Card>
        ))}
      </div>
      <Modal isOpen={!!selectedProject} onClose={() => setSelectedProject(null)} title="Manage Project">
        {isBrand ? <div className="text-center"><p className="mb-4">Approve work?</p><Button onClick={approveWork}>Approve & Release Payment</Button></div> : 
        <div><Input label="Work Link" value={deliverableLink} onChange={e => setDeliverableLink(e.target.value)} /><Button onClick={submitWork} className="w-full">Submit</Button></div>}
      </Modal>
    </div>
  );
};

const Wallet = ({ user, userProfile }) => {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    const field = userProfile.role === ROLES.BRAND ? 'brandId' : 'assignedTo';
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), where(field, '==', user.uid));
    return onSnapshot(q, snap => setHistory(snap.docs.map(d => ({id: d.id, ...d.data()})).filter(p => p.status === STATUS.COMPLETED)));
  }, [user, userProfile]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-black text-white border-none"><div className="text-gray-400 text-xs uppercase font-bold mb-1">Available Balance</div><div className="text-4xl font-black">{formatCurrency(userProfile.wallet?.balance || 0)}</div></Card>
      </div>
      <Card title="Transaction History">
        {history.length === 0 ? <p className="text-gray-400 text-sm">No transactions yet.</p> : 
        <div className="space-y-2">{history.map(tx => <div key={tx.id} className="flex justify-between border-b pb-2"><span className="font-bold">{tx.title}</span><span className="text-green-600">+{formatCurrency(tx.budget)}</span></div>)}</div>
        }
      </Card>
    </div>
  );
};

const ProfileManager = ({ user, userProfile }) => {
  const [data, setData] = useState(userProfile);
  const [editing, setEditing] = useState(false);
  const save = async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), data); setEditing(false); };
  return (
    <Card title="Profile Settings">
      <div className="flex justify-between mb-4"><h2 className="text-2xl font-bold">{data.name}</h2><Button size="sm" variant="outline" onClick={() => editing ? save() : setEditing(true)}>{editing ? 'Save Changes' : 'Edit Profile'}</Button></div>
      {editing ? <Input area value={data.bio} onChange={e => setData({...data, bio: e.target.value})} placeholder="Tell us about yourself..." /> : <p className="text-gray-600">{data.bio || "No bio set."}</p>}
    </Card>
  );
};

const ChatSystem = ({ user, activeChat, setActiveChat }) => {
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), where('participants', 'array-contains', user.uid));
    return onSnapshot(q, snap => setChats(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [user]);

  useEffect(() => {
    if(!activeChat) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', `chats/${activeChat.id}/messages`), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({id: d.id, ...d.data()})));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [activeChat]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `chats/${activeChat.id}/messages`), { text, senderId: user.uid, createdAt: serverTimestamp() });
    setText('');
  };

  return (
    <div className="flex h-[600px] border-2 border-black bg-white shadow-lg">
      <div className="w-1/3 border-r-2 border-black overflow-y-auto bg-gray-50">
        {chats.map(c => (
          <div key={c.id} onClick={() => setActiveChat(c)} className={`p-4 border-b hover:bg-white cursor-pointer transition-colors ${activeChat?.id === c.id ? 'bg-white border-l-4 border-black' : ''}`}>
            <div className="font-bold text-sm truncate">{c.projectTitle}</div>
            <div className="text-xs text-gray-500 truncate">{c.lastMessage}</div>
          </div>
        ))}
      </div>
      <div className="w-2/3 flex flex-col">
        {activeChat ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                  <span className={`p-3 text-sm max-w-[70%] ${m.senderId === user.uid ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
                    {m.text}
                  </span>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={send} className="p-3 border-t-2 border-black flex gap-2">
              <input className="flex-1 bg-gray-50 border-2 border-gray-200 p-2 focus:border-black outline-none transition-colors" value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." />
              <Button type="submit" size="sm"><Send size={16} /></Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={48} className="mb-2 opacity-20" />
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 7. MAIN ENTRY POINT ---

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // 1. Silent connect to Firebase
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Firebase Connection Error", e); }

      // 2. Restore Session
      const savedUserId = localStorage.getItem('qvixe_user_id');
      if (savedUserId) {
        try {
          const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', savedUserId));
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data());
          } else {
            localStorage.removeItem('qvixe_user_id'); 
          }
        } catch (e) { console.error("Session Restore Error", e); }
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleLogin = (userObj) => {
    setCurrentUser(userObj);
    localStorage.setItem('qvixe_user_id', userObj.uid);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('qvixe_user_id');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-50 font-black tracking-widest animate-pulse">LOADING QVIXE...</div>;

  return currentUser ? 
    <Dashboard user={currentUser} onLogout={handleLogout} /> : 
    <AuthScreen onLogin={handleLogin} />;
}