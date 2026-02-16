import {useState} from 'react';
import type {ImportedQuestionSet, Player, QuestionCursor} from '../../types/game';
import {useAlert} from '../../context/AlertContext';

// =============================================================================
// Types
// =============================================================================

interface RoundControlsProps {
  players: Player[];
  phase: 'roundSetup' | 'reveal' | 'answering' | 'scoring';
  allAnswersIn: boolean;
  isImportedMode: boolean;
  questionCursor: QuestionCursor | null;
  importedQuestions: ImportedQuestionSet | null;
  onKickPlayer: (socketId: string, playerName: string) => void;
  onReopenAnswering: () => void;
  onReopenPlayerAnswering: (playerName: string) => void;
  onStartScoring: () => void;
  onResetGame: () => void;
  onResetQuestion: () => void;
  onRestartQuestion: () => void;
  onPreviousQuestion: () => void;
  onSkipQuestion: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function canGoPreviousQuestion(
  isImportedMode: boolean,
  questionCursor: QuestionCursor | null
): boolean {
  return isImportedMode && questionCursor !== null && (
    questionCursor.chapterIndex > 0 || questionCursor.questionIndex > 0
  );
}

function canSkipQuestion(
  isImportedMode: boolean,
  importedQuestions: ImportedQuestionSet | null,
  questionCursor: QuestionCursor | null
): boolean {
  if (!isImportedMode || !importedQuestions || !questionCursor) return false;

  const chapters = importedQuestions.chapters;
  const currentChapter = chapters[questionCursor.chapterIndex];
  if (!currentChapter) return false;

  const isLastChapter = questionCursor.chapterIndex === chapters.length - 1;
  const isLastQuestionInChapter = questionCursor.questionIndex === currentChapter.questions.length - 1;
  return !(isLastChapter && isLastQuestionInChapter);
}

// =============================================================================
// Sub-components
// =============================================================================

function CollapsibleHeader({
  isExpanded,
  onToggle
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="button is-ghost is-fullwidth p-0 is-flex is-justify-content-space-between"
      onClick={onToggle}
      style={{ height: 'auto' }}
    >
      <span className="has-text-weight-semibold">Host Controls</span>
      <span>{isExpanded ? '▲' : '▼'}</span>
    </button>
  );
}

function QuestionControlButtons({
  isImportedMode,
  canGoPrevious,
  canSkip,
  onResetQuestion,
  onRestartQuestion,
  onPreviousQuestion,
  onSkipQuestion
}: {
  isImportedMode: boolean;
  canGoPrevious: boolean;
  canSkip: boolean;
  onResetQuestion: () => void;
  onRestartQuestion: () => void;
  onPreviousQuestion: () => void;
  onSkipQuestion: () => void;
}) {
  return (
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
  );
}

function ReopenPlayerForm({
  players,
  reopenPlayerId,
  setReopenPlayerId,
  onReopenPlayer
}: {
  players: Player[];
  reopenPlayerId: string;
  setReopenPlayerId: (id: string) => void;
  onReopenPlayer: () => void;
}) {
  return (
    <div className="field has-addons mb-3">
      <div className="control">
        <div className="select is-small">
          <select
            value={reopenPlayerId}
            onChange={(e) => setReopenPlayerId(e.target.value)}
          >
            <option value="">Re-open answering for...</option>
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
          className="button is-warning is-small"
          onClick={onReopenPlayer}
          disabled={!reopenPlayerId}
        >
          Re-open
        </button>
      </div>
    </div>
  );
}

function GameControlSection({
  players,
  selectedPlayerId,
  setSelectedPlayerId,
  onKick,
  onResetGame
}: {
  players: Player[];
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  onKick: () => void;
  onResetGame: () => void;
}) {
  return (
    <div className="mt-3 is-flex is-justify-content-space-between is-flex-wrap-wrap gap-sm">
      <div>
        <p className="is-size-7 has-text-grey mb-2">Game Controls</p>
        <div className="buttons are-small">
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
                onClick={onKick}
                disabled={!selectedPlayerId}
              >
                Kick
              </button>
            </div>
          </div>

          {/* Reset game button */}
          <button
            className="button is-family-secondary is-small"
            onClick={onResetGame}
          >
            Reset Game
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function RoundControls({
  players,
  phase,
  allAnswersIn,
  isImportedMode,
  questionCursor,
  importedQuestions,
  onKickPlayer,
  onReopenAnswering,
  onReopenPlayerAnswering,
  onStartScoring,
  onResetGame,
  onResetQuestion,
  onRestartQuestion,
  onPreviousQuestion,
  onSkipQuestion
}: RoundControlsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [reopenPlayerId, setReopenPlayerId] = useState('');
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

  const handleReopenPlayer = async () => {
    const player = players.find(p => p.socketId === reopenPlayerId);
    if (!player) return;
    const confirmed = await confirm({
      message: `re-open answering for ${player.name}? their previous answer will be cleared.`,
      variant: 'warning',
      confirmText: 're-open',
    });
    if (confirmed) {
      onReopenPlayerAnswering(player.name);
      setReopenPlayerId('');
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

  const canGoPrevious = canGoPreviousQuestion(isImportedMode, questionCursor);
  const canSkip = canSkipQuestion(isImportedMode, importedQuestions, questionCursor);
  const isActivePhase = phase === 'reveal' || phase === 'answering' || phase === 'scoring';

  return (
    <div className="box has-background-light">
      <CollapsibleHeader
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className="mt-3">
          {/* Question Controls - only show during active phases */}
          {isActivePhase && (
            <>
              <QuestionControlButtons
                isImportedMode={isImportedMode}
                canGoPrevious={canGoPrevious}
                canSkip={canSkip}
                onResetQuestion={onResetQuestion}
                onRestartQuestion={onRestartQuestion}
                onPreviousQuestion={onPreviousQuestion}
                onSkipQuestion={onSkipQuestion}
              />

              {/* Re-open player answering form */}
              <ReopenPlayerForm
                players={players}
                reopenPlayerId={reopenPlayerId}
                setReopenPlayerId={setReopenPlayerId}
                onReopenPlayer={handleReopenPlayer}
              />

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
            </>
          )}

          <GameControlSection
            players={players}
            selectedPlayerId={selectedPlayerId}
            setSelectedPlayerId={setSelectedPlayerId}
            onKick={handleKick}
            onResetGame={onResetGame}
          />
        </div>
      )}
    </div>
  );
}
