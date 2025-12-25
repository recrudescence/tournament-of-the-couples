import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// import 'bulma/css/bulma.min.css';
import 'bulma/css/versions/bulma-no-dark-mode.min.css';
import './styles/christmas-theme.css';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
