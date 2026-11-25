import { useEffect, useState } from 'react'
import './App.css'
import Canvas from './canvas.js'
import GameClient from './gameClient.js'
import { Textbox } from './textbox.js'

export default function App() {
  const [game] = useState(() => new GameClient())
  const [status, setStatus] = useState({ phase: 'connecting', message: '' })

  useEffect(() => game.connect(setStatus), [game])

  return (
    <div className="center">
      <div className="above" id="entername">
        <Textbox status={status} onJoin={name => game.join(name)} />
      </div>
      <header className="App-header">
        <Canvas game={game} id="gameboard" width="1000" height="1000" />
      </header>
    </div>
  )
}
