import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Tooltip } from 'react-tooltip';
import { App } from './App';
// import 'bulma/css/bulma.min.css';
import 'bulma/css/versions/bulma-no-dark-mode.min.css';
import 'react-tooltip/dist/react-tooltip.css';
import './styles/themes.css';
import './styles/global.css';
// Initialize theme before render (side effect in useTheme.ts)
import './hooks/useTheme';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
    <Tooltip
      id="tooltip"
      className="app-tooltip"
      place="top"
      delayShow={300}
    />
  </StrictMode>
);
