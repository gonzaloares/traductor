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
