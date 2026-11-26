import { useState } from 'react'

export default function JoinForm({ status, onJoin }) {
  const [name, setName] = useState('')
  if (status.phase === 'playing') return null

  const disabled = status.phase !== 'ready'
  const message = status.message ||
    (status.phase === 'connecting' ? 'Connecting to game server…' : '')

  return (
    <div className="join-overlay">
      <form className="join-form" onSubmit={event => {
        event.preventDefault()
        if (!disabled) onJoin(name)
      }}>
        <div className="join-fields">
          <label>
            Enter name
            <input name="playerName" value={name} maxLength={40} autoComplete="off"
              onChange={event => setName(event.target.value)} />
          </label>
          <button type="submit" disabled={disabled}>
            {status.phase === 'joining' ? 'Joining…' : 'ENTER'}
          </button>
        </div>
        {message && <p role="status">{message}</p>}
      </form>
    </div>
  )
}
