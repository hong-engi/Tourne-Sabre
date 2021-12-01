import React, { useRef, useEffect } from 'react'
import draw from './mapdraw.js'

const Canvas = props => {

  const canvasRef = useRef(null)

  useEffect(() => {
  
  const canvas = canvasRef.current
  const ctx = canvas.getContext('2d')
  let frameCount = 0
  let animationFrameId
  
  const render = () => {
    frameCount++;
    props.player.sw_angle+=props.player.sw_speed;
    draw(ctx, props.player)
    animationFrameId = window.requestAnimationFrame(render)
  }
  render()
  
    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [draw])
  
  return <canvas ref={canvasRef} {...props}/>
}

export default Canvas