"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, GraduationCap,
  Keyboard, Layers3, Library, Lightbulb, Loader2, LockKeyhole, MessageCircle,
  Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, Volume2, WandSparkles,
  X, XCircle, AlertTriangle, Star, CalendarDays, Home, BarChart3, Bookmark
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEVELS, type EvaluationResponse, type Level, type Sentence, type Status, type PracticeScore, type OrthographyWord, type OrthographyReviewResponse } from '@/lib/types'
import { compareTranslations, type DiffPart } from '@/lib/translation-diff'

type View = 'home' | 'practice' | 'review' | 'bank' | 'progress'
type Filter = Level | 'Todos'
const NAV_ITEMS = [
  { view: 'home', label: 'Inicio', icon: Home },
  { view: 'practice', label: 'Practicar', icon: BookOpen },
  { view: 'review', label: 'Repasar', icon: RotateCcw },
  { view: 'bank', label: 'Mis frases', icon: Library },
  { view: 'progress', label: 'Progreso', icon: BarChart3 },
] as const
const FAVORITES_KEY = 'parole_favorites_v1'
const CHARACTERS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ù', 'û', 'ç', 'œ', 'î', 'ï', "'"]
const A1_TOPICS = [
  'Présent de être et avoir',
  'Presente de verbos frecuentes',
  'Artículos definidos e indefinidos',
  'Género y plural de sustantivos',
  'Concordancia de adjetivos',
  'Negación ne... pas',
  'Preguntas básicas: où, comment, combien',
  'Pronombres personales y posesivos',
  'Preposiciones de lugar',
  'Futuro próximo: aller + infinitivo',
  'Rutinas diarias y horas',
  'Expresiones cotidianas'
]
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
  return level === 'A1' ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : level === 'A2' ? 'bg-sky-50 text-sky-700 border-sky-100'
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
function SpeakButton({ text, lang = 'fr-FR', label = 'Escuchar en francés' }: { text: string; lang?: string; label?: string }) {
  const speak = () => {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.88
    const language = lang.toLowerCase()
    const voice = synth.getVoices().find(v => v.lang.toLowerCase() === language)
      ?? synth.getVoices().find(v => v.lang.toLowerCase().startsWith(language.slice(0, 2)))
    if (voice) utterance.voice = voice
    synth.speak(utterance)
  }
  return <button type="button" onClick={speak} title={label} aria-label={label + ': ' + text}
    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100">
    <Volume2 size={19} />
  </button>
}
function ComparisonText({ parts, side }: { parts: DiffPart[]; side: 'original' | 'corrected' }) {
  return <span className="whitespace-pre-wrap break-words">
    {parts.map((part, index) => part.kind === 'unchanged' ?
      <span key={index}>{part.text}</span> :
      <mark key={index} title={side === 'original' ? 'Fragmento que hay que corregir' : 'Fragmento corregido'}
        className={cn('rounded-[4px] px-0.5 py-0.5 font-bold box-decoration-clone',
          side === 'original'
            ? 'bg-rose-100 text-rose-800 underline decoration-rose-500 decoration-2 underline-offset-4'
            : 'bg-emerald-100 text-emerald-900 underline decoration-emerald-600 decoration-2 underline-offset-4')}>
        {part.text}
      </mark>)}
  </span>
}

function FeedbackPanel({ feedback, userAnswer, onNext, onRetry, onFavorite, isFavorite }: {
  feedback: EvaluationResponse
  userAnswer: string
  onNext: () => void
  onRetry: () => void
  onFavorite: () => void
  isFavorite: boolean
}) {
  const status: Record<Status, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
    perfect: { label: '¡Perfecto!', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
    minor_errors: { label: '¡Casi perfecto!', cls: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle },
    incorrect: { label: 'Vamos a mejorarla', cls: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle },
  }
  const info = status[feedback.status]
  const StatusIcon = info.icon
  const comparison = compareTranslations(userAnswer, feedback.corrected_sentence)
  const changeHighlights = comparison.changes.filter(change => change.before.trim() || change.after.trim())
  // Ignore cosmetic differences that do not make the French more natural.
  const normalized = (value: string) => value.normalize('NFC')
    .replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/u, '').trim().toLocaleLowerCase('fr')
  const hasDistinctAlternative = normalized(feedback.corrected_sentence) !== normalized(feedback.natural_alternative)
  return <section className="animate-pop-in mt-7 space-y-5 border-t border-slate-100 pt-7" aria-live="polite">
    <div className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4', info.cls)}>
      <div className="flex items-center gap-3"><StatusIcon size={22} /><span className="font-bold">{info.label}</span></div>
      <span className="text-lg font-extrabold tabular">{feedback.score}/100</span>
    </div>
    {(feedback.orthographySaved ?? 0) > 0 && <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
      {feedback.orthographySaved} {feedback.orthographySaved === 1 ? 'palabra añadida o reforzada' : 'palabras añadidas o reforzadas'} para Repasar → Ortografía.
    </p>}
    <div className="grid grid-cols-3 gap-2" aria-label="Acciones de la corrección">
      <button type="button" onClick={onRetry} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-1 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:text-sm">
        <RotateCcw size={17} /> Reintentar
      </button>
      <button type="button" onClick={onFavorite} aria-pressed={isFavorite} className={cn('flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-1 text-xs font-bold sm:text-sm',
        isFavorite ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
        <Bookmark size={17} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Guardada' : 'Guardar'}
      </button>
      <button type="button" onClick={onNext} className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-1 text-xs font-bold text-white hover:bg-indigo-700 sm:text-sm">
        Siguiente <ArrowRight size={17} />
      </button>
    </div>
    <p className="hidden text-center text-xs font-medium text-slate-500 sm:block">Pulsa Enter para pasar a la siguiente frase</p>
    <div className="rounded-2xl border border-slate-100 bg-slate-50/75 p-4 sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600">
        <Search size={16} className="text-indigo-500" /> Compara las diferencias
      </h3>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-rose-800">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-300" /> Lo que escribiste
          </div>
          <p className="lesson-text text-[19px] leading-relaxed text-slate-900 sm:text-[22px]">
            <ComparisonText parts={comparison.original} side="original" />
          </p>
        </div>
        <div className="border-t border-slate-200 pt-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Tu frase corregida
          </div>
          <div className="flex items-start justify-between gap-3">
            <p className="lesson-text text-[19px] leading-relaxed text-slate-900 sm:text-[22px]">
              <ComparisonText parts={comparison.corrected} side="corrected" />
            </p>
            <SpeakButton text={feedback.corrected_sentence} />
          </div>
        </div>
      </div>
      {changeHighlights.length > 0 ? <div className="mt-5 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Cambios detectados</div>
        <div className="flex flex-wrap gap-2">
          {changeHighlights.slice(0, 5).map((change, index) =>
            <span key={index} className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-sm">
              <span className="break-all font-semibold text-rose-700 line-through decoration-rose-500">
                {change.before.trim() || '∅'}
              </span>
              <ArrowRight size={15} className="shrink-0 text-slate-500" />
              <span className="break-all font-bold text-emerald-700">{change.after.trim() || '∅'}</span>
            </span>)}
          {changeHighlights.length > 5 &&
            <span className="self-center text-xs text-slate-500">Y {changeHighlights.length - 5} cambios más</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">Rojo: tu versión · Verde: propuesta de corrección. ∅ significa que se ha añadido o eliminado algo.</p>
      </div> : <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
        {feedback.status === 'perfect'
          ? 'Tu frase coincide con la corrección. ¡Muy bien!'
          : 'No hay cambios escritos entre tu respuesta y la propuesta. Revisa la explicación: podría tratarse de un matiz de significado o de una evaluación incorrecta.'}
      </p>}
    </div>
    {hasDistinctAlternative ? (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
          <Sparkles size={14} /> Alternativa natural
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="lesson-text text-[19px] leading-relaxed text-slate-900 sm:text-[22px]">{feedback.natural_alternative}</p>
          <SpeakButton text={feedback.natural_alternative} />
        </div>
      </div>
    ) : (
      <div className="flex items-start gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm leading-relaxed text-indigo-700">
        <Sparkles size={17} className="mt-0.5 shrink-0" />
        <span>La frase corregida ya suena natural en francés. No necesita otra reformulación.</span>
      </div>
    )}
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
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> Sesión protegida durante 30 días; no se almacena el PIN</p>
    </div>
  </main>
}

export default function Page() {
  const [view, setView] = useState<View>('practice')
  const [reviewWeak, setReviewWeak] = useState(false)
  const [reviewMode, setReviewMode] = useState<'sentences' | 'orthography'>('sentences')
  const [spellWords, setSpellWords] = useState<OrthographyWord[]>([])
  const [spellError, setSpellError] = useState('')
  const [spellAnswer, setSpellAnswer] = useState('')
  const [spellResult, setSpellResult] = useState<OrthographyReviewResponse | null>(null)
  const [spellSeen, setSpellSeen] = useState<string[]>([])
  const [spellBusy, setSpellBusy] = useState(false)
  const [spellAhead, setSpellAhead] = useState(false)

  const [reviewSeen, setReviewSeen] = useState<string[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [level, setLevel] = useState<Filter>('Todos')
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [scores, setScores] = useState<PracticeScore[]>([])
  const [scoresError, setScoresError] = useState('')
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
  const [genLevel, setGenLevel] = useState<Level>('A1')
  const [genTopic, setGenTopic] = useState(A1_TOPICS[0])
  const [genCount, setGenCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const spellInputRef = useRef<HTMLInputElement>(null)
  const enterAdvanceLock = useRef(false)
  const focusAfterNext = useRef(false)
  const practiceIdRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ sentences: Sentence[] }>('/api/sentences')
      setSentences(data.sentences)
      setError('')
      try {
        const history = await api<{ scores: PracticeScore[] }>('/api/scores')
        setScores(history.scores)
        setScoresError('')
      } catch {
        setScores([])
        setScoresError('No se ha podido cargar el historial de notas. Vuelve a abrir Parole.')
      }
      try {
        const spelling = await api<{ words: OrthographyWord[] }>('/api/orthography')
        setSpellWords(spelling.words)
        setSpellError('')
      } catch {
        setSpellError('No se ha podido sincronizar la ortografía. Prueba a actualizar.')
      }
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
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
      if (Array.isArray(saved)) setFavoriteIds(saved.filter((id): id is string => typeof id === 'string'))
    } catch { /* The app remains usable if browser storage is unavailable. */ }
  }, [])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // La barra flotante se mantiene sobre el teclado en navegadores Android.
  useEffect(() => {
    if (!isTyping) return
    const viewport = window.visualViewport
    const updateInset = () => {
      const inset = viewport ? window.innerHeight - viewport.height - viewport.offsetTop : 0
      setKeyboardInset(Math.max(0, Math.round(inset)))
    }
    updateInset()
    viewport?.addEventListener('resize', updateInset)
    viewport?.addEventListener('scroll', updateInset)
    window.addEventListener('resize', updateInset)
    return () => {
      viewport?.removeEventListener('resize', updateInset)
      viewport?.removeEventListener('scroll', updateInset)
      window.removeEventListener('resize', updateInset)
    }
  }, [isTyping])

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
  const reviewCandidates = useMemo(() => filtered.filter(s =>
    s.times_practiced > 0 && new Date(s.next_review_at).getTime() <= now
  ).sort((a, b) => a.mastery_score - b.mastery_score), [filtered, now])
  const weakCandidates = useMemo(() => filtered.filter(s =>
    s.times_practiced > 0 && s.mastery_score < 4
  ).sort((a, b) => a.mastery_score - b.mastery_score), [filtered])
  const reviewPool = (reviewWeak ? weakCandidates : reviewCandidates).filter(s => !reviewSeen.includes(s.id))
  const current = filtered.find(s => s.id === activeId) ??
    (view === 'review' ? reviewPool[0] ?? null
      : sorted.find(s => new Date(s.next_review_at).getTime() <= now || showUpcoming) ?? null)
  const bank = useMemo(() => filtered.filter(s =>
    (!onlyFavorites || favoriteIds.includes(s.id)) &&
    (s.spanish_text + ' ' + s.grammar_topic + ' ' + s.reference_french).toLocaleLowerCase('es')
      .includes(search.toLocaleLowerCase('es'))
  ).sort((a, b) => new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime()),
  [filtered, search, onlyFavorites, favoriteIds])
  const practiced = filtered.filter(s => s.times_practiced > 0).length
  const masteryPercent = practiced ? Math.round(mastered / practiced * 100) : 0
  const levelStats = LEVELS.map(item => {
    const items = sentences.filter(s => s.level === item)
    return { level: item, total: items.length, mastered: items.filter(s => s.mastery_score >= 4).length }
  })

  // Only the first correction of a practice encounter contributes to the average.
  // The id survives "Volver a intentar" but is renewed for a new encounter.
  const progress = useMemo(() => {
    const history = scores.filter(s => level === 'Todos' || s.level === level)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.practice_id.localeCompare(b.practice_id))
    const mean = (items: PracticeScore[]): number | null =>
      items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : null
    const last = history.slice(-20)
    const before = history.slice(-40, -20)
    const blocks: { start: number; end: number; value: number }[] = []
    for (let i = 0; i < history.length; i += 20) {
      const group = history.slice(i, i + 20)
      blocks.push({ start: i + 1, end: i + group.length, value: mean(group) ?? 0 })
    }
    return {
      total: history.length,
      global: mean(history),
      recent: mean(last),
      change: last.length === 20 && before.length === 20 ? (mean(last) ?? 0) - (mean(before) ?? 0) : null,
      blocks: blocks.slice(-10)
    }
  }, [scores, level])

  const spellActive = useMemo(() => spellWords.filter(w => w.state === 'active'), [spellWords])
  const spellDue = spellActive.filter(w => new Date(w.next_review_at).getTime() <= now)
  const spellMastered = spellActive.filter(w => w.mastery_score >= 4).length
  const spellPending = spellActive.filter(w =>
    (spellAhead || new Date(w.next_review_at).getTime() <= now) && !spellSeen.includes(w.id))
    .sort((a, b) => new Date(a.next_review_at).getTime() - new Date(b.next_review_at).getTime())[0] ?? null
  // Keep the reviewed word on screen until the user explicitly chooses "Siguiente".
  // Its next_review_at changes on grading, so relying only on the due queue would
  // immediately replace the question underneath its feedback.
  const spellCurrent = spellResult?.word ?? spellPending

  const saveSpellWord = (word: OrthographyWord) =>
    setSpellWords(prev => prev.map(w => w.id === word.id ? word : w))

  const submitSpelling = async (event: FormEvent) => {
    event.preventDefault()
    if (!spellCurrent || !spellAnswer.trim() || spellBusy || spellResult) return
    setSpellBusy(true); setSpellError('')
    spellInputRef.current?.blur()
    try {
      const result = await api<OrthographyReviewResponse>('/api/orthography-review', {
        method: 'POST', body: JSON.stringify({ wordId: spellCurrent.id, answer: spellAnswer })
      })
      saveSpellWord(result.word)
      setSpellResult(result)
      setNow(Date.now())
    } catch (e) {
      setSpellError(e instanceof Error ? e.message : 'No se ha podido corregir la palabra.')
    } finally { setSpellBusy(false) }
  }
  const nextSpelling = () => {
    if (spellCurrent) setSpellSeen(prev => [...prev, spellCurrent.id])
    setSpellResult(null); setSpellAnswer(''); setSpellError('')
  }
  const setSpellingStatus = async (word: OrthographyWord, state: 'active' | 'dismissed') => {
    setSpellError('')
    try {
      const result = await api<{ word: OrthographyWord }>('/api/orthography-status', {
        method: 'POST', body: JSON.stringify({ wordId: word.id, state })
      })
      saveSpellWord(result.word)
      if (word.id === spellCurrent?.id) {
        setSpellResult(null); setSpellAnswer('')
      }
      setNow(Date.now())
    } catch (e) { setSpellError(e instanceof Error ? e.message : 'No se ha podido actualizar la palabra.') }
  }
  useEffect(() => {
    if (view === 'review' && reviewMode === 'orthography' && !spellResult &&
        window.matchMedia('(pointer: fine)').matches) spellInputRef.current?.focus()
  }, [view, reviewMode, spellResult, spellSeen])
  useEffect(() => {
    if (view !== 'review' || reviewMode !== 'orthography' || !spellResult) return
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.keyCode === 229 ||
          !window.matchMedia('(pointer: fine)').matches ||
          event.ctrlKey || event.altKey || event.metaKey) return
      if (event.target instanceof Element &&
          event.target.closest('button, input, textarea, select, a, summary, [contenteditable]')) return
      event.preventDefault()
      nextSpelling()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, reviewMode, spellResult, spellCurrent])

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => {
      const updated = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)) } catch { /* Optional local favorite. */ }
      return updated
    })
  }
  const navigate = (target: View) => {
    practiceIdRef.current = null
    if (target === 'review' || (view === 'review' && target === 'practice')) {
      setActiveId(null); setAnswer(''); setFeedback(null); setShowHint(false); setShowUpcoming(false)
      setReviewSeen([]); setReviewWeak(false)
    }
    setView(target)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const changeLevel = (value: Filter) => {
    practiceIdRef.current = null
    setLevel(value); setActiveId(null); setFeedback(null); setAnswer(''); setShowUpcoming(false)
    setReviewSeen([]); setShowHint(false)
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
    if (!practiceIdRef.current) practiceIdRef.current = crypto.randomUUID()
    textareaRef.current?.blur()
    setIsTyping(false)
    setSubmitting(true); setError(''); setActiveId(current.id)
    try {
      const result = await api<EvaluationResponse>('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          sentenceId: current.id, spanishText: current.spanish_text,
          referenceFrench: current.reference_french, level: current.level,
          grammarTopic: current.grammar_topic, userAnswer: answer,
          practiceId: practiceIdRef.current
        })
      })
      setFeedback(result)
      setSentences(previous => previous.map(s => s.id === result.sentence.id ? result.sentence : s))
      if (result.scoreRecord) {
        setScores(previous => previous.some(s => s.practice_id === result.scoreRecord?.practice_id)
          ? previous : [...previous, result.scoreRecord!])
      }
      if ((result.orthographySaved ?? 0) > 0) {
        void api<{ words: OrthographyWord[] }>('/api/orthography')
          .then(data => setSpellWords(data.words))
          .catch(() => setSpellError('La ortografía se guardó, pero falta sincronizarla.'))
      }
      setNow(Date.now())
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo corregir') }
    finally { setSubmitting(false) }
  }
  const next = () => {
    focusAfterNext.current = window.matchMedia('(pointer: fine)').matches
    practiceIdRef.current = null
    const options = view === 'review'
      ? reviewPool.filter(s => s.id !== current?.id)
      : sorted.filter(s => s.id !== current?.id
        && (showUpcoming || new Date(s.next_review_at).getTime() <= Date.now()))
    if (view === 'review' && current) setReviewSeen(prev => [...prev, current.id])
    setActiveId(options[0]?.id ?? null)
    setAnswer(''); setFeedback(null); setShowHint(false); setError('')
    if (options.length === 0 && view !== 'review') setShowUpcoming(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const retry = () => {
    setFeedback(null); setAnswer(''); setShowHint(false); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  useEffect(() => {
    if (!feedback && focusAfterNext.current) {
      textareaRef.current?.focus()
      focusAfterNext.current = false
    }
  }, [feedback, activeId, view])
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229 || !window.matchMedia('(pointer: fine)').matches) return
    // On a computer each translation is one sentence: Enter submits rather than inserting a line break.
    event.preventDefault()
    if (answer.trim() && !submitting) void correct()
  }
  useEffect(() => {
    if (!feedback || (view !== 'practice' && view !== 'review')) {
      enterAdvanceLock.current = false
      return
    }
    enterAdvanceLock.current = false
    const continueOnEnter = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing ||
          event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey ||
          !window.matchMedia('(pointer: fine)').matches || enterAdvanceLock.current) return
      // Keep native keyboard activation for buttons and other interactive controls.
      if (event.target instanceof Element &&
          event.target.closest('button, input, textarea, select, a, summary, [contenteditable], [role="button"]')) return
      event.preventDefault()
      enterAdvanceLock.current = true
      next()
    }
    window.addEventListener('keydown', continueOnEnter)
    return () => window.removeEventListener('keydown', continueOnEnter)
  }, [feedback, view, next])
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
      practiceIdRef.current = null
      setGeneratorOpen(false); setLevel(genLevel); setView('practice')
      setReviewWeak(false); setReviewSeen([]); setShowHint(false)
      setActiveId(result.sentences[0]?.id ?? null); setAnswer(''); setFeedback(null)
      setNotice(result.insertedCount + ' frases nuevas añadidas a tu banco.')
      setNow(Date.now())
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al generar frases'); setGeneratorOpen(false) }
    finally { setGenerating(false) }
  }
  const practiceSentence = (id: string) => {
    practiceIdRef.current = null
    setView('practice'); setActiveId(id); setShowUpcoming(true)
    setFeedback(null); setAnswer(''); setShowHint(false); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!authReady) return <main className="flex min-h-screen items-center justify-center gap-3 text-indigo-600"><Loader2 className="animate-spin" /> Comprobando acceso...</main>
  if (!authorized) return <Login onLogin={login} busy={authBusy} error={authError} />

  return <main className="mx-auto min-h-screen max-w-6xl px-4 pb-32 sm:px-6 sm:pb-20 lg:px-8">
    <header className="flex items-center justify-between gap-2 border-b border-slate-200/70 py-2.5 sm:py-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl font-black text-white shadow-md shadow-indigo-200 sm:h-11 sm:w-11 sm:rounded-2xl">P<span className="text-amber-300">.</span></div>
        <div><div className="text-[19px] font-extrabold tracking-tight text-slate-900 sm:text-[22px]">parole<span className="text-indigo-600">.</span></div>
          <p className="hidden text-[11px] font-medium tracking-wide text-slate-500 sm:block">FRANCÉS ACTIVO · A1—B2</p></div>
      </div>
      {view === 'practice' ? <div className="flex items-center gap-2">
        <label htmlFor="practice-level" className="sr-only">Nivel de práctica</label>
        <select id="practice-level" value={level} onChange={e => changeLevel(e.target.value as Filter)}
          className="max-w-28 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-800">
          {(['Todos', ...LEVELS] as const).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Sincronizar" title="Sincronizar con la nube"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div> : <button type="button" onClick={() => { setGeneratorOpen(true); setNotice('') }}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm">
        <Sparkles size={17} /> <span className="hidden sm:inline">Generar nuevas frases con IA</span><span className="sm:hidden">Generar con IA</span>
      </button>}
    </header>
    {view !== 'practice' && <div className="mt-4 flex items-center justify-between gap-2 sm:mt-9 sm:flex-wrap sm:items-end sm:gap-5">
      <div>
        <div className="mb-3 hidden items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 sm:inline-flex">
          <Star size={13} fill="currentColor" /> Un poco cada día, mucho francés
        </div>
        <h1 className="text-[21px] font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          <span className="sm:hidden">{view === 'home' ? 'Tu inicio' : view === 'review' ? 'Tus repasos' : view === 'bank' ? 'Mis frases' : 'Tu progreso'}</span>
          <span className="hidden sm:inline">{view === 'home' ? 'Tu inicio' : view === 'review' ? 'Repaso espaciado' : view === 'bank' ? 'Mis frases' : 'Tu progreso'}</span>
        </h1>
        <p className="mt-2 hidden text-sm leading-relaxed text-slate-600 sm:block sm:text-base">Traduce, recibe feedback y repasa justo cuando lo necesitas.</p>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="level-filter" className="hidden text-sm font-semibold text-slate-600 sm:block">Nivel</label>
        <select id="level-filter" value={level} onChange={e => changeLevel(e.target.value as Filter)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-800 shadow-sm sm:px-4 sm:py-2.5">
          {(['Todos', ...LEVELS] as const).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Sincronizar" title="Sincronizar con la nube"
          className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-indigo-600">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>}

    {notice && <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">
      <span className="flex items-center gap-2"><Check size={17} />{notice}</span>
      <button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={17} /></button>
    </div>}
    {error && <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
      <span>{error}</span><button type="button" aria-label="Cerrar error" onClick={() => setError('')}><X size={17}/></button>
    </div>}

    <nav className="mt-4 hidden gap-1 border-b border-slate-200 sm:mt-8 sm:flex" aria-label="Secciones">
      {NAV_ITEMS.map(item => {
        const Icon = item.icon
        return <button key={item.view} type="button" onClick={() => navigate(item.view)}
          aria-current={view === item.view ? 'page' : undefined}
          className={cn('flex items-center gap-2 border-b-[3px] px-3 pb-3 pt-2 text-sm font-bold',
            view === item.view ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>
          <Icon size={18} /> {item.label}
        </button>
      })}
    </nav>

    {view === 'review' && <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="group" aria-label="Modalidad de repaso">
      <button type="button" onClick={() => { setReviewMode('sentences'); setSpellResult(null); setSpellAnswer('') }}
        aria-pressed={reviewMode === 'sentences'}
        className={cn('rounded-xl px-3 py-3 text-sm font-bold', reviewMode === 'sentences' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600')}>
        Frases ({reviewCandidates.length})
      </button>
      <button type="button" onClick={() => { setReviewMode('orthography'); setSpellSeen([]); setSpellResult(null); setSpellAnswer(''); setSpellAhead(false) }}
        aria-pressed={reviewMode === 'orthography'}
        className={cn('rounded-xl px-3 py-3 text-sm font-bold', reviewMode === 'orthography' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600')}>
        Ortografía ({spellDue.length})
      </button>
    </div>}
    
    {view === 'home' ? <section className="mt-5 space-y-5 sm:mt-7">
      <div className="soft-shadow rounded-[24px] border border-indigo-100 bg-white p-5 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Tu francés, día a día</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900">¿Qué hacemos hoy?</h2>
        <p className="mt-2 text-sm text-slate-600">Traduce frases, recupera las que necesitas repasar y consolida tu gramática.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => navigate('practice')} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white"><BookOpen size={19} /> Practicar</button>
          <button type="button" onClick={() => navigate('review')} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-bold text-indigo-700"><RotateCcw size={19} /> Repasar ({reviewCandidates.length})</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Frases', value: filtered.length },
          { label: 'Pendientes', value: due.length },
          { label: 'Practicadas', value: practiced },
          { label: 'Dominadas', value: mastered }
        ].map(stat => <div key={stat.label} className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="text-2xl font-extrabold tabular text-slate-900">{stat.value}</div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{stat.label}</p>
        </div>)}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="flex items-center gap-2 font-extrabold text-slate-900"><Star size={19} className="text-amber-500" /> Refuerza tus dificultades</div>
        <p className="mt-2 text-sm text-slate-600">{weakCandidates.length} frases ya practicadas tienen un dominio inferior a 4/5.</p>
        <button type="button" onClick={() => { navigate('review'); setReviewWeak(true) }} disabled={weakCandidates.length === 0}
          className="mt-4 rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-700 disabled:opacity-40">
          Practicar mis dificultades <ChevronRight size={17} className="inline" />
        </button>
      </div>
    </section> : view === 'progress' ? <section className="mt-5 space-y-5 sm:mt-7">
      <div className="soft-shadow rounded-[24px] border border-slate-100 bg-white p-5 sm:p-8">
        <h2 className="text-xl font-extrabold text-slate-900">Notas de tus traducciones</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          La nota media refleja tu primera respuesta a cada ejercicio, sin contar los reintentos inmediatos.
          {level !== 'Todos' ? ' Estás viendo solo el nivel ' + level + '.' : ' Estás viendo todos los niveles.'}
        </p>
        {scoresError && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="alert">{scoresError}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Media global</p>
            <div className="mt-2 text-3xl font-extrabold tabular-nums text-indigo-700">
              {progress.global ?? '—'}<span className="ml-1 text-sm font-semibold text-indigo-500">{progress.global !== null && '/100'}</span>
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Últimas 20 frases</p>
            <div className="mt-2 text-3xl font-extrabold tabular-nums text-emerald-700">
              {progress.recent ?? '—'}<span className="ml-1 text-sm font-semibold text-emerald-600">{progress.recent !== null && '/100'}</span>
            </div>
            {progress.change !== null &&
              <p className="mt-2 text-xs font-semibold text-slate-700">
                {progress.change > 0 ? '+' : ''}{progress.change} puntos frente a las 20 anteriores
              </p>}
          </div>
        </div>
        {progress.total === 0
          ? <p className="mt-5 text-sm text-slate-500">Aún no hay notas registradas para este nivel. Las notas anteriores a esta mejora no se pueden recuperar; el seguimiento comienza con tus próximas traducciones.</p>
          : <div className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-800">Evolución de la nota media</h3>
                <span className="text-xs font-medium text-slate-500">{progress.total} {progress.total === 1 ? 'primera respuesta' : 'primeras respuestas'} registradas</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Cada punto representa hasta 20 frases. Se muestran los últimos 10 bloques.</p>
              <svg viewBox="0 0 580 185" className="mt-3 w-full" role="img" aria-label="Evolución de la puntuación media por bloques de veinte frases">
                {[25, 85, 145].map((y, index) => <g key={y}>
                  <line x1="35" x2="552" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
                  <text x="27" y={y + 4} fontSize="11" fill="#64748b" textAnchor="end">{100 - index * 50}</text>
                </g>)}
                {progress.blocks.length > 1 && <polyline fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
                  points={progress.blocks.map((block, index) =>
                    `${35 + index * 517 / (progress.blocks.length - 1)},${145 - block.value * 1.2}`).join(' ')} />}
                {progress.blocks.map((block, index) => {
                  const x = progress.blocks.length === 1 ? 294 : 35 + index * 517 / (progress.blocks.length - 1)
                  const y = 145 - block.value * 1.2
                  return <g key={block.start}>
                    <circle cx={x} cy={y} r="5" fill="#4f46e5" stroke="white" strokeWidth="2" />
                    <text x={x} y={Math.max(13, y - 12)} textAnchor="middle" fontSize="12" fontWeight="700" fill="#4338ca">{block.value}</text>
                    <text x={x} y="169" textAnchor="middle" fontSize="10" fill="#64748b">{block.end}</text>
                  </g>
                })}
              </svg>
              <p className="text-center text-xs text-slate-500">Número de respuestas acumuladas</p>
            </div>}
      </div>
      <div className="soft-shadow rounded-[24px] border border-slate-100 bg-white p-5 sm:p-8">
        <h2 className="text-xl font-extrabold text-slate-900">Estado de tu aprendizaje</h2>
        <p className="mt-2 text-sm text-slate-600">Este resumen refleja el dominio actual de las frases, no una tasa histórica de aciertos.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-indigo-50 p-4"><div className="text-3xl font-extrabold text-indigo-700">{masteryPercent}%</div><p className="mt-1 text-xs text-slate-600">Dominadas entre las practicadas</p></div>
          <div className="rounded-xl bg-emerald-50 p-4"><div className="text-3xl font-extrabold text-emerald-700">{filtered.reduce((total, s) => total + s.times_practiced, 0)}</div><p className="mt-1 text-xs text-slate-600">Intentos acumulados</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-2xl font-extrabold text-slate-800">{spellActive.length - spellMastered}</div>
            <p className="mt-1 text-xs text-slate-600">Palabras de ortografía por consolidar</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-2xl font-extrabold text-emerald-700">{spellMastered}</div>
            <p className="mt-1 text-xs text-slate-600">Palabras de ortografía dominadas</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Las palabras de ortografía se cuentan globalmente, independientemente del nivel seleccionado.</p>
        <div className="mt-6 space-y-5">
          {levelStats.map(stat => <div key={stat.level}>
            <div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-bold text-slate-700">Nivel {stat.level}</span><span className="tabular text-slate-500">{stat.mastered} de {stat.total} dominadas</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: stat.total ? (stat.mastered / stat.total * 100) + '%' : '0%' }} /></div>
          </div>)}
        </div>
      </div>
      <button type="button" onClick={() => navigate('review')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-4 font-bold text-white">
        <RotateCcw size={19} /> Repasar frases pendientes
      </button>
    </section> : view === 'review' && reviewMode === 'orthography' ? <section className="mt-4 space-y-4">
      <div className="soft-shadow rounded-[24px] border border-slate-100 bg-white p-5 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Escribe la palabra</h2>
            <p className="mt-1 text-sm text-slate-500">Recupérala de memoria. Se respetan los acentos y las letras dobles.</p>
          </div>
          <span className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
            {spellDue.length} pendientes
          </span>
        </div>
        {spellError && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{spellError}</p>}
        {spellCurrent ? <>
          <div className="rounded-2xl bg-slate-50 p-4 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Traduce al francés</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{spellCurrent.meaning_es}</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{spellCurrent.context_fr}</p>
          </div>
          <form onSubmit={submitSpelling} className="mt-5 space-y-3">
            <label htmlFor="spell-input" className="sr-only">Escribe la palabra en francés</label>
            <input id="spell-input" ref={spellInputRef} type="text" autoComplete="off" autoCorrect="off"
              autoCapitalize="off" spellCheck={false} disabled={spellBusy || spellResult !== null}
              value={spellAnswer} onChange={event => setSpellAnswer(event.target.value)}
              placeholder="Escribe en francés..."
              className="block w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-lg text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50" />
            {!spellResult && <button type="submit" disabled={!spellAnswer.trim() || spellBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-bold text-white disabled:opacity-40">
              {spellBusy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {spellBusy ? 'Comprobando...' : 'Comprobar'}
            </button>}
          </form>
          {spellResult && <div className={cn('mt-4 rounded-2xl border p-4', spellResult.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50')} role="status">
            <div className="flex items-center gap-2 font-bold">
              {spellResult.correct ? <CheckCircle2 size={20} className="text-emerald-700" /> : <XCircle size={20} className="text-rose-700" />}
              {spellResult.correct ? '¡Correcto!' : 'Repasaremos esta palabra de nuevo'}
            </div>
            <p className="mt-2 text-xl font-extrabold text-slate-900">{spellResult.word.correct_word}</p>
            {!spellResult.correct && <p className="mt-1 text-sm text-slate-600">Escribiste: {spellAnswer}</p>}
            <button type="button" onClick={nextSpelling}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">
              Siguiente <ArrowRight size={18}/>
            </button>
            <p className="mt-2 hidden text-center text-xs text-slate-500 sm:block">Pulsa Enter para continuar</p>
          </div>}
          <button type="button" onClick={() => void setSpellingStatus(spellCurrent, 'dismissed')}
            className="mt-4 text-xs font-semibold text-slate-500 underline underline-offset-4 hover:text-rose-700">
            No es una falta de ortografía · Descartar
          </button>
        </> : <div className="py-10 text-center">
          <CheckCircle2 size={38} className="mx-auto text-emerald-600" />
          <h3 className="mt-3 text-xl font-extrabold text-slate-900">¡Ortografía al día!</h3>
          <p className="mt-2 text-sm text-slate-500">
            {spellActive.length === 0 ? 'Tus próximas faltas de ortografía se guardarán aquí automáticamente.' : 'No quedan palabras pendientes en esta sesión.'}
          </p>
          {spellActive.length > 0 && !spellAhead && <button type="button" onClick={() => { setSpellAhead(true); setSpellSeen([]) }}
            className="mt-5 rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-700">
            Practicar por adelantado
          </button>}
          {spellAhead && spellSeen.length > 0 && <button type="button" onClick={() => { setSpellSeen([]); setSpellResult(null) }}
            className="mt-5 rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-700">
            Volver a practicar
          </button>}
        </div>}
      </div>
      <details className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-bold text-slate-700">Gestionar palabras ({spellWords.length})</summary>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Puedes descartar errores que la IA haya identificado incorrectamente y recuperarlos cuando quieras.
        </p>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {spellWords.map(word => <div key={word.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-slate-900">{word.correct_word}</p>
              <p className="text-xs text-slate-500">
                {word.state === 'dismissed' ? 'Descartada' : word.mastery_score >= 4 ? 'Dominada' : 'En aprendizaje'}
                {word.state === 'active' && ' · ' + whenReview(word.next_review_at, now)}
              </p>
            </div>
            <button type="button" onClick={() => void setSpellingStatus(word, word.state === 'active' ? 'dismissed' : 'active')}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-indigo-700">
              {word.state === 'active' ? 'Descartar' : 'Recuperar'}
            </button>
          </div>)}
          {spellWords.length === 0 && <p className="py-3 text-sm text-slate-500">Todavía no hay palabras guardadas.</p>}
        </div>
      </details>
    </section> : view === 'practice' || view === 'review' ? <div className="mt-3 grid items-start gap-4 sm:mt-7 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-6">
      {view === 'review' && <div className="col-span-full flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-white p-3">
        <button type="button" onClick={() => { practiceIdRef.current = null; setReviewWeak(false); setReviewSeen([]); setActiveId(null); setFeedback(null); setAnswer(''); setShowHint(false) }}
          aria-pressed={!reviewWeak} className={cn('rounded-xl px-3 py-2 text-xs font-bold sm:text-sm', !reviewWeak ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700')}>
          Pendientes ({reviewCandidates.length})
        </button>
        <button type="button" onClick={() => { practiceIdRef.current = null; setReviewWeak(true); setReviewSeen([]); setActiveId(null); setFeedback(null); setAnswer(''); setShowHint(false) }}
          aria-pressed={reviewWeak} className={cn('rounded-xl px-3 py-2 text-xs font-bold sm:text-sm', reviewWeak ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700')}>
          Mis dificultades ({weakCandidates.length})
        </button>
        <p className="w-full text-xs text-slate-500">Las dificultades incluyen frases practicadas con dominio inferior a 4/5; pueden repasarse antes de tiempo.</p>
      </div>}
      <section className="soft-shadow min-w-0 rounded-[22px] border border-slate-100 bg-white p-4 sm:rounded-[26px] sm:p-8">
        {loading ? <div className="flex min-h-80 items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin" /> Cargando frases...</div>
          : current ? <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-extrabold', levelStyle(current.level))}>{current.level}</span>
              <span title={current.grammar_topic} className="max-w-[46vw] truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 sm:max-w-none">{current.grammar_topic}</span>
              {view === 'review' && new Date(current.next_review_at).getTime() > now &&
                <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Repaso anticipado</span>}
            </div>
            {view === 'practice' && <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => setShowHint(value => !value)} aria-expanded={showHint}
                aria-label={showHint ? 'Ocultar pista' : 'Mostrar pista'} title={showHint ? 'Ocultar pista' : 'Mostrar pista'}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100">
                <Lightbulb size={19} />
              </button>
              <SpeakButton text={current.spanish_text} lang="es-ES" label="Escuchar el enunciado en español" />
            </div>}
          </div>
          {view === 'review' && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 sm:mt-5 sm:pb-5">
            <Mastery score={current.mastery_score} showLabel />
            <span className="text-xs text-slate-500">{current.times_practiced} {current.times_practiced === 1 ? 'intento' : 'intentos'} previos</span>
          </div>}
          <div className="mt-5 sm:mt-7">
            <div className={cn('mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-600 sm:mb-3', view === 'practice' && 'sr-only')}>
              <MessageCircle size={16} /> Traduce al francés
            </div>
            <h2 className="lesson-text text-[26px] leading-[1.35] font-medium tracking-tight text-slate-900 sm:text-[34px]">
              {current.spanish_text}
            </h2>
          </div>
          {view === 'review' && <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowHint(value => !value)} aria-expanded={showHint}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-800">
              <Lightbulb size={17} /> {showHint ? 'Ocultar pista' : 'Pista'}
            </button>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-sm font-bold text-indigo-700">
              <SpeakButton text={current.spanish_text} lang="es-ES" label="Escuchar el enunciado en español" />
              <span className="pr-1">Escuchar</span>
            </div>
          </div>}
          {showHint && <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Pista:</strong> {current.grammar_topic}. La traducción comienza por «{current.reference_french.trim().split(/\s+/).slice(0, 2).join(' ')}…».
          </p>}
          {!feedback ? <div className="mt-5 sm:mt-8">
            <label htmlFor="translation" className={cn('mb-2 block text-sm font-bold text-slate-700', view === 'practice' && 'sr-only')}>Tu traducción</label>
            <textarea id="translation" ref={textareaRef} value={answer} onChange={e => setAnswer(e.target.value)}
              onKeyDown={keyDown} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
              rows={3} disabled={submitting} placeholder="Escribe tu traducción en francés..."
              className="block min-h-28 w-full resize-y rounded-2xl border-2 border-slate-200 bg-slate-50/40 p-3.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white focus:outline-none sm:min-h-36 sm:p-4 sm:text-lg" />
            <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-3 sm:mt-6', isTyping && answer.trim() && 'max-sm:hidden')}>
              <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex"><Keyboard size={16} /> Enter para enviar</span>
              <button type="button" disabled={!answer.trim() || submitting} onClick={() => void correct()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 sm:ml-auto sm:w-auto">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {submitting ? 'Corrigiendo...' : 'Enviar'}
              </button>
            </div>
            <details className="mt-3 text-sm sm:mt-4">
              <summary className="w-fit cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:text-indigo-600">Caracteres franceses</summary>
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Caracteres franceses">
                {CHARACTERS.map(ch => <button type="button" key={ch} onClick={() => insertCharacter(ch)}
                  disabled={submitting} aria-label={'Insertar ' + ch}
                  className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50">{ch}</button>)}
              </div>
            </details>
            {isTyping && answer.trim() && <div className="fixed inset-x-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur sm:hidden"
              style={{ bottom: keyboardInset }}>
              <button type="button" disabled={submitting} onPointerDown={event => event.preventDefault()}
                onClick={() => { textareaRef.current?.blur(); void correct() }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {submitting ? 'Corrigiendo...' : 'Enviar'}
              </button>
            </div>}
          </div> : <FeedbackPanel feedback={feedback} userAnswer={answer} onNext={next}
            onRetry={retry} onFavorite={() => toggleFavorite(current.id)} isFavorite={favoriteIds.includes(current.id)} />}
        </> : <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={33} /></div>
          <h2 className="text-2xl font-extrabold text-slate-900">¡Todo al día!</h2>
          <p className="mt-2 max-w-sm leading-relaxed text-slate-500">{filtered.length === 0
            ? 'Todavía no hay frases en este nivel. Genera algunas con IA o cambia de filtro.'
            : view === 'review' ? 'No quedan frases para este repaso. Puedes practicar otras o volver cuando toque.' : 'No hay frases pendientes de repaso. Puedes practicar por adelantado o volver cuando toque.'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {view === 'review' && <button type="button" onClick={() => navigate('practice')}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Ir a practicar</button>}
            {view === 'practice' && filtered.length > 0 && <button type="button" onClick={() => { setShowUpcoming(true); setActiveId(null) }}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Practicar por adelantado</button>}
            <button type="button" onClick={() => setGeneratorOpen(true)}
              className="rounded-xl border border-indigo-200 px-5 py-3 text-sm font-bold text-indigo-600"><Plus size={16} className="mr-1 inline" /> Crear frases</button>
          </div>
        </div>}
      </section>

      <aside className="hidden space-y-5 lg:block">
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
      {view === 'review' && <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 lg:hidden">
        <summary className="cursor-pointer font-semibold text-indigo-700">Cómo funciona Parole y la repetición espaciada</summary>
        <div className="mt-3 space-y-2 leading-relaxed text-slate-700">
          <p>Traduce sin consultar la solución, revisa los errores y escucha la frase corregida.</p>
          <p>El repaso se programa tras 1, 3, 7, 14 o 30 días si aciertas; 12 horas ante errores leves y 10 minutos ante errores importantes.</p>
          <p className="font-semibold">{filtered.length ? Math.round(mastered / filtered.length * 100) : 0}% de frases dominadas.</p>
        </div>
      </details>}
    </div> : <section className="soft-shadow mt-7 overflow-hidden rounded-[26px] border border-slate-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-7">
        <div><h2 className="text-xl font-extrabold text-slate-900">Tu banco de frases</h2>
          <p className="mt-1 text-sm text-slate-500">Consulta cada explicación y el próximo repaso.</p></div>
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar frases o temas..."
            aria-label="Buscar frases" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-400"/>
        </div>
        <button type="button" onClick={() => setOnlyFavorites(value => !value)} aria-pressed={onlyFavorites}
          className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold',
            onlyFavorites ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600')}>
          <Bookmark size={17} fill={onlyFavorites ? 'currentColor' : 'none'} /> Solo guardadas ({favoriteIds.filter(id => filtered.some(s => s.id === id)).length})
        </button>
      </div>
      {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500" /></div> : bank.length === 0
        ? <p className="p-12 text-center text-slate-500">No hay frases que coincidan con la búsqueda.</p>
        : <div className="divide-y divide-slate-100">
          {bank.map(s => <article key={s.id} className="p-5 transition hover:bg-slate-50/70 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-md border px-2 py-1 text-[11px] font-extrabold', levelStyle(s.level))}>{s.level}</span>
                  <span className="text-xs font-semibold text-slate-500">{s.grammar_topic}</span>
                  {s.source === 'ai_generated' && <span title="Generada con IA" className="text-xs text-indigo-500"><Sparkles size={13} /></span>}
                </div>
                <h3 className="font-bold leading-relaxed text-slate-900">{s.spanish_text}</h3>
                <p className="mt-1 text-sm italic leading-relaxed text-slate-500">{s.reference_french}</p>
                {s.last_feedback && <p className="mt-2 max-w-2xl rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500"><Lightbulb size={13} className="mr-1 inline text-amber-500" />{s.last_feedback}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => toggleFavorite(s.id)} aria-pressed={favoriteIds.includes(s.id)}
                  title={favoriteIds.includes(s.id) ? 'Quitar de guardadas' : 'Guardar en este dispositivo'}
                  className={cn('flex h-10 w-10 items-center justify-center rounded-xl border',
                    favoriteIds.includes(s.id) ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500')}>
                  <Bookmark size={18} fill={favoriteIds.includes(s.id) ? 'currentColor' : 'none'} />
                </button>
                <button type="button" onClick={() => practiceSentence(s.id)}
                  className="flex shrink-0 items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
                  Practicar <ChevronRight size={16}/>
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Mastery score={s.mastery_score} showLabel />
              <span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={14} />{whenReview(s.next_review_at, now)}</span>
              <span className="text-xs text-slate-500">{s.times_practiced} intentos</span>
            </div>
          </article>)}
        </div>}
    </section>}

    {view !== 'practice' && <footer className="mt-10 flex flex-wrap justify-center gap-2 text-center text-xs text-slate-500">
      <span>Parole · aprende francés con práctica deliberada</span><span>·</span><span>Progreso sincronizado en Supabase</span>
    </footer>}

    <nav aria-label="Navegación principal" className={cn('fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-6px_24px_rgba(15,23,42,.07)] backdrop-blur sm:hidden', isTyping && 'hidden')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1.5 py-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          return <button key={item.view} type="button" onClick={() => navigate(item.view)}
            aria-current={view === item.view ? 'page' : undefined}
            className={cn('flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-bold',
              view === item.view ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}>
            <Icon size={21} strokeWidth={view === item.view ? 2.5 : 2} aria-hidden="true" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        })}
      </div>
    </nav>

    {generatorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[3px]" onMouseDown={e => { if (e.target === e.currentTarget && !generating) setGeneratorOpen(false) }}>
      <div role="dialog" aria-modal="true" aria-labelledby="generator-title" className="animate-pop-in w-full max-w-lg rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600"><WandSparkles size={23} /></div>
          <button type="button" onClick={() => setGeneratorOpen(false)} disabled={generating} aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={21} /></button>
        </div>
        <h2 id="generator-title" className="mt-5 text-2xl font-extrabold text-slate-900">Nuevas frases con IA</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">Amplía tu banco con frases adaptadas al nivel y a la gramática que quieres reforzar.</p>
        <form onSubmit={generate} className="mt-7 space-y-5">
          <div><label htmlFor="gen-level" className="mb-2 block text-sm font-bold text-slate-700">Nivel</label>
            <div className="grid grid-cols-4 gap-2">{LEVELS.map(v =>
              <button type="button" key={v} onClick={() => { setGenLevel(v); setGenTopic(v === 'A1' ? A1_TOPICS[0] : TOPICS[0]) }}
                className={cn('rounded-xl border-2 py-3 text-sm font-extrabold',
                  genLevel === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500')}>{v}</button>)}</div>
          </div>
          <div><label htmlFor="gen-topic" className="mb-2 block text-sm font-bold text-slate-700">Tema gramatical</label>
            <input id="gen-topic" list="topics" value={genTopic} onChange={e => setGenTopic(e.target.value)}
              maxLength={100} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
            <datalist id="topics">{(genLevel === 'A1' ? A1_TOPICS : TOPICS).map(topic => <option key={topic} value={topic}/>)}</datalist>
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
        <p className="mt-4 text-center text-xs text-slate-500">Las frases generadas se guardan y sincronizan automáticamente.</p>
      </div>
    </div>}
  </main>
}
