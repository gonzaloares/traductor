"use client"

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, GraduationCap, Headphones,
  Loader2, Mic, Pause, Play, RotateCcw, Send, Square, Volume2 } from 'lucide-react'
import { LEVELS, type Level } from '@/lib/types'
import { cn } from '@/lib/utils'
import { emptyExamAnswers, examMinutes, examParts, type ExamAnswers, type ExamHistoryResponse,
  type ExamPaper, type ExamResult } from '@/lib/exam-types'

type API = <T>(url: string, init?: RequestInit) => Promise<T>
const skillLabels = { listening: 'Comprensión oral', reading: 'Comprensión escrita',
  writing: 'Producción escrita', speaking: 'Producción oral' } as const
const request = (body: unknown): RequestInit => ({ method:'POST', body: JSON.stringify(body) })

function ScoreBreakdown({ result }: { result: ExamResult }) {
  return <div className="space-y-3">
    {(Object.keys(skillLabels) as (keyof typeof skillLabels)[]).map(key =>
      <div key={key}>
        <div className="mb-1 flex justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-700">{skillLabels[key]}</span>
          <span className="font-extrabold tabular-nums text-indigo-700">{result.scores[key]}/25</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: result.scores[key] * 4 + '%' }} />
        </div>
      </div>)}
  </div>
}

export function ExamHistory({ api }: { api: API }) {
  const [history, setHistory] = useState<ExamResult[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void api<ExamHistoryResponse>('/api/mini-exam-history')
      .then(data => { if (alive) setHistory(data.history) })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [api])
  return <section className="soft-shadow rounded-[24px] border border-slate-100 bg-white p-5 sm:p-8">
    <div className="flex items-center gap-2"><GraduationCap size={23} className="text-indigo-600" />
      <h2 className="text-xl font-extrabold text-slate-900">Mis mini-exámenes</h2></div>
    <p className="mt-2 text-sm text-slate-600">Evolución orientativa por nivel, independiente de la repetición espaciada.</p>
    {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Cargando exámenes...</p>
      : error ? <p className="mt-4 text-sm text-rose-700">{error}</p>
      : history.length === 0 ? <p className="mt-4 text-sm text-slate-500">Todavía no has terminado ningún mini-examen.</p>
      : <div className="mt-4 space-y-2">
        {history.slice(0, 12).map(exam => <div key={exam.id} className="rounded-xl border border-slate-200 p-3">
          <button type="button" onClick={() => setExpanded(value => value === exam.id ? null : exam.id)}
            aria-expanded={expanded === exam.id}
            className="flex w-full items-center justify-between gap-3 text-left">
            <span className="flex items-center gap-3">
              <span className="rounded-lg bg-indigo-50 px-2.5 py-2 text-sm font-extrabold text-indigo-700">{exam.level}</span>
              <span className="text-xs text-slate-600">{new Date(exam.completed_at).toLocaleDateString('es-ES')}</span>
            </span>
            <span className="font-extrabold tabular-nums text-slate-900">{exam.scores.total}/100</span>
          </button>
          {expanded === exam.id && <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
            <ScoreBreakdown result={exam}/>
            <p className="text-sm leading-relaxed text-slate-700">{exam.feedback.summary}</p>
            <p className="text-xs text-slate-500">{exam.note}</p>
          </div>}
        </div>)}
      </div>}
  </section>
}

export function MiniExam({ api, onExit, onFinished }: { api: API; onExit: () => void; onFinished: () => void }) {
  const [level, setLevel] = useState<Level>('A1')
  const [paper, setPaper] = useState<ExamPaper | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [answers, setAnswers] = useState<ExamAnswers>(emptyExamAnswers)
  const [step, setStep] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [listenCount, setListenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    void api<ExamHistoryResponse>('/api/mini-exam-history')
      .then(data => {
        if (!activeRef.current || !data.active) return
        setPaper(data.active)
        setLevel(data.active.level)
        try {
          const stored = localStorage.getItem('parole_exam_draft_' + data.active.id)
          if (stored) {
            const parsed = JSON.parse(stored) as { answers: ExamAnswers; step: number }
            if (parsed?.answers && Number.isInteger(parsed.step)) {
              setAnswers(parsed.answers)
              setStep(Math.max(0, Math.min(3, parsed.step)))
            }
          }
        } catch { /* Draft is optional. */ }
      }).catch(e => { if (activeRef.current) setError(e instanceof Error ? e.message : 'Error al cargar el examen.') })
      .finally(() => { if (activeRef.current) setLoading(false) })
    return () => {
      activeRef.current = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      try { recorderRef.current?.stop() } catch { /* Already stopped. */ }
      streamRef.current?.getTracks().forEach(track => track.stop())
      window.speechSynthesis?.cancel()
    }
  }, [api])

  useEffect(() => {
    if (!paper || result) return
    const update = () => setSeconds(Math.max(0, Math.floor((Date.now() - new Date(paper.started_at).getTime()) / 1000)))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [paper, result])

  useEffect(() => {
    if (!paper || result) return
    try { localStorage.setItem('parole_exam_draft_' + paper.id, JSON.stringify({ answers, step })) }
    catch { /* Browser storage is optional. */ }
  }, [paper, answers, step, result])

  const begin = async () => {
    if (busy) return
    setBusy(true); setError('')
    window.speechSynthesis?.cancel()
    try {
      const data = await api<{ exam: ExamPaper }>('/api/mini-exam-start', request({ level }))
      setPaper(data.exam); setAnswers(emptyExamAnswers()); setResult(null)
      setStep(0); setSeconds(0); setListenCount(0)
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo generar el examen.') }
    finally { setBusy(false) }
  }

  const changeOption = (part: 'listening'|'reading', index: number, value: number) =>
    setAnswers(previous => ({ ...previous,
      [part]: previous[part].map((item, i) => i === index ? value : item) }))

  const playAudio = () => {
    if (!paper || listenCount >= 2 || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(paper.listening.script)
    utterance.lang = 'fr-FR'
    utterance.rate = paper.level === 'A1' || paper.level === 'A2' ? 0.88 : 1
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find(v => v.lang.toLowerCase() === 'fr-fr')
      ?? voices.find(v => v.lang.toLowerCase().startsWith('fr')) ?? null
    window.speechSynthesis.speak(utterance)
    setListenCount(previous => previous + 1)
  }

  const startRecording = async () => {
    if (recording || transcribing || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Este navegador no admite grabación. Prueba con Chrome o Samsung Internet.'); return
    }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!activeRef.current) { stream.getTracks().forEach(track => track.stop()); return }
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(mime => MediaRecorder.isTypeSupported(mime))
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred, audioBitsPerSecond: 48000 } : undefined)
      chunksRef.current = []
      recorderRef.current = recorder
      streamRef.current = stream
      stoppedRef.current = false
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => { void sendRecording(recorder.mimeType.split(';')[0] || 'audio/webm') }
      recorder.start()
      setAnswers(previous => ({ ...previous, speaking: '', speaking_mode: 'skipped' }))
      setRecording(true)
      timerRef.current = window.setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, 80_000)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo activar el micrófono.') }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const sendRecording = async (mime: string) => {
    if (stoppedRef.current) return
    stoppedRef.current = true
    setRecording(false); setTranscribing(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (!activeRef.current) return
    const blob = new Blob(chunksRef.current, { type: mime })
    chunksRef.current = []
    if (blob.size < 200 || blob.size > 4_000_000) {
      setError('La grabación es demasiado corta o supera los 4 MB. Repite el intento.')
      setTranscribing(false); return
    }
    try {
      const buffer = new Uint8Array(await blob.arrayBuffer())
      const pieces: string[] = []
      for(let index = 0; index < buffer.length; index += 8192) {
        pieces.push(String.fromCharCode(...buffer.subarray(index, index + 8192)))
      }
      const data = await api<{ transcript: string }>('/api/mini-exam-transcribe',
        request({ audio: btoa(pieces.join('')), mime }))
      if (activeRef.current) setAnswers(previous => ({
        ...previous, speaking: data.transcript, speaking_mode: 'audio'
      }))
    } catch(e) { if (activeRef.current) setError(e instanceof Error ? e.message : 'No se pudo transcribir.') }
    finally { if (activeRef.current) setTranscribing(false) }
  }

  const finish = async () => {
    if (!paper || busy || recording || transcribing) return
    setBusy(true); setError('')
    try {
      const data = await api<{ result: ExamResult }>('/api/mini-exam-finish',
        request({ examId: paper.id, answers }))
      setResult(data.result)
      localStorage.removeItem('parole_exam_draft_' + paper.id)
      onFinished()
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo corregir el examen.') }
    finally { setBusy(false) }
  }

  const abandon = async () => {
    if (!paper || busy || recording || transcribing ||
        !window.confirm('¿Abandonar este examen? Se perderán sus respuestas y podrás elegir otro nivel.')) return
    setBusy(true); setError('')
    try {
      await api<{ ok: boolean }>('/api/mini-exam-abandon', request({ examId: paper.id }))
      localStorage.removeItem('parole_exam_draft_' + paper.id)
      window.speechSynthesis?.cancel()
      setPaper(null); setResult(null); setStep(0); setAnswers(emptyExamAnswers()); setListenCount(0)
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo abandonar el examen.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="flex justify-center p-12 text-indigo-600"><Loader2 className="animate-spin" /></div>
  if (result) return <section className="mt-5 space-y-5">
    <div className="soft-shadow rounded-3xl border border-indigo-100 bg-white p-5 sm:p-8">
      <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={24}/><span className="font-bold">Mini-examen completado</span></div>
      <p className="mt-3 text-sm font-semibold text-slate-500">Nivel {result.level} · Evaluación orientativa</p>
      <div className="mt-2 text-4xl font-extrabold tabular-nums text-indigo-700">{result.scores.total}<span className="text-lg text-slate-500">/100</span></div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{result.feedback.summary}</p>
      <div className="mt-6"><ScoreBreakdown result={result}/></div>
      <div className="mt-5 space-y-3 text-sm text-slate-700">
        <p><strong>Comprensión oral:</strong> {result.correct.listening}/2 respuestas correctas</p>
        <p><strong>Comprensión escrita:</strong> {result.correct.reading}/2 respuestas correctas</p>
        <p><strong>Escritura:</strong> {result.feedback.writing}</p>
        <p><strong>Expresión oral:</strong> {result.feedback.speaking}</p>
      </div>
      <details className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-indigo-700">Ver soluciones de comprensión y transcripción del audio</summary>
        <div className="mt-3 space-y-3 text-slate-700">
          <p><strong>Comprensión oral:</strong> {result.answer_key.listening.map(index => String.fromCharCode(65 + index)).join(', ')}</p>
          <p><strong>Comprensión escrita:</strong> {result.answer_key.reading.map(index => String.fromCharCode(65 + index)).join(', ')}</p>
          <p className="whitespace-pre-wrap"><strong>Audio:</strong> {paper?.listening.script}</p>
          <p className="whitespace-pre-wrap"><strong>Lectura:</strong> {paper?.reading.passage}</p>
        </div>
      </details>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">{result.note}</p>
      <button type="button" onClick={onExit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3.5 font-bold text-white">
        Volver a Inicio <ArrowRight size={18}/>
      </button>
    </div>
  </section>

  if (!paper) return <section className="mt-5 space-y-4">
    <div className="soft-shadow rounded-3xl border border-slate-100 bg-white p-5 sm:p-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><GraduationCap size={25}/></div>
      <h2 className="text-2xl font-extrabold text-slate-900">Mini-examen de francés</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Cuatro competencias: comprensión oral, comprensión escrita, expresión escrita y expresión oral. Una prueba breve inspirada en DELF/DALF, sin valor de certificación.
      </p>
      <p className="mt-4 text-sm font-bold text-slate-800">Selecciona el nivel</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label="Nivel del examen">
        {LEVELS.map(item => <button type="button" key={item} onClick={() => setLevel(item)} aria-pressed={level === item}
          className={cn('rounded-xl border-2 px-3 py-3 text-sm font-extrabold',
            level === item ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-600')}>{item}</button>)}
      </div>
      <div className="mt-5 space-y-2">
        {examParts.map((part, i) => <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm" key={part.key}>
          <span>{i+1}. {part.title}</span><span className="text-xs text-slate-500">{part.key==='speaking' && (level==='C1'||level==='C2')?'9 min':part.time}</span>
        </div>)}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Duración estimada: {level === 'C1' || level === 'C2' ? '20' : '15'} min. Necesitarás sonido y micrófono. El audio del examen oral se transcribe, pero no se guarda.
      </p>
      {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
      <button type="button" onClick={() => void begin()} disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-4 font-bold text-white disabled:opacity-50">
        {busy ? <Loader2 size={19} className="animate-spin"/> : <ArrowRight size={19}/>}
        {busy ? 'Preparando examen...' : 'Empezar mini-examen'}
      </button>
    </div>
  </section>

  const part = examParts[step]
  return <section className="mt-5 space-y-4">
    <div className="soft-shadow rounded-3xl border border-slate-100 bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Mini-examen {paper.level}</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">{step+1}/4 · {part.title}</h2>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-500">
          <Clock3 size={17} /> {examMinutes(seconds)} <span className="text-xs font-normal">/ {paper.duration_minutes} min orientativos</span>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5" aria-label={'Sección ' + (step+1) + ' de 4'}>
        {examParts.map((part, index) => <div key={part.key}
          className={cn('h-2 flex-1 rounded-full', index <= step ? 'bg-indigo-500' : 'bg-slate-200')}/>)}
      </div>
      {step === 0 && <div className="mt-6 space-y-5">
        <p className="text-sm text-slate-600">Escucha el fragmento en francés y responde a las dos preguntas. Puedes reproducirlo dos veces. No se mostrará la transcripción hasta terminar.</p>
        <button type="button" onClick={playAudio} disabled={listenCount >= 2 || !('speechSynthesis' in window)}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-indigo-50 p-4 font-bold text-indigo-700 disabled:opacity-50">
          <Headphones size={22}/> {listenCount < 2 ? 'Escuchar audio' : 'Dos reproducciones realizadas'}
        </button>
        <p className="text-center text-xs text-slate-500">Reproducciones: {listenCount}/2 · Voz francesa del dispositivo</p>
        {paper.listening.questions.map((question,i) => <div key={i} className="space-y-2 border-t border-slate-100 pt-4">
          <p className="font-semibold leading-relaxed text-slate-900">{i+1}. {question.prompt}</p>
          {question.options.map((option,j) => <label key={j} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm',
              answers.listening[i]===j ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white')}>
            <input type="radio" name={'listen'+i} checked={answers.listening[i]===j} onChange={() => changeOption('listening',i,j)}
              className="mt-1 accent-indigo-600"/><span>{String.fromCharCode(65+j)}. {option}</span>
          </label>)}
        </div>)}
      </div>}
      {step === 1 && <div className="mt-6 space-y-5">
        <p className="text-sm text-slate-600">Lee atentamente y responde a las preguntas.</p>
        <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-serif text-base leading-relaxed text-slate-800 sm:p-5">{paper.reading.passage}</div>
        {paper.reading.questions.map((question,i) => <div key={i} className="space-y-2 border-t border-slate-100 pt-4">
          <p className="font-semibold leading-relaxed text-slate-900">{i+1}. {question.prompt}</p>
          {question.options.map((option,j) => <label key={j} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm',
              answers.reading[i]===j ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white')}>
            <input type="radio" name={'read'+i} checked={answers.reading[i]===j} onChange={() => changeOption('reading',i,j)}
              className="mt-1 accent-indigo-600"/><span>{String.fromCharCode(65+j)}. {option}</span>
          </label>)}
        </div>)}
      </div>}
      {step === 2 && <div className="mt-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Rédaction</p>
        <p className="rounded-xl bg-slate-50 p-4 font-semibold leading-relaxed text-slate-900">{paper.writing_prompt}</p>
        <label htmlFor="exam-writing" className="block text-sm font-bold text-slate-700">Tu respuesta en francés</label>
        <textarea id="exam-writing" value={answers.writing} onChange={e => setAnswers(v=>({...v,writing:e.target.value}))}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"
          maxLength={5000} rows={8} placeholder="Rédigez votre réponse ici..."
          className="w-full rounded-xl border border-slate-200 p-4 leading-relaxed text-slate-900 focus:border-indigo-500 focus:outline-none"/>
        <p className="text-right text-xs text-slate-500">{answers.writing.trim()?answers.writing.trim().split(/\s+/).length:0} palabras</p>
      </div>}
      {step === 3 && <div className="mt-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Expression orale</p>
        <p className="rounded-xl bg-slate-50 p-4 font-semibold leading-relaxed text-slate-900">{paper.speaking_prompt}</p>
        <p className="text-sm leading-relaxed text-slate-600">Habla en francés durante aproximadamente 45–80 segundos. El audio se envía para transcribirlo y no se conserva en Parole.</p>
        {recording ? <button type="button" onClick={stopRecording}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 p-4 font-bold text-white">
          <Square size={18}/> Detener grabación
        </button> : <button type="button" disabled={transcribing || busy} onClick={() => void startRecording()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-4 font-bold text-white disabled:opacity-50">
          {transcribing ? <Loader2 size={19} className="animate-spin"/> : <Mic size={19}/>}
          {transcribing ? 'Transcribiendo audio...' : answers.speaking_mode === 'audio' ? 'Volver a grabar' : 'Grabar respuesta oral'}
        </button>}
        {answers.speaking_mode === 'audio' && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-800">Respuesta oral registrada</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{answers.speaking}</p>
          <p className="mt-2 text-xs text-slate-600">La nota oral evalúa vocabulario, gramática y contenido de esta transcripción, no pronunciación ni fluidez acústica.</p>
        </div>}
        {answers.speaking_mode !== 'audio' && !recording && !transcribing &&
          <p className="text-xs text-slate-500">Puedes finalizar sin grabación; la parte oral quedará sin evaluar (0/25).</p>}
      </div>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="mt-7 flex items-center gap-3 border-t border-slate-100 pt-5">
        <button type="button" disabled={step === 0 || busy || recording || transcribing}
          onClick={() => { window.speechSynthesis?.cancel(); setStep(v=>Math.max(0,v-1)); setError('') }}
          className="flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 font-semibold text-slate-700 disabled:opacity-35">
          <ArrowLeft size={17}/> Atrás
        </button>
        {step < 3 ? <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setStep(v=>Math.min(3,v+1));setError('') }}
          className="ml-auto flex min-h-12 items-center gap-2 rounded-xl bg-indigo-600 px-5 font-bold text-white">
          Siguiente <ArrowRight size={17}/>
        </button> : <button type="button" onClick={() => void finish()} disabled={busy || recording || transcribing}
          className="ml-auto flex min-h-12 items-center gap-2 rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
          {busy ? 'Corrigiendo...' : 'Entregar examen'}
        </button>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>Tu borrador se guarda en este dispositivo mientras realizas el examen.</span>
        <span className="flex shrink-0 items-center gap-3">
          <button type="button" disabled={busy || recording || transcribing} onClick={() => void abandon()}
            className="font-semibold text-rose-700 underline disabled:opacity-50">Abandonar</button>
          <button type="button" onClick={onExit} className="font-semibold text-indigo-700 underline">Salir</button>
        </span>
      </div>
    </div>
  </section>
}
