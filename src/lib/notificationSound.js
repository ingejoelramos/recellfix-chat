let audioCtx = null

function getContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// Pequeño "ding-dong" de dos tonos, sintetizado con Web Audio API
// (sin depender de un archivo de audio externo).
export function playNotificationSound() {
  try {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    function tone(freq, start, duration) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.22, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + duration + 0.05)
    }

    tone(880, 0, 0.12)
    tone(1175, 0.1, 0.18)
  } catch (err) {
    console.error('No se pudo reproducir el sonido de notificación:', err)
  }
}

// Los navegadores bloquean audio hasta que hay una interacción del usuario.
// Llamar esto una vez en el primer clic/tecla "desbloquea" el AudioContext
// para el resto de la sesión.
export function unlockAudio() {
  getContext()
}
