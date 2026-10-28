"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, GraduationCap,
  Keyboard, Layers3, Library, Lightbulb, Loader2, LockKeyhole, MessageCircle,
  Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, Volume2, WandSparkles,
  X, XCircle, AlertTriangle, Star, CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EvaluationResponse, Level, Sentence, Status } from '@/lib/types'

type View = 'practice' | 'bank'
type Filter = Level | 'Todos'
const CHARACTERS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ù', 'û', 'ç', 'œ', 'î', 'ï', "'"]
const TOPICS = [
  'Passé composé vs imparfait', 'Verbos pronominales', 'Pronombres EN e Y',
  'Pronombres COD y COI', 'Negación compleja', 'Subjuntivo',
  'Condicional', 'Concordancia del participio pasado',
  'Pronombres relativos', 'Expresiones de la vida cotidiana'
]

const FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/parole-api'
  : ''
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SESSION_KEY = 'parole_session_v1'

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  if (!FUNCTION_URL || !PUBLIC_KEY) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en la compilación.')
  }
  const action = url.replace(/^\/api\//, '')
  const session = localStorage.getItem(SESSION_KEY) ?? ''
  const res = await fetch(FUNCTION_URL + '?action=' + encodeURIComponent(action), {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'apikey': PUBLIC_KEY,
      'x-parole-session': session,
      ...init?.headers
    }
  })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = json && typeof json === 'object' && 'error' in json
      ? String((json as { error: unknown }).error) : 'Error de conexión'
    if (res.status === 401 && action !== 'auth') {
      localStorage.removeItem(SESSION_KEY)
      window.location.reload()
    }
    throw new Error(reason)
  }
  return json as T
}
function readableDate(date: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}
function whenReview(date: string, now: number): string {
  const minutes = Math.round((new Date(date).getTime() - now) / 60000)
  if (minutes <= 0) return 'Disponible ahora'
  if (minutes < 60) return 'En ' + minutes + ' min'
  if (minutes < 1440) return 'En ' + Math.ceil(minutes / 60) + ' h'
  if (minutes < 2880) return 'Mañana'
  return readableDate(date)
}
function levelStyle(level: Level): string {
  return level === 'A2' ? 'bg-sky-50 text-sky-700 border-sky-100'
    : level === 'B1' ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-violet-50 text-violet-700 border-violet-100'
}
function Mastery({ score, showLabel = false }: { score: number; showLabel?: boolean }) {
  return <div className="flex items-center gap-2" aria-label={'Dominio ' + score + ' de 5'}>
    <div className="flex gap-1">{[0, 1, 2, 3, 4].map(i =>
      <span key={i} className={cn('h-2 w-5 rounded-full transition-colors sm:w-6',
        i < score ? 'bg-indigo-500' : 'bg-slate-200')} />)}</div>
    {showLabel && <span className="text-xs font-semibold text-slate-500 tabular">{score}/5</span>}
  </div>
}
function SpeakButton({ text }: { text: string }) {
  const speak = () => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'fr-FR'
    utterance.rate = 0.88
    const voice = synth.getVoices().find(v => v.lang.toLowerCase() === 'fr-fr')
      ?? synth.getVoices().find(v => v.lang.toLowerCase().startsWith('fr'))
    if (voice) utterance.voice = voice
    synth.speak(utterance)
  }
  return <button type="button" onClick={speak} title="Escuchar en francés" aria-label={'Escuchar: ' + text}
    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100">
    <Volume2 size={19} />
  </button>
}
function FeedbackPanel({ feedback, onNext }: { feedback: EvaluationResponse; onNext: () => void }) {
  const status: Record<Status, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
    perfect: { label: '¡Perfecto!', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
    minor_errors: { label: '¡Casi perfecto!', cls: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle },
    incorrect: { label: 'Vamos a mejorarla', cls: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle },
  }
  const info = status[feedback.status]
  const StatusIcon = info.icon
  return <section className="animate-pop-in mt-7 space-y-5 border-t border-slate-100 pt-7" aria-live="polite">
    <div className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4', info.cls)}>
      <div className="flex items-center gap-3"><StatusIcon size={22} /><span className="font-bold">{info.label}</span></div>
      <span className="text-lg font-extrabold tabular">{feedback.score}/100</span>
    </div>
    <div className="rounded-2xl border border-slate-100 bg-slate-50/75 p-4 sm:p-5">
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Tu frase corregida</div>
      <div className="flex items-start justify-between gap-3">
        <p className="lesson-text text-[19px] leading-relaxed text-slate-900 sm:text-[22px]">{feedback.corrected_sentence}</p>
        <SpeakButton text={feedback.corrected_sentence} />
      </div>
    </div>
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
        <Sparkles size={14} /> Alternativa natural
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="lesson-text text-[19px] leading-relaxed text-slate-900 sm:text-[22px]">{feedback.natural_alternative}</p>
        <SpeakButton text={feedback.natural_alternative} />
      </div>
    </div>
    <div className="flex items-start gap-3 rounded-2xl bg-white p-1">
      <Lightbulb size={20} className="mt-1 shrink-0 text-amber-500" />
      <div><h3 className="mb-1 font-bold text-slate-900">Explicación gramatical</h3>
        <p className="leading-relaxed text-slate-600">{feedback.grammar_explanation_es}</p></div>
    </div>
    <button type="button" onClick={onNext}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">
      Siguiente frase <ArrowRight size={20} />
    </button>
  </section>
}
function Login({ onLogin, busy, error }: { onLogin: (pin: string) => Promise<void>; busy: boolean; error: string }) {
  const [pin, setPin] = useState('')
  const submit = (event: FormEvent) => { event.preventDefault(); void onLogin(pin) }
  return <main className="flex min-h-screen items-center justify-center p-5">
    <div className="soft-shadow w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-8 sm:p-10">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white"><LockKeyhole size={27} /></div>
      <h1 className="text-3xl font-extrabold text-slate-900">Accede a Parole</h1>
      <p className="mt-2 leading-relaxed text-slate-500">Introduce tu PIN personal para recuperar tu progreso sincronizado.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label htmlFor="pin" className="block text-sm font-bold text-slate-700">PIN de acceso</label>
        <input id="pin" autoFocus type="password" value={pin} onChange={e => setPin(e.target.value)}
          autoComplete="current-password" placeholder="Tu PIN"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg outline-none focus:border-indigo-500" />
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button disabled={!pin || busy} type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3.5 font-bold text-white disabled:opacity-50">
          {busy && <Loader2 size={18} className="animate-spin" />} Entrar
        </button>
      </form>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} /> Sesión protegida durante 30 días; no se almacena el PIN</p>
    </div>
  </main>
}

export default function Page() {
  const [view, setView] = useState<View>('practice')
  const [level, setLevel] = useState<Filter>('Todos')
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [authReady, setAuthReady] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<EvaluationResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [genLevel, setGenLevel] = useState<Level>('B1')
  const [genTopic, setGenTopic] = useState(TOPICS[0])
  const [genCount, setGenCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ sentences: Sentence[] }>('/api/sentences')
      setSentences(data.sentences)
      setError('')
      setNow(Date.now())
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las frases') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let alive = true
    const initialize = async () => {
      try {
        const result = await api<{ required: boolean; authorized: boolean }>('/api/auth')
        if (!alive) return
        if (result.authorized) setAuthorized(true)
        else localStorage.removeItem(SESSION_KEY)
      } catch (e) { if (alive) setAuthError(e instanceof Error ? e.message : 'Error de acceso') }
      finally { if (alive) setAuthReady(true) }
    }
    void initialize()
    return () => { alive = false }
  }, [])
  useEffect(() => { if (authorized) void load() }, [authorized, load])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const login = async (pin: string) => {
    setAuthBusy(true)
    setAuthError('')
    try {
      const result = await api<{ session: string }>('/api/auth', {
        method: 'POST', body: JSON.stringify({ pin })
      })
      if (!result.session) throw new Error('El servidor no ha creado la sesión')
      localStorage.setItem(SESSION_KEY, result.session)
      setAuthorized(true)
    } catch (e) { setAuthError(e instanceof Error ? e.message : 'PIN incorrecto') }
    finally { setAuthBusy(false) }
  }
  const filtered = useMemo(() => sentences.filter(s => level === 'Todos' || s.level === level), [sentences, level])
  const due = useMemo(() => filtered.filter(s => new Date(s.next_review_at).getTime() <= now), [filtered, now])
  const mastered = useMemo(() => filtered.filter(s => s.mastery_score >= 4).length, [filtered])
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const aDue = new Date(a.next_review_at).getTime() <= now ? 0 : 1
    const bDue = new Date(b.next_review_at).getTime() <= now ? 0 : 1
    return aDue - bDue || a.mastery_score - b.mastery_score
      || new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime()
  }), [filtered, now])
  const current = filtered.find(s => s.id === activeId) ??
    sorted.find(s => new Date(s.next_review_at).getTime() <= now || showUpcoming) ?? null
  const bank = useMemo(() => filtered.filter(s =>
    (s.spanish_text + ' ' + s.grammar_topic + ' ' + s.reference_french).toLocaleLowerCase('es')
      .includes(search.toLocaleLowerCase('es'))
  ).sort((a, b) => new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime()),
  [filtered, search])

  const changeLevel = (value: Filter) => {
    setLevel(value); setActiveId(null); setFeedback(null); setAnswer(''); setShowUpcoming(false)
  }
  const insertCharacter = (char: string) => {
    const target = textareaRef.current
    if (!target) { setAnswer(v => v + char); return }
    const start = target.selectionStart, end = target.selectionEnd
    setAnswer(v => v.slice(0, start) + char + v.slice(end))
    requestAnimationFrame(() => {
      target.focus(); target.setSelectionRange(start + char.length, start + char.length)
    })
  }
  const correct = async () => {
    if (!current || !answer.trim() || submitting || feedback) return
    setSubmitting(true); setError(''); setActiveId(current.id)
    try {
      const result = await api<EvaluationResponse>('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          sentenceId: current.id, spanishText: current.spanish_text,
          referenceFrench: current.reference_french, level: current.level,
          grammarTopic: current.grammar_topic, userAnswer: answer
        })
      })
      setFeedback(result)
      setSentences(previous => previous.map(s => s.id === result.sentence.id ? result.sentence : s))
      setNow(Date.now())
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo corregir') }
    finally { setSubmitting(false) }
  }
  const next = () => {
    const options = sorted.filter(s => s.id !== current?.id
      && (showUpcoming || new Date(s.next_review_at).getTime() <= Date.now()))
    setActiveId(options[0]?.id ?? null)
    setAnswer(''); setFeedback(null); setError('')
    if (options.length === 0) setShowUpcoming(false)
    textareaRef.current?.focus()
  }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault(); void correct()
    }
  }
  const generate = async (event: FormEvent) => {
    event.preventDefault()
    setGenerating(true); setError('')
    try {
      const result = await api<{ sentences: Sentence[]; insertedCount: number }>('/api/generate-batch', {
        method: 'POST', body: JSON.stringify({ level: genLevel, topic: genTopic, count: genCount })
      })
      setSentences(prev => {
        const ids = new Set(prev.map(s => s.id))
        return [...prev, ...result.sentences.filter(s => !ids.has(s.id))]
      })
      setGeneratorOpen(false); setLevel(genLevel); setView('practice')
      setActiveId(result.sentences[0]?.id ?? null); setAnswer(''); setFeedback(null)
      setNotice(result.insertedCount + ' frases nuevas añadidas a tu banco.')
      setNow(Date.now())
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al generar frases'); setGeneratorOpen(false) }
    finally { setGenerating(false) }
  }
  const practiceSentence = (id: string) => {
    setView('practice'); setActiveId(id); setShowUpcoming(true)
    setFeedback(null); setAnswer(''); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!authReady) return <main className="flex min-h-screen items-center justify-center gap-3 text-indigo-600"><Loader2 className="animate-spin" /> Comprobando acceso...</main>
  if (!authorized) return <Login onLogin={login} busy={authBusy} error={authError} />

  return <main className="mx-auto min-h-screen max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 py-5 sm:py-7">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-md shadow-indigo-200">P<span className="text-amber-300">.</span></div>
        <div><div className="text-[22px] font-extrabold tracking-tight text-slate-900">parole<span className="text-indigo-600">.</span></div>
          <p className="text-[11px] font-medium tracking-wide text-slate-400">FRANCÉS ACTIVO · A2—B2</p></div>
      </div>
      <button type="button" onClick={() => { setGeneratorOpen(true); setNotice('') }}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 sm:px-5">
        <Sparkles size={17} /> <span className="hidden sm:inline">Generar nuevas frases con IA</span><span className="sm:hidden">Generar con IA</span>
      </button>
    </header>

    <div className="mt-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600">
          <Star size={13} fill="currentColor" /> Un poco cada día, mucho francés
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Bonjour, <span className="text-indigo-600">¡a practicar!</span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">Traduce, recibe feedback y repasa justo cuando lo necesitas.</p>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="level-filter" className="text-sm font-semibold text-slate-500">Nivel</label>
        <select id="level-filter" value={level} onChange={e => changeLevel(e.target.value as Filter)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm">
          {(['Todos', 'A2', 'B1', 'B2'] as const).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Sincronizar" title="Sincronizar con la nube"
          className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-indigo-600">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>

    <div className="mt-7 grid grid-cols-3 gap-3 sm:gap-5">
      <div className="soft-shadow rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-slate-400"><Layers3 size={18} /><span className="hidden text-xs font-semibold sm:inline">Banco personal</span></div>
        <div className="text-2xl font-extrabold text-slate-900 tabular sm:text-3xl">{filtered.length}</div>
        <div className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">Frases totales</div>
      </div>
      <div className="soft-shadow rounded-2xl border border-indigo-100 bg-indigo-600 p-4 text-white sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-indigo-200"><Clock3 size={18} /><span className="hidden text-xs font-semibold sm:inline">Tu repaso</span></div>
        <div className="text-2xl font-extrabold tabular sm:text-3xl">{due.length}</div>
        <div className="mt-1 text-xs font-medium text-indigo-100 sm:text-sm">Pendientes hoy</div>
      </div>
      <div className="soft-shadow rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-emerald-500"><CheckCircle2 size={18} /><span className="hidden text-xs font-semibold text-slate-400 sm:inline">¡Vas muy bien!</span></div>
        <div className="text-2xl font-extrabold text-slate-900 tabular sm:text-3xl">{mastered}</div>
        <div className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">Dominadas (4–5)</div>
      </div>
    </div>

    {notice && <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">
      <span className="flex items-center gap-2"><Check size={17} />{notice}</span>
      <button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={17} /></button>
    </div>}
    {error && <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
      <span>{error}</span><button type="button" aria-label="Cerrar error" onClick={() => setError('')}><X size={17}/></button>
    </div>}

    <nav className="mt-8 flex gap-2 border-b border-slate-200" aria-label="Secciones">
      <button type="button" onClick={() => setView('practice')}
        className={cn('flex items-center gap-2 border-b-[3px] px-4 pb-3 pt-2 text-sm font-bold',
          view === 'practice' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>
        <BookOpen size={18} /> Practicar
      </button>
      <button type="button" onClick={() => setView('bank')}
        className={cn('flex items-center gap-2 border-b-[3px] px-4 pb-3 pt-2 text-sm font-bold',
          view === 'bank' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>
        <Library size={18} /> Banco de frases
      </button>
    </nav>

    {view === 'practice' ? <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
      <section className="soft-shadow min-w-0 rounded-[26px] border border-slate-100 bg-white p-5 sm:p-8">
        {loading ? <div className="flex min-h-80 items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin" /> Cargando frases...</div>
          : current ? <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-lg border px-3 py-1.5 text-xs font-extrabold', levelStyle(current.level))}>{current.level}</span>
            <span className="max-w-full rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{current.grammar_topic}</span>
            {new Date(current.next_review_at).getTime() > now && <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Repaso anticipado</span>}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <Mastery score={current.mastery_score} showLabel />
            <span className="text-xs text-slate-400">{current.times_practiced} {current.times_practiced === 1 ? 'intento' : 'intentos'} previos</span>
          </div>

          <div className="mt-7">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-600">
              <MessageCircle size={16} /> Traduce al francés
            </div>
            <h2 className="lesson-text text-[26px] leading-[1.35] font-medium tracking-tight text-slate-900 sm:text-[34px]">
              {current.spanish_text}
            </h2>
          </div>

          <div className="mt-9">
            <label htmlFor="translation" className="mb-2 block text-sm font-bold text-slate-700">Tu traducción</label>
            <textarea id="translation" ref={textareaRef} value={answer} onChange={e => setAnswer(e.target.value)}
              onKeyDown={keyDown} rows={4} disabled={submitting || !!feedback}
              placeholder="Écris ta traduction ici..."
              className="block min-h-36 w-full resize-y rounded-2xl border-2 border-slate-200 bg-slate-50/40 p-4 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none sm:text-lg" />
            {!feedback && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Caracteres franceses">
              {CHARACTERS.map(ch => <button type="button" key={ch} onClick={() => insertCharacter(ch)}
                disabled={submitting} aria-label={'Insertar ' + ch}
                className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50">{ch}</button>)}
            </div>}
            {!feedback && <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex"><Keyboard size={16} /> Ctrl/⌘ + Enter para corregir</span>
              <button type="button" disabled={!answer.trim() || submitting} onClick={() => void correct()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto sm:w-auto">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {submitting ? 'Corrigiendo...' : 'Corregir traducción'} <ArrowRight size={18} />
              </button>
            </div>}
          </div>
          {feedback && <FeedbackPanel feedback={feedback} onNext={next} />}
        </> : <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={33} /></div>
          <h2 className="text-2xl font-extrabold text-slate-900">¡Todo al día!</h2>
          <p className="mt-2 max-w-sm leading-relaxed text-slate-500">{filtered.length === 0
            ? 'Todavía no hay frases en este nivel. Genera algunas con IA o cambia de filtro.'
            : 'No hay frases pendientes de repaso. Puedes practicar por adelantado o volver cuando toque.'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {filtered.length > 0 && <button type="button" onClick={() => { setShowUpcoming(true); setActiveId(null) }}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Practicar por adelantado</button>}
            <button type="button" onClick={() => setGeneratorOpen(true)}
              className="rounded-xl border border-indigo-200 px-5 py-3 text-sm font-bold text-indigo-600"><Plus size={16} className="mr-1 inline" /> Crear frases</button>
          </div>
        </div>}
      </section>

      <aside className="space-y-5">
        <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><GraduationCap size={23} /></div>
          <h2 className="text-lg font-extrabold text-slate-900">Así se aprende</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Recupera la frase de memoria, escribe tu respuesta y compara tu versión con la corrección.</p>
          <div className="mt-5 space-y-4">
            <div className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-indigo-600">1</div><p className="text-sm text-slate-700">Traduce sin consultar la solución.</p></div>
            <div className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-indigo-600">2</div><p className="text-sm text-slate-700">Fíjate en los errores y escucha el francés.</p></div>
            <div className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-indigo-600">3</div><p className="text-sm text-slate-700">Repasa cuando el sistema te la vuelva a proponer.</p></div>
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-100 bg-white p-6">
          <div className="mb-3 flex items-center gap-2 font-extrabold text-slate-900"><RotateCcw size={18} className="text-indigo-500" /> Repetición espaciada</div>
          <p className="text-sm leading-relaxed text-slate-500">Acierto perfecto: 1, 3, 7, 14 o 30 días. Error leve: 12 horas. Error importante: 10 minutos.</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: filtered.length ? (mastered / filtered.length * 100) + '%' : '0%' }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{filtered.length ? Math.round(mastered / filtered.length * 100) : 0}% de frases dominadas</p>
        </div>
      </aside>
    </div> : <section className="soft-shadow mt-7 overflow-hidden rounded-[26px] border border-slate-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-7">
        <div><h2 className="text-xl font-extrabold text-slate-900">Tu banco de frases</h2>
          <p className="mt-1 text-sm text-slate-500">Consulta cada explicación y el próximo repaso.</p></div>
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar frases o temas..."
            aria-label="Buscar frases" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-400"/>
        </div>
      </div>
      {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500" /></div> : bank.length === 0
        ? <p className="p-12 text-center text-slate-500">No hay frases que coincidan con la búsqueda.</p>
        : <div className="divide-y divide-slate-100">
          {bank.map(s => <article key={s.id} className="p-5 transition hover:bg-slate-50/70 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-md border px-2 py-1 text-[11px] font-extrabold', levelStyle(s.level))}>{s.level}</span>
                  <span className="text-xs font-semibold text-slate-400">{s.grammar_topic}</span>
                  {s.source === 'ai_generated' && <span title="Generada con IA" className="text-xs text-indigo-500"><Sparkles size={13} /></span>}
                </div>
                <h3 className="font-bold leading-relaxed text-slate-900">{s.spanish_text}</h3>
                <p className="mt-1 text-sm italic leading-relaxed text-slate-500">{s.reference_french}</p>
                {s.last_feedback && <p className="mt-2 max-w-2xl rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500"><Lightbulb size={13} className="mr-1 inline text-amber-500" />{s.last_feedback}</p>}
              </div>
              <button type="button" onClick={() => practiceSentence(s.id)}
                className="flex shrink-0 items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
                Practicar <ChevronRight size={16}/>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Mastery score={s.mastery_score} showLabel />
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={14} />{whenReview(s.next_review_at, now)}</span>
              <span className="text-xs text-slate-400">{s.times_practiced} intentos</span>
            </div>
          </article>)}
        </div>}
    </section>}

    <footer className="mt-10 flex flex-wrap justify-center gap-2 text-center text-xs text-slate-400">
      <span>Parole · aprende francés con práctica deliberada</span><span>·</span><span>Progreso sincronizado en Supabase</span>
    </footer>

    {generatorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[3px]" onMouseDown={e => { if (e.target === e.currentTarget && !generating) setGeneratorOpen(false) }}>
      <div role="dialog" aria-modal="true" aria-labelledby="generator-title" className="animate-pop-in w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600"><WandSparkles size={23} /></div>
          <button type="button" onClick={() => setGeneratorOpen(false)} disabled={generating} aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={21} /></button>
        </div>
        <h2 id="generator-title" className="mt-5 text-2xl font-extrabold text-slate-900">Nuevas frases con IA</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">Amplía tu banco con frases adaptadas al nivel y a la gramática que quieres reforzar.</p>
        <form onSubmit={generate} className="mt-7 space-y-5">
          <div><label htmlFor="gen-level" className="mb-2 block text-sm font-bold text-slate-700">Nivel</label>
            <div className="grid grid-cols-3 gap-2">{(['A2', 'B1', 'B2'] as const).map(v =>
              <button type="button" key={v} onClick={() => setGenLevel(v)}
                className={cn('rounded-xl border-2 py-3 text-sm font-extrabold',
                  genLevel === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500')}>{v}</button>)}</div>
          </div>
          <div><label htmlFor="gen-topic" className="mb-2 block text-sm font-bold text-slate-700">Tema gramatical</label>
            <input id="gen-topic" list="topics" value={genTopic} onChange={e => setGenTopic(e.target.value)}
              maxLength={100} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
            <datalist id="topics">{TOPICS.map(topic => <option key={topic} value={topic}/>)}</datalist>
          </div>
          <div><label htmlFor="gen-count" className="mb-2 block text-sm font-bold text-slate-700">Cantidad de frases</label>
            <select id="gen-count" value={genCount} onChange={e => setGenCount(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} frases</option>)}
            </select>
          </div>
          <button type="submit" disabled={generating || genTopic.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-4 font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50">
            {generating ? <Loader2 size={19} className="animate-spin" /> : <Sparkles size={19} />}
            {generating ? 'Creando frases...' : 'Generar y empezar a practicar'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Las frases generadas se guardan y sincronizan automáticamente.</p>
      </div>
    </div>}
  </main>
}
