import {useNavigate} from 'react-router-dom';
import {usePlayerInfo} from '../../hooks/usePlayerInfo';
import {useSocket} from '../../hooks/useSocket';
import {useAlert} from '../../context/AlertContext';

export function ExitButton() {
  const navigate = useNavigate();
  const { clearPlayerInfo } = usePlayerInfo();
  const { emit } = useSocket();
  const { confirm } = useAlert();

  const handleExit = async () => {
    const confirmed = await confirm({
      message: 'are you sure you want to leave the game?',
      variant: 'warning',
      confirmText: 'bye',
    });
    if (confirmed) {
      // Explicitly notify server that player is leaving
      emit('leaveGame');

      // Clear local state and navigate
      clearPlayerInfo();
      navigate('/');
    }
  };

  return (
    <button
      onClick={handleExit}
      className="button is-info is-small exit-button-fixed"
      data-tooltip-id="tooltip"
      data-tooltip-content="Exit to home"
    >
      ← Exit
    </button>
  );
}
