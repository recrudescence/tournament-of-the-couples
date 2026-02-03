import { type Player, type CurrentRound } from '../../types/game';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { Question } from '../common/Question.tsx';

interface AnsweringPhaseProps {
  question: string;
  players: Player[];
  currentRound: CurrentRound | null;
  submittedCount: number;
  allAnswersIn: boolean;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
}

export function AnsweringPhase({
  question,
  players,
  currentRound,
  submittedCount,
  allAnswersIn,
  onReopenAnswering,
  onStartScoring
}: AnsweringPhaseProps) {
  return (
    <div className="box">
      <Question question={question} />

      <h3 className="subtitle is-5 mb-3">Answer Status</h3>
      <div className="mb-4">
        {players.map((player) => {
          const hasSubmitted = currentRound
            ? currentRound.status === 'complete'
              ? player.name in currentRound.answers
              : currentRound.submittedInCurrentPhase.includes(player.name)
            : false;

          // Show green if submitted (even if disconnected), grey only if disconnected AND not submitted
          const statusColor = hasSubmitted
            ? 'has-background-success-light'
            : !player.connected
            ? 'has-background-grey-lighter'
            : 'has-background-warning-light';

          // Build status text showing both states when applicable
          const statusParts: string[] = [];
          if (hasSubmitted) statusParts.push('✅ Submitted');
          if (!player.connected) statusParts.push('📱 Phone screen off');
          const statusText = statusParts.length > 0 ? statusParts.join(' · ') : '⏳ Waiting...';

          return (
            <div
              key={player.socketId}
              className={`box mb-2 p-3 ${statusColor}`}
            >
              <div className="is-flex is-align-items-center is-justify-content-space-between">
                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                  <PlayerAvatar avatar={player.avatar} size="small" />
                  <span className="has-text-weight-semibold">{player.name}</span>
                </div>
                <span>{statusText}</span>
              </div>
            </div>
          );
        })}
      </div>

      {!allAnswersIn && (
        <p className="has-text-centered has-text-grey mb-4">
          {submittedCount} / {players.length} answers submitted
        </p>
      )}
      {allAnswersIn && (
        <div className="notification is-success mb-4">
          ✅ All answers are in! Ready to score.
        </div>
      )}

      {allAnswersIn && (
        <div className="field is-grouped is-grouped-centered">
          <div className="control">
            <button className="button is-info" onClick={onReopenAnswering}>
              Re-open Answering
            </button>
          </div>
          <div className="control">
            <button className="button is-primary" onClick={onStartScoring}>
              Begin Scoring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
