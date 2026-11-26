import { useEffect, useRef } from 'react'
import { canvasSize, draw } from './mapdraw.js'

export default function Canvas({ game, playing }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return undefined
    if (!playing) {
      draw(ctx, null)
      return undefined
    }

    const keyDown = event => game.setKey(event.key, true)
    const keyUp = event => game.setKey(event.key, false)
    const releaseKeys = () => game.setKeys(0)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', releaseKeys)
    document.addEventListener('visibilitychange', releaseKeys)

    function render(now) {
      draw(ctx, game.renderState(now))
      frame = requestAnimationFrame(render)
    }
    let frame = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', releaseKeys)
      document.removeEventListener('visibilitychange', releaseKeys)
      cancelAnimationFrame(frame)
      releaseKeys()
    }
  }, [game, playing])

  return <canvas ref={canvasRef} id="gameboard" aria-label="Game board"
    width={canvasSize} height={canvasSize} />
}
