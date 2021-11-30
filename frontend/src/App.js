import logo from './logo.svg';
import './App.css';
import draw from './mapdraw.js'
import {Player} from './player.js'

var player = new Player("James");

function App() {
  return (
    <div className="App">
      <header className="App-header">
        {/* <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p> */}
        {/* <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a> */}
        <body class = "center">
          <canvas id="gameboard" width="1200" height="1200"></canvas>
        </body>
      </header>
    </div>
  );
}

window.onload = function() {
  draw(player)
}

export default App;
