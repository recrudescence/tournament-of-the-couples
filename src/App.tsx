import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import { AlertProvider } from './context/AlertContext';
import { JoinPage } from './pages/JoinPage';
import { GamePage } from './pages/GamePage';

export function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <AlertProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<JoinPage />} />
              <Route path="/join" element={<JoinPage />} />
              <Route path="/game" element={<GamePage />} />
            </Routes>
          </BrowserRouter>
        </AlertProvider>
      </GameProvider>
    </SocketProvider>
  );
}
