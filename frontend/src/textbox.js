import React,{useState} from "react"
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from  '@mui/material/Divider';
import {TextField} from "@material-ui/core"
import {makePlayer} from "./canvas.js"

export function Textbox({myref}){

  const [name, setName] = useState('')

  function onClick(){
    makePlayer(name)
    vanishThis()
  }

  const [vanishFlag, setVanishFlag] = useState(false);

  function vanishThis(){
    setVanishFlag(true)
  }

  function appearThis(){
    setVanishFlag(false)
  }

  myref.current.appearThis = appearThis
  
  return (<div>{ !vanishFlag && <Box
      component="form"
      sx={{
        width:1000,
        height:1000,
        '& .MuiTextField-root': { m: 1, width: '25ch' },
      }}
      noValidate
      autoComplete="off"
    >
      <div className='center'>
        <Box
          component="form"
          sx={{
            backgroundColor: 'white',
          }}
        >
          <Stack divider={<Divider orientation="vertical" flexItem />}direction="row">
            <TextField id="outlined-basic" 
            label="Enter name" variant="outlined" 
            onChange = {(event)=>{setName(event.target.value)}}/>

            <Box sx={{ mx: "auto",width:72}}>
              <Button variant="outlined"
              style={{ 
                backgroundColor: 'rgba(200,200,255,0.5)',
                minWidth:72,
                minHeight:72,
                maxWidth:72,
                maxHeight:72
              }}
              onClick = {onClick}>
                ENTER
              </Button>
            </Box>

          </Stack>
        </Box>
      </div>
    </Box>
  }</div>
  )
}