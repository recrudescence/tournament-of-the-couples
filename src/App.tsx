import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import { JoinPage } from './pages/JoinPage';
import { LobbyPage } from './pages/LobbyPage';
import { HostPage } from './pages/HostPage';
import { PlayerPage } from './pages/PlayerPage';

export function App() {
  return (
    <SocketProvider>
      <GameProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<JoinPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/host" element={<HostPage />} />
            <Route path="/player" element={<PlayerPage />} />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </SocketProvider>
  );
}
