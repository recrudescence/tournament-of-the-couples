import { type Player, type CurrentRound } from '../../types/game';

interface AnsweringPhaseProps {
  question: string;
  players: Player[];
  currentRound: CurrentRound | null;
  submittedCount: number;
  showAllAnswersNotification: boolean;
  showReopenBtn: boolean;
  showStartScoringBtn: boolean;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
}

export function AnsweringPhase({
  question,
  players,
  currentRound,
  submittedCount,
  showAllAnswersNotification,
  showReopenBtn,
  showStartScoringBtn,
  onReopenAnswering,
  onStartScoring
}: AnsweringPhaseProps) {
  return (
    <div className="box">
      <h2 className="subtitle is-4 mb-3">Current Question</h2>
      <div className="notification is-primary is-light mb-4">
        <p className="is-size-5 has-text-weight-semibold">{question}</p>
      </div>

      <h3 className="subtitle is-5 mb-3">Answer Status</h3>
      <div className="box has-background-white-ter mb-4">
        <div className="content">
          <ul>
            {players.map((player) => {
              const hasSubmitted = currentRound
                ? currentRound.status === 'complete'
                  ? player.name in currentRound.answers
                  : currentRound.submittedInCurrentPhase.includes(player.name)
                : false;

              return (
                <li
                  key={player.socketId}
                  className={
                    !player.connected
                      ? 'has-text-grey'
                      : hasSubmitted
                      ? 'has-text-success'
                      : 'has-text-warning-dark'
                  }
                >
                  <strong>{player.name}</strong>{' '}
                  {!player.connected
                    ? '🔌 (Disconnected)'
                    : hasSubmitted
                    ? '✅'
                    : '⏳'}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {!showAllAnswersNotification && (
        <p className="has-text-centered has-text-grey mb-4">
          {submittedCount} / {players.length} answers submitted
        </p>
      )}
      {showAllAnswersNotification && (
        <div className="notification is-success is-light mb-4">
          ✅ All answers are in! Ready to score.
        </div>
      )}

      <div className="field is-grouped is-grouped-centered">
        {showReopenBtn && (
          <div className="control">
            <button className="button is-info" onClick={onReopenAnswering}>
              Re-open Answering
            </button>
          </div>
        )}
        {showStartScoringBtn && (
          <div className="control">
            <button className="button is-primary" onClick={onStartScoring}>
              Begin Scoring
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
