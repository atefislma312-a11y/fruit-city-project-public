import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import './index.css';
import {LoginGate} from './components/auth/LoginGate';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LoginGate><AppProvider>
      <App />
    </AppProvider></LoginGate>
  </React.StrictMode>
);
