import { useNavigate } from 'react-router-dom';
import { usePlayerInfo } from '../../hooks/usePlayerInfo';

export function ExitButton() {
  const navigate = useNavigate();
  const { clearPlayerInfo } = usePlayerInfo();

  const handleExit = () => {
    if (window.confirm('Are you sure you want to leave the game?')) {
      clearPlayerInfo();
      navigate('/');
    }
  };

  return (
    <button
      onClick={handleExit}
      className="button is-info is-small"
      style={{
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
      title="Exit to home"
    >
      ← Exit
    </button>
  );
}
