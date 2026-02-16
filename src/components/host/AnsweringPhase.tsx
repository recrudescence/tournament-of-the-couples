import {useEffect, useMemo} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, RoundVariant, type Team} from '../../types/game';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {useTimer} from '../../hooks/useTimer';
import {useCountdown} from '../../hooks/useCountdown';
import {formatResponseTime} from '../../utils/formatUtils';
import {springDefault} from '../../styles/motion';

// =============================================================================
// Types
// =============================================================================

interface AnsweringPhaseProps {
  question: string;
  variant?: RoundVariant;
  options?: string[];
  players: Player[];
  teams: Team[];
  currentRound: CurrentRound | null;
  submittedCount: number;
  allAnswersIn: boolean;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
  picksSubmitted?: string[];
  allPicksIn?: boolean;
  onStartPoolSelection?: () => void;
}

interface PlayerStatus {
  hasSubmitted: boolean;
  hasPicked: boolean;
  isComplete: boolean; // The status to display (submitted or picked depending on phase)
}

interface TeamWithPlayers {
  team: Team;
  player1: Player;
  player2: Player;
  player1Status: PlayerStatus;
  player2Status: PlayerStatus;
  teamComplete: boolean; // Both players done
}

// =============================================================================
// Helper Functions
// =============================================================================

function getPlayerStatus(
  player: Player,
  currentRound: CurrentRound | null,
  picksSubmitted: string[],
  showPickStatus: boolean
): PlayerStatus {
  const hasSubmitted = currentRound
    ? currentRound.status === 'complete' || currentRound.status === 'selecting'
      ? player.name in currentRound.answers
      : currentRound.submittedInCurrentPhase.includes(player.name)
    : false;
  const hasPicked = picksSubmitted.includes(player.name);
  const isComplete = showPickStatus ? hasPicked : hasSubmitted;

  return { hasSubmitted, hasPicked, isComplete };
}

function buildTeamsWithPlayers(
  teams: Team[],
  players: Player[],
  currentRound: CurrentRound | null,
  picksSubmitted: string[],
  showPickStatus: boolean
): TeamWithPlayers[] {
  return teams.map(team => {
    const player1 = players.find(p => p.socketId === team.player1Id);
    const player2 = players.find(p => p.socketId === team.player2Id);

    if (!player1 || !player2) return null;

    const player1Status = getPlayerStatus(player1, currentRound, picksSubmitted, showPickStatus);
    const player2Status = getPlayerStatus(player2, currentRound, picksSubmitted, showPickStatus);

    return {
      team,
      player1,
      player2,
      player1Status,
      player2Status,
      teamComplete: player1Status.isComplete && player2Status.isComplete,
    };
  }).filter((t): t is TeamWithPlayers => t !== null);
}

function sortTeamsByStatus(teams: TeamWithPlayers[]): TeamWithPlayers[] {
  return [...teams].sort((a, b) => {
    // Teams still waiting (not complete) come first
    if (a.teamComplete === b.teamComplete) return 0;
    return a.teamComplete ? 1 : -1;
  });
}

interface PoolItem {
  text: string;
  isEmpty: boolean;
  count: number;
}

function consolidateAnswerPool(answerPool: { answer: string }[]): PoolItem[] {
  const answerGroups = new Map<string, { text: string; count: number }>();
  let emptyCount = 0;

  for (const entry of answerPool) {
    const isEmpty = !entry.answer || entry.answer.trim() === '';
    if (isEmpty) {
      emptyCount++;
    } else {
      const normalized = entry.answer.toLowerCase().trim();
      const existing = answerGroups.get(normalized);
      if (existing) {
        existing.count++;
      } else {
        answerGroups.set(normalized, { text: entry.answer, count: 1 });
      }
    }
  }

  return [
    ...Array.from(answerGroups.values()).map(g => ({ text: g.text, isEmpty: false, count: g.count })),
    ...(emptyCount > 0 ? [{ text: '(no response)', isEmpty: true, count: emptyCount }] : [])
  ];
}

// =============================================================================
// Sub-components
// =============================================================================

function QuestionHeader({
  showTimer,
  timerValue,
  timerColor,
  timerClass,
  isPoolSelection
}: {
  showTimer: boolean;
  timerValue: number;
  timerColor: string;
  timerClass: string;
  isPoolSelection: boolean;
}) {
  return (
    <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
      <h2 className="subtitle is-4 mb-0">Current Question</h2>
      {showTimer && (
        <span
          className={`tag ${timerColor} is-large is-mono ${timerClass}`}
          style={{ minWidth: '6rem', justifyContent: 'center' }}
        >
          {formatResponseTime(timerValue, isPoolSelection ? 0 : 2)}
        </span>
      )}
    </div>
  );
}

function MultipleChoiceOptions({ options }: { options: string[] }) {
  return (
    <div className="columns is-multiline is-centered mb-4">
      {options.map((option, index) => (
        <div key={index} className="column is-half-tablet is-one-third-desktop">
          <div className="box has-background-light has-text-centered py-3">
            <span className="is-size-6">{option}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnswerPoolDisplay({ poolItems }: { poolItems: PoolItem[] }) {
  return (
    <>
      <h3 className="subtitle is-5 mb-3">Answer Pool</h3>
      <div className="response-pool mb-4">
        {poolItems.map((item, index) => (
          <span
            key={item.isEmpty ? 'empty' : item.text.toLowerCase()}
            className={`response-bubble ${item.isEmpty ? 'is-empty' : ''}`}
            style={{ cursor: 'default', '--index': index } as React.CSSProperties}
          >
            {item.text.toLowerCase()}
            {item.count > 1 && (
              <span className="tag is-small is-light ml-2">×{item.count}</span>
            )}
          </span>
        ))}
      </div>
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

function PlayerStatusCard({
  player,
  status,
  showPickStatus
}: {
  player: Player;
  status: PlayerStatus;
  showPickStatus: boolean;
}) {
  const statusColor = status.isComplete
    ? 'has-background-success-light'
    : !player.connected
    ? 'has-background-grey-lighter'
    : 'has-background-warning-light';

  const statusParts: string[] = [];
  if (showPickStatus) {
    if (status.hasPicked) statusParts.push('✅');
  } else {
    if (status.hasSubmitted) statusParts.push('✅');
  }
  if (!player.connected) statusParts.push('📵');
  const statusText = statusParts.length > 0 ? statusParts.join(' ') : null;

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={`${player.socketId}-${status.hasSubmitted}-${status.hasPicked}`}
        className={`box p-3 mb-0 ${statusColor}`}
        initial={{ rotateX: -90, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={springDefault}
        style={{ height: '100%' }}
      >
        <div className="is-flex is-align-items-center is-justify-content-space-between">
          <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
            <PlayerAvatar avatar={player.avatar} size="small" />
            <span className="has-text-weight-semibold">{player.name}</span>
          </div>
          {statusText ? (
            <span>{statusText}</span>
          ) : (
            <TypingIndicator />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function TeamStatusRow({
  teamData,
  showPickStatus
}: {
  teamData: TeamWithPlayers;
  showPickStatus: boolean;
}) {
  const { player1, player2, player1Status, player2Status } = teamData;

  return (
    <div className="columns is-mobile mb-2" style={{ perspective: 800 }}>
      <div className="column is-half">
        <PlayerStatusCard player={player1} status={player1Status} showPickStatus={showPickStatus} />
      </div>
      <div className="column is-half">
        <PlayerStatusCard player={player2} status={player2Status} showPickStatus={showPickStatus} />
      </div>
    </div>
  );
}

function ProgressCounter({
  current,
  total,
  label
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <p className="has-text-centered has-text-grey mb-4">
      {current} / {total} {label}
    </p>
  );
}

function StatusNotifications({
  allAnswersIn,
  isPoolSelection,
  isWaitingForRelease,
  isSelectingPhase,
  allPicksIn
}: {
  allAnswersIn: boolean;
  isPoolSelection: boolean;
  isWaitingForRelease: boolean;
  isSelectingPhase: boolean;
  allPicksIn: boolean;
}) {
  if (allAnswersIn && !isPoolSelection) {
    return (
      <div className="notification is-success mb-4">
        ✅ All answers are in! Ready to score.
      </div>
    );
  }

  if (isWaitingForRelease) {
    return (
      <div className="notification is-success mb-4">
        ✅ All answers are in! Release the answer pool for players to pick.
      </div>
    );
  }

  if (isSelectingPhase && !allPicksIn) {
    return (
      <div className="notification is-info mb-4 is-flex is-justify-content-center">
        waiting for players to pick their partner's answer...
      </div>
    );
  }

  if (isPoolSelection && allPicksIn) {
    return (
      <div className="notification is-success mb-4">
        ✅ All picks are in! Ready to reveal answers.
      </div>
    );
  }

  return null;
}

function ActionButtons({
  isWaitingForRelease,
  canStartScoring,
  isPoolSelection,
  onStartPoolSelection,
  onReopenAnswering,
  onStartScoring
}: {
  isWaitingForRelease: boolean;
  canStartScoring: boolean;
  isPoolSelection: boolean;
  onStartPoolSelection?: () => void;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
}) {
  return (
    <>
      {isWaitingForRelease && onStartPoolSelection && (
        <div className="field is-grouped is-grouped-centered">
          <div className="control">
            <button className="button is-primary is-large" onClick={onStartPoolSelection}>
              Release Answers
            </button>
          </div>
        </div>
      )}
      {canStartScoring && (
        <div className="field is-grouped is-grouped-centered">
          {!isPoolSelection && (
            <div className="control">
              <button className="button is-info" onClick={onReopenAnswering}>
                Re-open Answering
              </button>
            </div>
          )}
          <div className="control">
            <button className="button is-primary" onClick={onStartScoring}>
              {isPoolSelection ? 'Reveal Answers' : 'Begin Scoring'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AnsweringPhase({
  question,
  variant,
  options,
  players,
  teams,
  currentRound,
  submittedCount,
  allAnswersIn,
  onReopenAnswering,
  onStartScoring,
  picksSubmitted = [],
  allPicksIn = false,
  onStartPoolSelection
}: AnsweringPhaseProps) {
  // Phase detection
  const isPoolSelection = variant === RoundVariant.POOL_SELECTION;
  const isSelectingPhase = isPoolSelection && currentRound?.status === 'selecting';
  const isWaitingForRelease = isPoolSelection && allAnswersIn && currentRound?.status !== 'selecting';
  const canStartScoring = isPoolSelection ? allPicksIn : allAnswersIn;
  const showPickStatus = isPoolSelection && allAnswersIn && !isWaitingForRelease;

  // Timer setup
  const { responseTime, startTimer, stopTimer } = useTimer();
  const {
    remaining: countdownRemaining,
    isExpired: countdownExpired,
    start: startCountdown,
    stop: stopCountdown,
    reset: resetCountdown
  } = useCountdown();

  useEffect(() => {
    if (currentRound?.createdAt) {
      if (isPoolSelection) {
        resetCountdown();
        const timeoutId = setTimeout(() => {
          startCountdown(currentRound.createdAt);
        }, 0);
        return () => {
          clearTimeout(timeoutId);
          stopCountdown();
        };
      } else {
        startTimer(currentRound.createdAt);
        return () => stopTimer();
      }
    }
  }, [currentRound?.createdAt, currentRound?.roundNumber, isPoolSelection, startTimer, stopTimer, startCountdown, stopCountdown, resetCountdown]);

  useEffect(() => {
    if (allAnswersIn) {
      stopTimer();
      stopCountdown();
    }
  }, [allAnswersIn, stopTimer, stopCountdown]);

  // Timer display values
  const showTimer = isPoolSelection ? (!allAnswersIn && !countdownExpired) : true;
  const timerValue = isPoolSelection ? countdownRemaining : responseTime;
  const isUrgent = isPoolSelection && countdownRemaining <= 10000;
  const isWarning = isPoolSelection && countdownRemaining <= 20000 && countdownRemaining > 10000;
  const timerColor = isUrgent ? 'is-danger' : isWarning ? 'is-warning' : 'is-info';
  const timerClass = isUrgent ? 'countdown-urgent' : isWarning ? 'countdown-warning' : '';

  // Build and sort team data
  const sortedTeams = useMemo(() => {
    const teamsWithPlayers = buildTeamsWithPlayers(
      teams,
      players,
      currentRound,
      picksSubmitted,
      showPickStatus
    );
    return sortTeamsByStatus(teamsWithPlayers);
  }, [teams, players, currentRound, picksSubmitted, showPickStatus]);

  // Answer pool for pool selection
  const poolItems = useMemo(() => {
    if (isSelectingPhase && currentRound?.answerPool) {
      return consolidateAnswerPool(currentRound.answerPool);
    }
    return [];
  }, [isSelectingPhase, currentRound?.answerPool]);

  return (
    <div className="box">
      <QuestionHeader
        showTimer={showTimer}
        timerValue={timerValue}
        timerColor={timerColor}
        timerClass={timerClass}
        isPoolSelection={isPoolSelection}
      />

      <div className="notification is-primary is-light mb-4">
        <p className="is-size-5 has-text-weight-semibold">{question}</p>
      </div>

      {variant === 'multiple_choice' && options && options.length > 0 && (
        <MultipleChoiceOptions options={options} />
      )}

      {poolItems.length > 0 && (
        <AnswerPoolDisplay poolItems={poolItems} />
      )}

      <StatusNotifications
        allAnswersIn={allAnswersIn}
        isPoolSelection={isPoolSelection}
        isWaitingForRelease={isWaitingForRelease}
        isSelectingPhase={isSelectingPhase}
        allPicksIn={allPicksIn}
      />

      <ActionButtons
        isWaitingForRelease={isWaitingForRelease}
        canStartScoring={canStartScoring}
        isPoolSelection={isPoolSelection}
        onStartPoolSelection={onStartPoolSelection}
        onReopenAnswering={onReopenAnswering}
        onStartScoring={onStartScoring}
      />

      <h3 className="subtitle is-5 mb-3">
        {isSelectingPhase ? 'Pick Status' : 'Answer Status'}
      </h3>

      <div className="mb-4">
        {sortedTeams.map(teamData => (
          <TeamStatusRow
            key={teamData.team.teamId}
            teamData={teamData}
            showPickStatus={showPickStatus}
          />
        ))}
      </div>

      {!allAnswersIn && (
        <ProgressCounter current={submittedCount} total={players.length} label="answers submitted" />
      )}
      {isSelectingPhase && (
        <ProgressCounter current={picksSubmitted.length} total={players.length} label="picks submitted" />
      )}
    </div>
  );
}
