import { useRef, useEffect } from 'react'
import {Player} from './object.js'
import draw from './mapdraw.js'
import {map} from './map.js'
import useInterval from '@use-it/interval'
import frameUpdate from './frameUpdater.js'
import socketIOClient from "socket.io-client";

const socket = socketIOClient("http://localhost:8081", {  
  cors: {
  origin: "http://localhost:8081",
  credentials: true},
  transports : ['websocket']} 
);

var player = null
const makePlayer = (name) => {
  player = new Player(name);
  map.addPlayer(player);
  socket.emit("newplayer",player.id)
}

function death(myref){
  player=null
  myref.current.appearThis()
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

  useInterval(()=>{if(player)frameUpdate(player,pressedKeys,props.myref);},1000/fps)

  useEffect(() => {
  
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationFrameId
    
    const render = () => {
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