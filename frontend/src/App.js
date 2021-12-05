import './App.css';
import Canvas from './canvas.js'
import React,{useEffect} from 'react'
import {map} from './map.js'
import {Textbox} from './textbox.js'
//map.deleteAll()

function App() {

  const myRef = React.useRef({})

  return (
    <body className = "center">
      <div className = "above" id = 'entername'>
        <Textbox myRef = {myRef}/>
      </div>
      <header className="App-header">
        <Canvas myRef = {myRef} id="gameboard" width="1000" height="1000"/>
      </header>
    </body>
  );
}


export default App;
