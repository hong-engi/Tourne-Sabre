import './App.css';
import {Player} from './object.js'
import Canvas from './canvas.js'

var player = new Player("James");

function App() {
  return (
    <body className = "center">
      <div className="App">
        <header className="App-header">
          <Canvas id="gameboard" width="1200" height="1200" player={player}/>
        </header>
      </div>
    </body>
  );
}


export default App;
