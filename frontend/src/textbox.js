import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import { TextField } from '@material-ui/core'

export function Textbox({ status, onJoin }) {
  const [name, setName] = useState('')
  if (status.phase === 'playing') return null

  const disabled = status.phase !== 'ready'
  const label = status.phase === 'joining' ? 'Joining…' : 'ENTER'
  const message = status.message ||
    (status.phase === 'connecting' ? 'Connecting to game server…' : '')

  return (
    <Box
      component="form"
      sx={{ width: 1000, height: 1000 }}
      onSubmit={event => {
        event.preventDefault()
        if (!disabled) onJoin(name)
      }}
    >
      <div className="center">
        <Box sx={{ backgroundColor: 'white', p: 1 }}>
          <Stack spacing={1} direction="row">
            <TextField
              id="outlined-basic"
              label="Enter name"
              variant="outlined"
              value={name}
              onChange={event => setName(event.target.value)}
              inputProps={{ maxLength: 40 }}
            />
            <Button type="submit" variant="outlined" disabled={disabled}>
              {label}
            </Button>
          </Stack>
          {message && <div role="status">{message}</div>}
        </Box>
      </div>
    </Box>
  )
}
