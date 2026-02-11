import {useState} from 'react';
import type {Player, QuestionCursor, ImportedQuestionSet} from '../../types/game';
import {useAlert} from '../../context/AlertContext';

interface RoundControlsProps {
  players: Player[];
  phase: 'roundSetup' | 'reveal' | 'answering' | 'scoring';
  allAnswersIn: boolean;
  isImportedMode: boolean;
  questionCursor: QuestionCursor | null;
  importedQuestions: ImportedQuestionSet | null;
  onKickPlayer: (socketId: string, playerName: string) => void;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
  onResetGame: () => void;
  onResetQuestion: () => void;
  onRestartQuestion: () => void;
  onPreviousQuestion: () => void;
  onSkipQuestion: () => void;
}

export function RoundControls({
  players,
  phase,
  allAnswersIn,
  isImportedMode,
  questionCursor,
  importedQuestions,
  onKickPlayer,
  onReopenAnswering,
  onStartScoring,
  onResetGame,
  onResetQuestion,
  onRestartQuestion,
  onPreviousQuestion,
  onSkipQuestion
}: RoundControlsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { confirm } = useAlert();

  const handleKick = async () => {
    const player = players.find(p => p.socketId === selectedPlayerId);
    if (!player) return;
    const confirmed = await confirm({
      message: `are you sure you want to kick ${player.name}? they'll be disconnected from the game.`,
      variant: 'danger',
      confirmText: 'kick',
    });
    if (confirmed) {
      onKickPlayer(selectedPlayerId, player.name);
      setSelectedPlayerId('');
    }
  };

  const handleStartScoring = async () => {
    if (!allAnswersIn) {
      const confirmed = await confirm({
        message: 'doesn\'t look like all players have answered yet. begin scoring anyway?',
        variant: 'warning',
        confirmText: 'begin scoring',
      });
      if (confirmed) {
        onStartScoring();
      }
    } else {
      onStartScoring();
    }
  };

  // Check if we can go to previous question (not at first question)
  const canGoPrevious = isImportedMode && questionCursor && (
    questionCursor.chapterIndex > 0 || questionCursor.questionIndex > 0
  );

  // Check if we can skip to next question (not at last question)
  const canSkip = isImportedMode && importedQuestions && questionCursor && (() => {
    const chapters = importedQuestions.chapters;
    const currentChapter = chapters[questionCursor.chapterIndex];
    if (!currentChapter) return false;
    const isLastChapter = questionCursor.chapterIndex === chapters.length - 1;
    const isLastQuestionInChapter = questionCursor.questionIndex === currentChapter.questions.length - 1;
    return !(isLastChapter && isLastQuestionInChapter);
  })();

  // Determine if we're in an active round phase (where question controls make sense)
  const isActivePhase = phase === 'reveal' || phase === 'answering' || phase === 'scoring';

  return (
    <div className="box has-background-light">
      <button
        className="button is-ghost is-fullwidth p-0 is-flex is-justify-content-space-between"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ height: 'auto' }}
      >
        <span className="has-text-weight-semibold">Host Controls</span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="mt-3">
          {/* Question Controls - only show during active phases */}
          {isActivePhase && (
            <div className="mb-3">
              <p className="is-size-7 has-text-grey mb-2">Question Controls</p>
              <div className="buttons are-small">
                {/* Manual mode: Reset Question */}
                {!isImportedMode && (
                  <button
                    className="button is-warning is-small"
                    onClick={onResetQuestion}
                  >
                    Reset Question
                  </button>
                )}

                {/* Imported mode: Restart, Previous, Skip */}
                {isImportedMode && (
                  <>
                    <button
                      className="button is-warning is-small"
                      onClick={onRestartQuestion}
                    >
                      Restart
                    </button>
                    <button
                      className="button is-info is-small is-light"
                      onClick={onPreviousQuestion}
                      disabled={!canGoPrevious}
                      data-tooltip-id="tooltip"
                      data-tooltip-content={canGoPrevious ? 'Go to previous question' : 'Already at first question'}
                    >
                      ← Previous
                    </button>
                    <button
                      className="button is-info is-small is-light"
                      onClick={onSkipQuestion}
                      disabled={!canSkip}
                      data-tooltip-id="tooltip"
                      data-tooltip-content={canSkip ? 'Skip to next question' : 'Already at last question'}
                    >
                      Skip →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="is-flex is-justify-content-space-between is-flex-wrap-wrap" style={{ gap: '0.5rem' }}>
            {/* Kick player form */}
            <div className="field has-addons mb-0">
              <div className="control">
                <div className="select is-small">
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                  >
                    <option value="">Kick player...</option>
                    {players.map((player) => (
                      <option key={player.socketId} value={player.socketId}>
                        {player.name} {!player.connected ? '(dc)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="control">
                <button
                  className="button is-danger is-small"
                  onClick={handleKick}
                  disabled={!selectedPlayerId}
                >
                  Kick
                </button>
              </div>
            </div>

            {/* Skip to scoring (answering phase only) */}
            {phase === 'answering' && (
              <button
                className={`button is-small is-primary ${!allAnswersIn ? 'is-light' : ''}`}
                onClick={handleStartScoring}
              >
                Skip to Scoring
              </button>
            )}

            {/* Back to answering (scoring phase only) */}
            {phase === 'scoring' && (
              <button
                className="button is-small is-warning"
                onClick={onReopenAnswering}
              >
                Back to Answering
              </button>
            )}

            {/* Reset game button */}
            <button
              className="button is-family-secondary is-small"
              onClick={onResetGame}
            >
              Reset Game
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
