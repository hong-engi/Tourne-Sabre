import { useEffect, useRef } from 'react'
import draw from './mapdraw.js'

export default function Canvas({ game, ...props }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const keyDown = event => game.setKey(event.key, true)
    const keyUp = event => game.setKey(event.key, false)
    const releaseKeys = () => game.setKeys(0)

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', releaseKeys)
    document.addEventListener('visibilitychange', releaseKeys)

    const ctx = canvasRef.current.getContext('2d')
    let frame
    if (ctx) {
      const render = now => {
        draw(ctx, game.renderState(now))
        frame = window.requestAnimationFrame(render)
      }
      frame = window.requestAnimationFrame(render)
    }

    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', releaseKeys)
      document.removeEventListener('visibilitychange', releaseKeys)
      window.cancelAnimationFrame(frame)
    }
  }, [game])

  return <canvas ref={canvasRef} {...props} />
}
