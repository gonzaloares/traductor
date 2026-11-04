"use client"

import { useEffect, useRef, useState } from 'react'
import { Headphones, Loader2, Square, Volume2 } from 'lucide-react'
import type { Language, Level } from '@/lib/types'

type ExamAudioStatus = 'idle' | 'preparing' | 'playing'
type Plan = { segments: number; speakers: number }

const FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/parole-api' : ''
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SESSION_KEY = 'parole_session_v1'
const AUDIO_PREF_KEY = 'parole_audio_preferences_v1'

function preferredSpeed(): number {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(AUDIO_PREF_KEY) ?? 'null')
    if (saved && typeof saved === 'object' && 'speed' in saved &&
        [0.75, 1, 1.25].includes(Number((saved as { speed: unknown }).speed))) {
      return Number((saved as { speed: number }).speed)
    }
  } catch { /* Local storage may be blocked */ }
  return 1
}

async function postExamAudio(action: string, data: unknown, signal: AbortSignal): Promise<Response> {
  if (!FUNCTION_URL || !PUBLIC_KEY) throw new Error('Falta la configuración de Supabase.')
  const response = await fetch(FUNCTION_URL + '?action=' + action, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'apikey': PUBLIC_KEY,
      'x-parole-session': localStorage.getItem(SESSION_KEY) ?? ''
    },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null)
    throw new Error(error && typeof error === 'object' && 'error' in error
      ? String((error as { error: unknown }).error)
      : 'No se ha podido preparar el audio del examen.')
  }
  return response
}

type Props = {
  examId: string
  language: Language
  level: Level
  transcript: string
  listens: number
  onCompleted: () => void
}

export function ExamListeningAudio({ examId, language, level, transcript, listens, onCompleted }: Props) {
  const [status, setStatus] = useState<ExamAudioStatus>('idle')
  const [error, setError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalSegments, setTotalSegments] = useState(0)
  const audioContext = useRef<AudioContext | null>(null)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const controller = useRef<AbortController | null>(null)
  const runId = useRef(0)
  // The browser cache allows the two exam replays without another download,
  // and the server's private Supabase Storage cache avoids another OpenAI call.
  const clips = useRef(new Map<number, Promise<ArrayBuffer>>())

  const stop = () => {
    runId.current += 1
    controller.current?.abort()
    controller.current = null
    if (source.current) {
      const previous = source.current
      source.current = null
      try { previous.stop() } catch { /* Already stopped */ }
    }
    window.speechSynthesis?.cancel()
    setStatus('idle')
    setCurrentIndex(0)
  }

  useEffect(() => () => {
    runId.current += 1
    controller.current?.abort()
    if (source.current) {
      try { source.current.stop() } catch { /* Already stopped */ }
    }
    window.speechSynthesis?.cancel()
    void audioContext.current?.close()
  }, [examId])

  const playDevice = () => {
    if (!('speechSynthesis' in window)) {
      setError('Este dispositivo no permite reproducir audio. Prueba otro navegador.')
      return
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(transcript)
    utterance.lang = language === 'fr' ? 'fr-FR' : 'en-GB'
    utterance.rate = preferredSpeed()
    const locale = utterance.lang.toLowerCase()
    const voice = synth.getVoices().find(v => v.lang.toLowerCase() === locale)
      ?? synth.getVoices().find(v => v.lang.toLowerCase().startsWith(language))
    if (voice) utterance.voice = voice
    const run = ++runId.current
    setStatus('playing')
    utterance.onend = () => {
      if (run === runId.current) { setStatus('idle'); onCompleted() }
    }
    utterance.onerror = () => {
      if (run === runId.current) {
        setStatus('idle')
        setError('No se ha podido reproducir el audio del dispositivo. Activa la voz neuronal en los ajustes.')
      }
    }
    synth.speak(utterance)
  }

  const start = () => {
    if (status !== 'idle' || listens >= 2) return
    setError('')
    const run = ++runId.current
    const abort = new AbortController()
    controller.current = abort

    // Unlock Web Audio while the original tap still has user activation;
    // this is essential on iOS Safari after awaiting network responses.
    let context: AudioContext
    try {
      context = audioContext.current ?? new AudioContext()
      audioContext.current = context
      void context.resume().catch(() => {})
    } catch {
      playDevice()
      return
    }
    setStatus('preparing')

    const fetchClip = (index: number): Promise<ArrayBuffer> => {
      const previous = clips.current.get(index)
      if (previous) return previous
      const promise = postExamAudio('mini-exam-audio-segment', { examId, index }, abort.signal)
        .then(async response => {
          const mime = response.headers.get('Content-Type') ?? ''
          if (!mime.includes('audio/')) throw new Error('El servidor no ha devuelto un audio válido.')
          const bytes = await response.arrayBuffer()
          if (!bytes.byteLength) throw new Error('El audio está vacío.')
          return bytes
        })
        .catch(e => { clips.current.delete(index); throw e })
      clips.current.set(index, promise)
      return promise
    }

    const playSegment = async (index: number, total: number): Promise<void> => {
      try {
        const data = await fetchClip(index)
        if (runId.current !== run || abort.signal.aborted) return
        if (context.state !== 'running') await context.resume()
        // decodeAudioData may detach its input: keep the original for replay.
        const buffer = await context.decodeAudioData(data.slice(0))
        if (runId.current !== run || abort.signal.aborted) return
        const node = context.createBufferSource()
        node.buffer = buffer
        node.playbackRate.value = preferredSpeed()
        node.connect(context.destination)
        source.current = node
        setStatus('playing')
        setCurrentIndex(index + 1)
        node.onended = () => {
          if (runId.current !== run || abort.signal.aborted) return
          source.current = null
          if (index + 1 === total) {
            setStatus('idle')
            setCurrentIndex(0)
            controller.current = null
            onCompleted()
          } else void playSegment(index + 1, total)
        }
        node.start(0)
        // Download subsequent clips while this speaker is talking, to
        // minimize pauses on mobile connections without prepaying the exam.
        if (index + 1 < total) void fetchClip(index + 1).catch(() => {})
        if (index + 2 < total) void fetchClip(index + 2).catch(() => {})
      } catch (problem) {
        if (runId.current !== run || abort.signal.aborted) return
        stop()
        setError((problem instanceof Error ? problem.message : 'No se ha podido reproducir el audio.') +
          ' No se ha descontado ninguna reproducción; puedes intentarlo de nuevo.')
      }
    }

    void (async () => {
      try {
        const response = await postExamAudio('mini-exam-audio-plan', { examId }, abort.signal)
        const plan: unknown = await response.json()
        if (!plan || typeof plan !== 'object' ||
            !('segments' in plan) || !Number.isInteger((plan as Plan).segments) ||
            (plan as Plan).segments < 1 || (plan as Plan).segments > 24)
          throw new Error('La estructura del audio no es válida.')
        if (runId.current !== run || abort.signal.aborted) return
        const count = (plan as Plan).segments
        setTotalSegments(count)
        await playSegment(0, count)
      } catch (problem) {
        if (runId.current !== run || abort.signal.aborted) return
        stop()
        setError((problem instanceof Error ? problem.message : 'El audio no está disponible.') +
          ' Puedes reintentar sin perder ninguna reproducción.')
      }
    })()
  }

  return <div className="space-y-2">
    <button type="button" onClick={status === 'playing' ? stop : start}
      disabled={listens >= 2 || status === 'preparing'}
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-indigo-50 p-4 font-bold text-indigo-700 disabled:opacity-50">
      {status === 'preparing' ? <Loader2 size={22} className="animate-spin" />
        : status === 'playing' ? <Square size={20} /> : <Headphones size={22} />}
      {status === 'preparing' ? 'Preparando voces naturales…'
        : status === 'playing' ? 'Detener reproducción'
        : listens >= 2 ? 'Dos reproducciones realizadas'
        : listens === 1 ? 'Escuchar por segunda vez' : 'Escuchar audio'}
    </button>
    <p className="text-center text-xs text-slate-500">
      Reproducciones completas: {listens}/2
      {status === 'playing' && totalSegments > 1 ? ' · Fragmento ' + currentIndex + '/' + totalSegments : ''}
      {' · '}Voces IA diferentes por personaje y emoción · {language === 'en' ? 'inglés británico' : 'francés de Francia'}
    </p>
    {error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
      {error}
    </p>}
    <p className="text-center text-[11px] leading-relaxed text-slate-500">
      La primera escucha puede necesitar generar los fragmentos. Las siguientes utilizan los audios almacenados.
      La transcripción permanece oculta hasta finalizar.
    </p>
  </div>
}
