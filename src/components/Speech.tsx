"use client"

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Settings2, Volume2, X } from 'lucide-react'

type PlaybackMode = 'neural' | 'device'
type VoiceGender = 'female' | 'male'
type PlaybackSpeed = 0.75 | 1 | 1.25
type AudioPreferences = { mode: PlaybackMode; voice: VoiceGender; speed: PlaybackSpeed }

const PREFS_KEY = 'parole_audio_preferences_v1'
const SESSION_KEY = 'parole_session_v1'
const FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/parole-api'
  : ''
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const DEFAULT_PREFERENCES: AudioPreferences = { mode: 'neural', voice: 'female', speed: 1 }

// Replaying a sentence, even at another speed, reuses its audio.
// Cloud caching is separately handled by the authenticated Edge Function.
const generatedUrls = new Map<string, string>()
let currentPlayer: HTMLAudioElement | null = null
let currentRequest: AbortController | null = null
let audioContext: AudioContext | null = null
let webAudioSource: AudioBufferSourceNode | null = null

function unlockWebAudio(): void {
  // Safari can reject audio.play() when a network request has elapsed since
  // the tap. Unlock an AudioContext synchronously inside the original tap.
  if (typeof AudioContext === 'undefined') return
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext()
  if (audioContext.state !== 'running') void audioContext.resume().catch(() => {})
}

async function webAudioFallback(url: string, speed: number): Promise<void> {
  if (!audioContext) throw new Error('El audio no está disponible')
  if (audioContext.state !== 'running') await audioContext.resume()
  const response = await fetch(url)
  const buffer = await audioContext.decodeAudioData(await response.arrayBuffer())
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = speed
  source.connect(audioContext.destination)
  webAudioSource = source
  source.onended = () => { if (webAudioSource === source) webAudioSource = null }
  source.start(0)
}

function preferences(): AudioPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return DEFAULT_PREFERENCES
    const value = stored as Partial<AudioPreferences>
    return {
      mode: value.mode === 'device' ? 'device' : 'neural',
      voice: value.voice === 'male' ? 'male' : 'female',
      speed: [0.75, 1, 1.25].includes(Number(value.speed)) ? value.speed as PlaybackSpeed : 1
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function stopAudio(): void {
  currentRequest?.abort()
  currentRequest = null
  if (currentPlayer) {
    currentPlayer.pause()
    currentPlayer = null
  }
  if (webAudioSource) {
    try { webAudioSource.stop() } catch { /* Already stopped. */ }
    webAudioSource = null
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

function deviceSpeech(text: string, locale: string, rate: number): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = locale
  utterance.rate = rate
  const exactVoices = window.speechSynthesis.getVoices()
  const voice = exactVoices.find(v => v.lang.toLowerCase() === locale.toLowerCase())
    ?? exactVoices.find(v => v.lang.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()))
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

async function neuralSpeech(text: string, locale: string, voice: string, signal: AbortSignal): Promise<string> {
  const key = JSON.stringify([text.trim(), locale, voice])
  const saved = generatedUrls.get(key)
  if (saved) return saved

  if (!FUNCTION_URL || !PUBLIC_KEY) throw new Error('Falta la configuración de Supabase')
  const response = await fetch(FUNCTION_URL + '?action=speech', {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'apikey': PUBLIC_KEY,
      'x-parole-session': localStorage.getItem(SESSION_KEY) ?? ''
    },
    body: JSON.stringify({ text, locale, voice })
  })
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null)
    const reason = result && typeof result === 'object' && 'error' in result
      ? String((result as { error: unknown }).error)
      : 'Error del servicio de voz'
    throw new Error(reason)
  }
  const blob = await response.blob()
  if (!blob.size || !blob.type.startsWith('audio/')) throw new Error('La respuesta de audio no es válida')
  if (signal.aborted) throw new DOMException('Operación cancelada', 'AbortError')
  const url = URL.createObjectURL(blob)
  generatedUrls.set(key, url)
  if (generatedUrls.size > 40) {
    const oldestKey = generatedUrls.keys().next().value
    if (oldestKey && oldestKey !== key) {
      const oldUrl = generatedUrls.get(oldestKey)
      generatedUrls.delete(oldestKey)
      if (oldUrl && currentPlayer?.src !== oldUrl) URL.revokeObjectURL(oldUrl)
    }
  }
  return url
}

export function SpeakButton({ text, lang = 'fr-FR', label = 'Escuchar en francés' }: {
  text: string; lang?: string; label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState('')

  useEffect(() => () => {
    // Stop audio when moving to the next sentence or leaving the panel.
    if (currentPlayer) {
      currentPlayer.pause()
      currentPlayer = null
    }
  }, [])

  const speak = async () => {
    stopAudio()
    setWarning('')
    const config = preferences()
    if (config.mode === 'device') {
      deviceSpeech(text, lang, config.speed)
      return
    }
    // Required inside the button's original gesture for iPad/iPhone Safari.
    unlockWebAudio()
    const controller = new AbortController()
    currentRequest = controller
    setBusy(true)
    try {
      const voice = config.voice === 'male' ? 'cedar' : 'marin'
      const url = await neuralSpeech(text, lang, voice, controller.signal)
      if (controller.signal.aborted) return
      const player = new Audio(url)
      currentPlayer = player
      player.playbackRate = config.speed
      player.preservesPitch = true
      player.onended = () => { if (currentPlayer === player) currentPlayer = null }
      try {
        await player.play()
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') throw error
        // A network wait may lose the original user activation on Safari.
        // The unlocked AudioContext can reproduce the cached file without
        // asking for another OpenAI generation.
        currentPlayer = null
        await webAudioFallback(url, config.speed)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const reason = error instanceof Error ? error.message : 'Error desconocido'
        setWarning('La voz neuronal no está disponible (' + reason + '). Se ha usado la voz del dispositivo.')
        deviceSpeech(text, lang, config.speed)
      }
    } finally {
      if (currentRequest === controller) currentRequest = null
      setBusy(false)
    }
  }

  return <span className="relative inline-flex shrink-0 items-center">
    <button type="button" disabled={busy} onClick={() => void speak()} title={warning || label} aria-label={warning || (label + ': ' + text)}
      className={warning
        ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100'
        : 'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100'}>
      {busy ? <Loader2 size={19} className="animate-spin" /> : warning ? <AlertTriangle size={19} /> : <Volume2 size={19} />}
    </button>
    {warning && <span className="sr-only" role="status">{warning}</span>}
  </span>
}

export function AudioSettingsControl() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<AudioPreferences>(DEFAULT_PREFERENCES)
  useEffect(() => { setConfig(preferences()) }, [])

  const update = (changes: Partial<AudioPreferences>) => {
    const next = { ...config, ...changes }
    setConfig(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* Device may block storage. */ }
    stopAudio()
  }

  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Ajustes de audio"
      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:px-3">
      <Settings2 size={18} /><span className="hidden sm:inline">Audio</span>
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(90vw,320px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" role="group" aria-label="Preferencias de audio">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-extrabold text-slate-900">Audio de las frases</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar ajustes de audio" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={17}/></button>
      </div>
      <label htmlFor="audio-mode" className="mb-1 block text-xs font-bold text-slate-700">Calidad de voz</label>
      <select id="audio-mode" value={config.mode} onChange={event => update({ mode: event.target.value as PlaybackMode })}
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
        <option value="neural">Neuronal (OpenAI)</option>
        <option value="device">Gratuita (dispositivo)</option>
      </select>
      <label htmlFor="audio-voice" className="mb-1 block text-xs font-bold text-slate-700">Voz</label>
      <select id="audio-voice" value={config.voice} onChange={event => update({ voice: event.target.value as VoiceGender })}
        disabled={config.mode === 'device'}
        className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:opacity-50">
        <option value="female">Femenina · Marin</option>
        <option value="male">Masculina · Cedar</option>
      </select>
      <label htmlFor="audio-speed" className="mb-1 block text-xs font-bold text-slate-700">Velocidad</label>
      <select id="audio-speed" value={String(config.speed)} onChange={event => update({ speed: Number(event.target.value) as PlaybackSpeed })}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900">
        <option value="0.75">0,75× · Lenta</option>
        <option value="1">1× · Normal</option>
        <option value="1.25">1,25× · Rápida</option>
      </select>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Las voces neuronales están generadas por IA y necesitan Internet la primera vez. Cada frase y voz se guarda en una caché privada para repetirla sin nuevas generaciones de pago.
      </p>
    </div>}
  </div>
}
