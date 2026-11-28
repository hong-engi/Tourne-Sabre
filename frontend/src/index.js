import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import EnemyLab from './EnemyLab';
import reportWebVitals from './reportWebVitals';

ReactDOM.render(
  <React.StrictMode>
    {/* ?lab opens the enemy lab (bestiary + notes) instead of the game. */}
    {new URLSearchParams(window.location.search).has('lab') ? <EnemyLab /> : <App />}
  </React.StrictMode>,
  document.getElementById('root')
);
reportWebVitals();
