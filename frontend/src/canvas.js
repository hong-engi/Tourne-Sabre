import { useRef, useEffect } from 'react'
import {Player} from './object.js'
import draw from './mapdraw.js'
import {map} from './map.js'
import ReactDOM from 'react-dom'
import useInterval from '@use-it/interval'
import {Textbox} from './textbox.js'
import frameUpdate from './frameUpdater.js'

var player = null
const makePlayer = (name) => {
  player = new Player(name);
  map.addPlayer(player);
}

var cnt = 0
function death(myRef){
  player=null
  myRef.current.appearThis()
}

const Canvas = props => {
  const canvasRef = useRef(null)
  const fps = 30;
  var pressedKeys = {};

  function handleKeyDown(event){
    pressedKeys[event.key] = true;
  } 
  function handleKeyUp(event){
    delete pressedKeys[event.key]
  } 

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',handleKeyUp)
    return () => {
      console.log('removing keyboard')
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',handleKeyUp)
    };
  }, []);

  useInterval(()=>{if(player)frameUpdate(player,pressedKeys,props.myRef);},1000/fps)

  useEffect(() => {
  
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let frameCount = 0
    let animationFrameId
    
    const render = () => {
      frameCount++;
      draw(ctx, player)
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
export {makePlayer,death}