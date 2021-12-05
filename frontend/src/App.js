import './App.css';
import Canvas from './canvas.js'
import React,{useEffect} from 'react'
import {map} from './map.js'
import {Textbox} from './textbox.js'

function App() {

  const myref = React.useRef({})

  return (
    <body className = "center">
      <div className = "above" id = 'entername'>
        <Textbox myref = {myref}/>
      </div>
      <header className="App-header">
        <Canvas myref = {myref} id="gameboard" width="1000" height="1000"/>
      </header>
    </body>
  );
}


export default App;
