import './App.css';
import {Player} from './object.js'
import Canvas from './canvas.js'
import {map} from './map.js'
import React from 'react'
import useInterval from '@use-it/interval'
import frameUpdate from './frameUpdater.js'

map.deleteAll()
var player = new Player("James");
const fps = 30;

function App() {
  var pressedKeys = {};

  function handleKeyDown(event){
    pressedKeys[event.key] = true;
  } 
  function handleKeyUp(event){
    delete pressedKeys[event.key]
  } 

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',handleKeyUp)
    map.addPlayer(player);
    // cleanup this component
    return () => {
      console.log('removing keyboard')
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',handleKeyUp)
      map.deletePlayer(player);
    };
  }, []);

  useInterval(()=>{frameUpdate(player,pressedKeys)},1000/fps)

  return (
    <body className = "center">
      <div className="App">
        <header className="App-header">
          <Canvas id="gameboard" width="1200" height="1200" player={player} />
        </header>
      </div>
    </body>
  );
}


export default App;
