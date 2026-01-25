import { PlayerAvatar } from '../common/PlayerAvatar';
import type { PlayerAvatar as PlayerAvatarType } from '../../types/game';

// Try to parse JSON answer (for dual answer mode)
function parseAnswer(answer: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(answer);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

interface SubmittedStatusProps {
  submittedAnswer: string;
  partnerName: string | null;
  partnerAvatar: PlayerAvatarType | null;
  partnerSubmitted: boolean;
  totalAnswersCount: number;
  totalPlayersCount: number;
}

export function SubmittedStatus({
  submittedAnswer,
  partnerName,
  partnerAvatar,
  partnerSubmitted,
  totalAnswersCount,
  totalPlayersCount
}: SubmittedStatusProps) {
  const parsedAnswer = parseAnswer(submittedAnswer);

  return (
    <div className="box">
      <h2 className="subtitle is-4 has-text-success mb-4">Answer Submitted!</h2>
      <div className="notification is-success is-light mb-4">
        <p className="has-text-weight-semibold mb-2">You said:</p>
        {parsedAnswer ? (
          <div>
            {Object.entries(parsedAnswer).map(([name, answer]) => (
              <p key={name} className="is-size-6 mb-1">
                <strong>{name}:</strong> {answer}
              </p>
            ))}
          </div>
        ) : (
          <p className="is-size-5">{submittedAnswer}</p>
        )}
      </div>
      {partnerName && partnerAvatar && (
        <div className="notification is-info is-light mb-4">
          <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
            <PlayerAvatar avatar={partnerAvatar} size="small" />
            <span>
              <strong>{partnerName}:</strong>{' '}
              <i>{partnerSubmitted ? '✓ Submitted' : 'is thinking...'}</i>
            </span>
          </div>
        </div>
      )}
      {totalAnswersCount < totalPlayersCount && (
        <p className="has-text-centered has-text-grey">Waiting for other players to finish...</p>
      )}
    </div>
  );
}
