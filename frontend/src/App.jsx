import { useEffect, useState } from 'react'
import Canvas from './Canvas.jsx'
import GameClient from './gameClient.js'
import JoinForm from './JoinForm.jsx'
import './App.css'

export default function App() {
  const [game] = useState(() => new GameClient())
  const [status, setStatus] = useState({ phase: 'connecting', message: '' })

  useEffect(() => game.connect(setStatus), [game])

  return (
    <main className="arena">
      <Canvas game={game} playing={status.phase === 'playing'} />
      <JoinForm status={status} onJoin={name => game.join(name)} />
    </main>
  )
}
