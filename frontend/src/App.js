import { useEffect, useState } from "react";
import { CalendarPlus, Check, LogOut, MapPin, Users } from "lucide-react";
import api, { setToken } from "./api";

const TAGS = ["Coding", "Hackathons", "Robotics", "Design", "Cultural", "Music", "Sports", "Entrepreneurship"];
const field = "w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm";
const btn = "h-11 px-5 rounded-xl font-semibold text-sm transition";
const primary = `${btn} bg-accent text-white hover:brightness-110 disabled:opacity-40`;
const ghost = `${btn} border border-white/15 bg-white/5 hover:border-white/40`;

const poster = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 65% 34%), hsl(${(h + 70) % 360} 60% 14%))`;
};

function useCountdown(deadline) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(deadline) - now;
  if (ms <= 0) return { text: "Closed", closed: true };
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24;
  const m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  return { text: d ? `${d}d ${h}h ${m}m left` : `${h}h ${m}m ${s}s left`, urgent: ms < 864e5 };
}

function TagPicker({ value, onChange }) {
  const toggle = (t) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map((t) => (
        <button type="button" key={t} onClick={() => toggle(t)}
          className={`h-9 px-3 rounded-full text-xs border ${value.includes(t) ? "bg-accent border-accent" : "border-white/15 bg-white/5"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "student", club: "", interests: [] });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (ev) => {
    ev.preventDefault();
    setErr("");
    try {
      const { data } = await api.post(`/auth/${mode}`, f);
      setToken(data.token);
      onAuth(data.user);
    } catch (e) {
      setErr(e.response?.data?.detail || "Could not reach the server");
    }
  };
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-6 space-y-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Campus Pulse</h1>
        <p className="text-slate-400 text-sm">Every event on campus, with the deadline front and center.</p>
        {mode === "register" && (
          <>
            <input className={field} placeholder="Full name" value={f.name} onChange={set("name")} required />
            <select className={field} value={f.role} onChange={set("role")}>
              <option value="student">Student</option>
              <option value="organizer">Club organizer</option>
            </select>
            {f.role === "organizer" ? (
              <input className={field} placeholder="Club name" value={f.club} onChange={set("club")} required />
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">What are you into?</p>
                <TagPicker value={f.interests} onChange={(interests) => setF({ ...f, interests })} />
              </div>
            )}
          </>
        )}
        <input className={field} type="email" placeholder="you@nitt.edu" value={f.email} onChange={set("email")} required />
        <input className={field} type="password" placeholder="Password" value={f.password} onChange={set("password")} required />
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className={`${primary} w-full`}>{mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="text-sm text-slate-400 underline min-h-[44px]"
          onClick={() => { setErr(""); setMode(mode === "login" ? "register" : "login"); }}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}

function EventCard({ e, onRsvp, wide }) {
  const cd = useCountdown(e.deadline);
  const t = new Date(e.deadline).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const cal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&details=${encodeURIComponent("Hosted by " + e.club)}&location=${encodeURIComponent(e.venue)}&dates=${t}/${t}`;
  return (
    <article className={`bg-card border border-white/10 rounded-2xl overflow-hidden ${wide ? "min-w-[280px] snap-start" : ""}`}>
      <div className="aspect-[4/3] p-4 flex flex-col justify-between" style={{ background: poster(e.title) }}>
        <span className={`tabular self-end text-xs font-bold px-3 py-1 rounded-full ${cd.closed ? "bg-slate-700" : cd.urgent ? "bg-accent" : "bg-black/50"}`}>{cd.text}</span>
        <h3 className="font-display text-2xl font-bold leading-tight">{e.title}</h3>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-400">Hosted by <span className="text-slate-100 font-semibold">{e.club}</span></p>
        <p className="text-sm text-slate-300">{e.description}</p>
        <p className="text-sm text-slate-400 flex items-center gap-1"><MapPin size={14} /> {e.venue}</p>
        <div className="flex flex-wrap gap-1.5">
          {e.tags.map((t) => <span key={t} className="text-xs px-2 py-1 rounded-full bg-white/10">{t}</span>)}
        </div>
        <div className="flex gap-2 items-center">
          <button disabled={cd.closed} onClick={() => onRsvp(e.id)} className={`${e.going ? ghost : primary} flex-1 flex items-center justify-center gap-2`}>
            {e.going ? <><Check size={16} /> You're going</> : "RSVP"}
          </button>
          <a href={cal} target="_blank" rel="noreferrer" aria-label="Add to Google Calendar" className={`${ghost} grid place-items-center px-3`}><CalendarPlus size={18} /></a>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1"><Users size={12} /> {e.rsvp_count} going</p>
      </div>
    </article>
  );
}

function Dashboard({ onCreated }) {
  const blank = { title: "", description: "", venue: "", deadline: "", tags: [] };
  const [stats, setStats] = useState([]);
  const [f, setF] = useState(blank);
  const load = () => api.get("/dashboard").then((r) => setStats(r.data));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (ev) => {
    ev.preventDefault();
    await api.post("/events", { ...f, deadline: new Date(f.deadline).toISOString() });
    setF(blank);
    load();
    onCreated();
  };
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Your events</h2>
        {stats.length === 0 && <p className="text-slate-400 text-sm">Nothing posted yet. Add your first event.</p>}
        {stats.map((s) => (
          <div key={s.id} className="bg-card border border-white/10 rounded-2xl p-4">
            <p className="font-semibold">{s.title}</p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center tabular">
              <div><p className="text-2xl font-display font-bold">{s.reach}</p><p className="text-xs text-slate-400">Students reached</p></div>
              <div><p className="text-2xl font-display font-bold">{s.signups}</p><p className="text-xs text-slate-400">Sign-ups</p></div>
              <div><p className="text-2xl font-display font-bold">{s.reach ? Math.round((s.signups / s.reach) * 100) : 0}%</p><p className="text-xs text-slate-400">Conversion</p></div>
            </div>
          </div>
        ))}
      </section>
      <form onSubmit={submit} className="bg-card border border-white/10 rounded-2xl p-5 space-y-3 h-fit">
        <h2 className="font-display text-2xl font-bold">Post an event</h2>
        <input className={field} placeholder="Title" value={f.title} onChange={set("title")} required />
        <textarea className={`${field} h-24 py-2`} placeholder="What's happening?" value={f.description} onChange={set("description")} required />
        <input className={field} placeholder="Venue" value={f.venue} onChange={set("venue")} required />
        <label className="block text-sm text-slate-400">Registration deadline
          <input className={`${field} mt-1`} type="datetime-local" value={f.deadline} onChange={set("deadline")} required />
        </label>
        <TagPicker value={f.tags} onChange={(tags) => setF({ ...f, tags })} />
        <button className={`${primary} w-full`}>Publish event</button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("feed");
  const [tag, setTag] = useState("All");

  useEffect(() => {
    if (!localStorage.getItem("cp_token")) return setReady(true);
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const load = () => api.get("/events").then((r) => setEvents(r.data));
  useEffect(() => { if (user) load(); }, [user]);

  const rsvp = async (id) => {
    const { data } = await api.post(`/events/${id}/rsvp`);
    setEvents((es) => es.map((x) => (x.id === id ? data : x)));
  };
  const logout = () => { setToken(null); setUser(null); setEvents([]); };

  if (!ready) return null;
  if (!user) return <Auth onAuth={setUser} />;

  const byDeadline = (a, b) => new Date(a.deadline) - new Date(b.deadline);
  const open = events.filter((e) => new Date(e.deadline) > Date.now()).sort(byDeadline);
  const closed = events.filter((e) => new Date(e.deadline) <= Date.now());
  const score = (e) => e.tags.filter((t) => user.interests?.includes(t)).length;
  const picks = [...open].sort((a, b) => score(b) - score(a) || byDeadline(a, b)).slice(0, 5);
  const feed = [...open, ...closed].filter((e) => tag === "All" || e.tags.includes(tag));
  const isOrg = user.role !== "student";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <header className="sticky top-0 z-10 bg-page/90 backdrop-blur flex items-center justify-between py-4">
        <span className="font-display text-2xl font-extrabold tracking-tight">Campus Pulse</span>
        <div className="flex items-center gap-2">
          {isOrg && (
            <div className="flex gap-1">
              {["feed", "dashboard"].map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`${btn} ${tab === t ? "bg-accent" : "bg-white/5"} capitalize`}>{t}</button>
              ))}
            </div>
          )}
          <button onClick={logout} aria-label="Sign out" className={`${ghost} grid place-items-center px-3`}><LogOut size={18} /></button>
        </div>
      </header>

      {tab === "dashboard" && isOrg ? (
        <Dashboard onCreated={load} />
      ) : (
        <>
          <section className="mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-1">Closing soon, picked for you</h2>
            <p className="text-sm text-slate-400 mb-4">Hi {user.name.split(" ")[0]}. These match your interests and are running out of time.</p>
            {picks.length === 0 ? <p className="text-slate-400">No open events right now.</p> : (
              <div className="flex gap-4 overflow-x-auto snap-x pb-2">
                {picks.map((e) => <EventCard key={e.id} e={e} onRsvp={rsvp} wide />)}
              </div>
            )}
          </section>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {["All", ...TAGS].map((t) => (
              <button key={t} onClick={() => setTag(t)} className={`h-11 px-4 rounded-full text-sm whitespace-nowrap border ${tag === t ? "bg-accent border-accent" : "border-white/15 bg-white/5"}`}>{t}</button>
            ))}
          </div>
          {feed.length === 0 && <p className="text-slate-400">No events under {tag} yet.</p>}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((e) => <EventCard key={e.id} e={e} onRsvp={rsvp} />)}
          </div>
        </>
      )}
    </div>
  );
}
