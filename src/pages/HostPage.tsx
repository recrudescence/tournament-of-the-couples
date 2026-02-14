import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useSocket} from '../hooks/useSocket';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useGameContext} from '../context/GameContext';
import {useGameError} from '../hooks/useGameError';
import {useAlert} from '../context/AlertContext';
import {ExitButton} from '../components/common/ExitButton';
import {QuestionForm} from '../components/host/QuestionForm';
import {QuestionReveal, type RevealStage} from '../components/host/QuestionReveal';
import {AnsweringPhase} from '../components/host/AnsweringPhase';
import {ScoringInterface} from '../components/host/ScoringInterface';
import {PoolScoringInterface} from '../components/host/PoolScoringInterface';
import {TeamScoreboard} from '../components/host/TeamScoreboard';
import {RoundControls} from '../components/host/RoundControls';
import {type GameState, type ImportedChapter, type ImportedQuestion, type Player, RoundVariant} from '../types/game';
import {findPlayerBySocketId} from '../utils/playerUtils';
import {GameTitle} from '../components/common/GameTitle';
import {HostHeader} from "../components/host/HostHeader.tsx";

type HostPhase = 'roundSetup' | 'reveal' | 'answering' | 'scoring';

// Normalize answer for case-insensitive keying
function normalizeAnswer(text: string | null | undefined): string {
  if (!text) return '';
  return text.toLowerCase().trim();
}

interface CurrentImportedQuestion {
  question: ImportedQuestion;
  chapter: ImportedChapter;
  isNewChapter: boolean;
  isLastQuestion: boolean;
}

export function HostPage() {
  const navigate = useNavigate();
  const { isConnected, emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { error, showError } = useGameError();
  const { confirm } = useAlert();

  const [phase, setPhase] = useState<HostPhase>('roundSetup');
  const [roundNumber, setRoundNumber] = useState(1);
  const [showFinishBtn, setShowFinishBtn] = useState(false);
  const [teamPointsAwarded, setTeamPointsAwarded] = useState<Record<string, number>>({});
  const [revealedResponseTimes, setRevealedResponseTimes] = useState<Record<string, number>>({});

  // UI-only state
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  // Imported question mode state
  const [revealStage, setRevealStage] = useState<RevealStage>('chapter_title');
  const [currentImportedQuestion, setCurrentImportedQuestion] = useState<CurrentImportedQuestion | null>(null);
  const [allQuestionsCompleted, setAllQuestionsCompleted] = useState(false);

  // Pool selection state
  const [revealedPickers, setRevealedPickers] = useState<Record<string, Player[]>>({});
  const [revealedAuthors, setRevealedAuthors] = useState<Record<string, { author: Player; authors: Player[]; correctPickers: Player[]; isEmptyAnswer?: boolean }>>({});

  // Derived values
  const playerCount = gameState?.players.length ?? 0;
  const submittedCount = gameState?.currentRound?.submittedInCurrentPhase.length ?? 0;
  const allAnswersIn = phase === 'answering' && playerCount > 0 && submittedCount >= playerCount;
  const isImportedMode = Boolean(gameState?.importedQuestions);

  // Pool selection derived values
  const picksSubmitted = gameState?.currentRound?.picksSubmitted ?? [];
  const allPicksIn = playerCount > 0 && picksSubmitted.length >= playerCount;

  const gameStatus = useMemo(() => {
    if (phase === 'roundSetup') return 'Setting Up';
    if (phase === 'reveal') return 'Revealing';
    if (phase === 'scoring') return 'Scoring';
    if (allAnswersIn) return 'All Answers In';
    return 'Answering';
  }, [phase, allAnswersIn]);

  // Initialize phase from gameState on mount
  useEffect(() => {
    if (gameState?.currentRound) {
      setRoundNumber(gameState.currentRound.roundNumber);
      if (gameState.status === 'scoring' || gameState.currentRound.status === 'complete') {
        setPhase('scoring');

        // Restore revealed pool state for pool selection mode
        if (gameState.currentRound.revealedPoolPickers) {
          setRevealedPickers(gameState.currentRound.revealedPoolPickers);
        }
        if (gameState.currentRound.revealedPoolAnswers?.length) {
          const restored: Record<string, { author: Player; authors: Player[]; correctPickers: Player[]; isEmptyAnswer?: boolean }> = {};
          for (const answerText of gameState.currentRound.revealedPoolAnswers) {
            // Find authors of this answer (case-insensitive)
            const normalizedAnswer = normalizeAnswer(answerText);
            const authors = gameState.players.filter(p => {
              const playerAnswer = gameState.currentRound?.answers[p.name]?.text;
              return normalizeAnswer(playerAnswer) === normalizedAnswer;
            });
            const isEmptyAnswer = !normalizedAnswer;
            // Mark as revealed with minimal data (correctPickers already awarded, so empty is fine)
            // Use normalized key for consistency
            restored[normalizedAnswer] = {
              author: authors[0] || {} as Player,
              authors: authors,
              correctPickers: [], // Points already awarded, don't need to show again
              isEmptyAnswer
            };
          }
          setRevealedAuthors(restored);
        }
      } else if (gameState.currentRound.status === 'answering' || gameState.currentRound.status === 'selecting') {
        // 'selecting' is pool selection mode after answers are in but before scoring
        setPhase('answering');
      }
    } else if (gameState?.status === 'playing') {
      // Use lastRoundNumber for reconnection when between rounds
      if (gameState.lastRoundNumber) {
        setRoundNumber(gameState.lastRoundNumber);
      }

      // If imported mode with a cursor, recover reveal state
      if (gameState.importedQuestions && gameState.questionCursor) {
        const cursor = gameState.questionCursor;
        const chapters = gameState.importedQuestions.chapters;
        const chapter = chapters[cursor.chapterIndex];
        if (chapter) {
          const question = chapter.questions[cursor.questionIndex];
          if (question) {
            const isNewChapter = cursor.questionIndex === 0;
            const isLastChapter = cursor.chapterIndex === chapters.length - 1;
            const isLastQuestionInChapter = cursor.questionIndex === chapter.questions.length - 1;
            const isLastQuestion = isLastChapter && isLastQuestionInChapter;

            setCurrentImportedQuestion({
              question,
              chapter: { title: chapter.title, questions: chapter.questions },
              isNewChapter,
              isLastQuestion
            });
            // On reconnect, start at variant_context (assume chapter was already seen)
            setRevealStage(isNewChapter ? 'chapter_title' : 'variant_context');
            setPhase('reveal');
            setRoundNumber(gameState.lastRoundNumber + 1);
          } else {
            setPhase('roundSetup');
          }
        } else {
          setPhase('roundSetup');
        }
      } else {
        setPhase('roundSetup');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('roundStarted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
          if (state.currentRound?.roundNumber) {
            setRoundNumber(state.currentRound.roundNumber);
          }
        }
        setRevealedAnswers(new Set());
        setRevealedPickers({});
        setRevealedAuthors({});
        setPhase('answering');
      }),

      on('answerSubmitted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      // Pool selection events
      on('poolReady', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      on('pickSubmitted', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
      }),

      on('allPicksIn', () => {
        // Scoring will start when scoringStarted is received
      }),

      on('pickersRevealed', ({ answerText, pickers }) => {
        // Normalize for case-insensitive keying
        const key = normalizeAnswer(answerText);
        setRevealedPickers(prev => ({ ...prev, [key]: pickers }));
      }),

      on('authorRevealed', ({ answerText, author, authors, correctPickers, isEmptyAnswer }) => {
        // Normalize for case-insensitive keying
        const key = normalizeAnswer(answerText);
        setRevealedAuthors(prev => ({ ...prev, [key]: { author, authors: authors || [author], correctPickers, isEmptyAnswer } }));
      }),

      // allAnswersIn is now derived from gameState, no handler needed

      on('scoringStarted', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('answerRevealed', ({ playerName, responseTime }) => {
        setRevealedAnswers((prev) => new Set([...prev, playerName]));
        setRevealedResponseTimes((prev) => ({
          ...prev,
          [playerName]: responseTime
        }));
      }),

      on('scoreUpdated', ({ teamId, newScore }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
      }),

      on('readyForNextRound', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setRoundNumber(prev => prev + 1);
        setShowFinishBtn(false);
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        // In imported mode, we'll wait for cursorAdvanced event to set phase to 'reveal'
        // For manual mode, go to roundSetup
        if (!state.importedQuestions) {
          setPhase('roundSetup');
        }
        // Note: For imported mode, the host will click "Next Round" which triggers
        // handleFinishRound, which we'll modify to emit advanceCursor
      }),

      on('returnedToAnswering', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setPhase('answering');
      }),

      on('lobbyUpdate', (data) => {
        const state = (data as { gameState?: GameState }).gameState || data;
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('gameReset', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        navigate('/game?room=' + state.roomCode);
      }),

      on('playerDisconnected', ({ socketId }) => {
        dispatch({ type: 'SET_PLAYER_CONNECTED', payload: { socketId, connected: false } });
      }),

      on('error', ({ message }) => {
        showError(message);
      }),

      // Imported question mode events
      on('cursorAdvanced', ({ question, chapter, isNewChapter, isLastQuestion, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        setCurrentImportedQuestion({ question, chapter, isNewChapter, isLastQuestion });
        setRevealStage(isNewChapter ? 'chapter_title' : 'variant_context');
        setPhase('reveal');
        setAllQuestionsCompleted(false);
      }),

      on('allQuestionsCompleted', () => {
        setAllQuestionsCompleted(true);
        setCurrentImportedQuestion(null);
        setPhase('roundSetup'); // Show completion UI in roundSetup slot
      }),

      // Host controls: Question management events
      on('questionReset', ({ gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        // Clear UI state
        setRevealedAnswers(new Set());
        setRevealedPickers({});
        setRevealedAuthors({});
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setShowFinishBtn(false);
        setPhase('roundSetup');
      }),

      on('questionRestarted', ({ cursorData, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        // Clear UI state
        setRevealedAnswers(new Set());
        setRevealedPickers({});
        setRevealedAuthors({});
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setShowFinishBtn(false);
        // Go back to reveal phase with current question data
        if (cursorData) {
          setCurrentImportedQuestion({
            question: cursorData.question,
            chapter: cursorData.chapter,
            isNewChapter: cursorData.isNewChapter,
            isLastQuestion: cursorData.isLastQuestion
          });
          setRevealStage(cursorData.isNewChapter ? 'chapter_title' : 'variant_context');
          setPhase('reveal');
        } else {
          setPhase('roundSetup');
        }
      }),

      on('cursorChanged', ({ cursorData, gameState: state }) => {
        if (state) {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
        }
        // Clear UI state
        setRevealedAnswers(new Set());
        setRevealedPickers({});
        setRevealedAuthors({});
        setTeamPointsAwarded({});
        setRevealedResponseTimes({});
        setShowFinishBtn(false);
        // Go to reveal phase with new cursor data
        if (cursorData) {
          setCurrentImportedQuestion({
            question: cursorData.question,
            chapter: cursorData.chapter,
            isNewChapter: cursorData.isNewChapter,
            isLastQuestion: cursorData.isLastQuestion
          });
          setRevealStage(cursorData.isNewChapter ? 'chapter_title' : 'variant_context');
          setPhase('reveal');
          setAllQuestionsCompleted(false);
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, navigate]);

  const handleStartRound = (question: string, variant: RoundVariant, options?: string[], answerForBoth?: boolean) => {
    emit('startRound', {
      question,
      variant,
      options,
      answerForBoth
    });
  };

  const handleStartScoring = () => {
    setRevealedAnswers(new Set());
    setTeamPointsAwarded({});
    setRevealedResponseTimes({});
    setShowFinishBtn(false);
    setPhase('scoring');
    // Notify server/players that scoring has begun
    emit('startScoring');
  };

  const handleBackToAnswering = () => {
    // Just navigate back to answering view (UI only)
    // allAnswersIn will still be true since answers haven't been cleared
    setPhase('answering');
  };

  const handleReopenAnswering = () => {
    // Server clears submittedInCurrentPhase, which makes allAnswersIn false
    emit('backToAnswering');
  };

  const handleRevealAnswer = (playerName: string) => {
    emit('revealAnswer', { playerName });
  };

  const handleRevealPickers = (answerText: string) => {
    emit('revealPickers', { answerText });
  };

  const handleRevealAuthor = (answerText: string) => {
    emit('revealAuthor', { answerText });
  };

  const handleAwardPoints = (teamId: string, _teamIndex: number, points: number) => {
    if (points > 0) {
      emit('awardPoint', { teamId, points });
    } else {
      emit('skipPoint', { teamId });
    }
    setTeamPointsAwarded((prev) => ({ ...prev, [teamId]: points }));

    // Show finish button when all teams have been scored
    // State update is async, so count current + 1 (unless re-scoring same team)
    const scoredCount = Object.keys(teamPointsAwarded).length + (teamId in teamPointsAwarded ? 0 : 1);
    if (scoredCount >= (gameState?.teams.length || 0)) {
      setShowFinishBtn(true);
    }
  };

  const handleFinishRound = () => {
    emit('nextRound');
    // In imported mode, also advance to next question
    if (isImportedMode) {
      emit('advanceCursor');
    }
  };

  const handleRevealNext = () => {
    if (!currentImportedQuestion) return;

    if (revealStage === 'chapter_title') {
      setRevealStage('variant_context');
      emit('sendRevealUpdate', { stage: 'variant_context', chapterTitle: currentImportedQuestion.chapter.title });
    } else if (revealStage === 'variant_context') {
      // Start the round directly - question revealed when answering begins
      const q = currentImportedQuestion.question;
      const options = q.variant === 'binary'
        ? (q.options ?? ['Player 1', 'Player 2'])
        : (q.options ?? undefined);
      emit('sendRevealUpdate', { stage: 'answering' });
      emit('startRound', {
        question: q.question,
        variant: q.variant,
        options,
        answerForBoth: q.answerForBoth ?? false
      });
    }
  };

  const handleReopenTeamScoring = (teamId: string) => {
    // If team was awarded points, remove them
    const pointsAwarded = teamPointsAwarded[teamId] ?? 0;
    if (pointsAwarded > 0) {
      emit('removePoint', { teamId, points: pointsAwarded });
    }

    // Remove from local tracking
    setTeamPointsAwarded((prev) => {
      const updated = { ...prev };
      delete updated[teamId];
      return updated;
    });

    // Clear revealed answers and response times for this team's players
    const team = gameState?.teams.find(t => t.teamId === teamId);
    if (team && gameState?.players) {
      const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
      const player2 = findPlayerBySocketId(gameState.players, team.player2Id);
      const isDualMode = gameState?.currentRound?.answerForBoth;

      const newRevealedAnswers = new Set(revealedAnswers);
      if (player1 && player2 && isDualMode) {
        // Dual mode: clear all 4 composite keys
        newRevealedAnswers.delete(`${player1.name}:${player1.name}`);
        newRevealedAnswers.delete(`${player1.name}:${player2.name}`);
        newRevealedAnswers.delete(`${player2.name}:${player1.name}`);
        newRevealedAnswers.delete(`${player2.name}:${player2.name}`);
      } else {
        // Single mode: clear by player name
        if (player1) newRevealedAnswers.delete(player1.name);
        if (player2) newRevealedAnswers.delete(player2.name);
      }
      setRevealedAnswers(newRevealedAnswers);

      // Clear response times for these players (keyed by composite or simple name)
      setRevealedResponseTimes((prev) => {
        const updated = { ...prev };
        if (player1 && player2 && isDualMode) {
          delete updated[`${player1.name}:${player1.name}`];
          delete updated[`${player1.name}:${player2.name}`];
          delete updated[`${player2.name}:${player1.name}`];
          delete updated[`${player2.name}:${player2.name}`];
        } else {
          if (player1) delete updated[player1.name];
          if (player2) delete updated[player2.name];
        }
        return updated;
      });
    }

    setShowFinishBtn(false);
  };

  const handleEndGame = async () => {
    const confirmed = await confirm({
      title: 'finished?',
      message: 'end the game - show the final scores?',
      variant: 'warning',
      confirmText: 'drumroll please...',
    });
    if (confirmed) {
      emit('endGame');
    }
  };

  const handleResetGame = async () => {
    const confirmed = await confirm({
      title: 'start over',
      message: 'return everyone to the lobby with scores reset?',
      variant: 'danger',
      confirmText: 'reset game',
    });
    if (confirmed) {
      emit('resetGame');
    }
  };

  const handleKickPlayer = (socketId: string) => {
    emit('kickPlayer', { targetSocketId: socketId });
  };

  // Host control: Reset question (manual mode) - discard and return to question entry
  const handleResetQuestion = async () => {
    const confirmed = await confirm({
      title: 'reset question',
      message: 'discard this question and return to question entry?',
      variant: 'warning',
      confirmText: 'reset',
    });
    if (confirmed) {
      emit('resetQuestion');
    }
  };

  // Host control: Restart question (imported mode) - clear answers and restart from reveal
  const handleRestartQuestion = async () => {
    const hasAnswers = Object.keys(gameState?.currentRound?.answers ?? {}).length > 0;
    if (hasAnswers) {
      const confirmed = await confirm({
        title: 'restart question',
        message: 'clear all answers and restart this question?',
        variant: 'warning',
        confirmText: 'restart',
      });
      if (!confirmed) return;
    }
    emit('restartQuestion');
  };

  // Host control: Previous question (imported mode)
  const handlePreviousQuestion = async () => {
    const hasAnswers = Object.keys(gameState?.currentRound?.answers ?? {}).length > 0;
    if (hasAnswers) {
      const confirmed = await confirm({
        title: 'previous question',
        message: 'go back to the previous question? current progress will be lost.',
        variant: 'warning',
        confirmText: 'go back',
      });
      if (!confirmed) return;
    }
    emit('previousQuestion');
  };

  // Host control: Skip question (imported mode)
  const handleSkipQuestion = async () => {
    const confirmed = await confirm({
      title: 'skip question',
      message: 'skip this question and move to the next one?',
      variant: 'warning',
      confirmText: 'skip',
    });
    if (confirmed) {
      emit('skipQuestion');
    }
  };

  if (!playerInfo || !isConnected) {
    return (
      <section className="section">
        <div className="container container-md">
          <GameTitle />
          <p className="has-text-centered">Loading...</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <ExitButton />
      <section className="section">
        <div className="container container-host">
          <GameTitle />

          <div className="columns is-desktop">
            {/* Main content (DOM first for mobile) */}
            <div className="column">
              {/* Round Setup Phase - Manual mode or all questions completed */}
              {phase === 'roundSetup' && !allQuestionsCompleted && (
                <QuestionForm onSubmit={handleStartRound} onError={showError} />
              )}

              {/* All Questions Completed (Imported Mode) */}
              {phase === 'roundSetup' && allQuestionsCompleted && (
                <div className="box has-background-success-light has-text-centered">
                  <h2 className="title is-3 mb-4">All Questions Completed!</h2>
                  <p className="subtitle is-5 mb-4">
                    You've finished all imported questions.
                  </p>
                  <button
                    className="button is-primary is-large"
                    onClick={handleEndGame}
                  >
                    End Game
                  </button>
                </div>
              )}

              {/* Reveal Phase (Imported Mode) */}
              {phase === 'reveal' && currentImportedQuestion && (
                <QuestionReveal
                  question={currentImportedQuestion.question}
                  chapter={currentImportedQuestion.chapter}
                  isNewChapter={currentImportedQuestion.isNewChapter}
                  isLastQuestion={currentImportedQuestion.isLastQuestion}
                  revealStage={revealStage}
                  roundNumber={roundNumber}
                  onNext={handleRevealNext}
                />
              )}

              {/* Answering Phase */}
              {phase === 'answering' && gameState?.currentRound && (
                <AnsweringPhase
                  question={gameState.currentRound.question}
                  variant={gameState.currentRound.variant}
                  options={gameState.currentRound.options ?? undefined}
                  players={gameState.players}
                  currentRound={gameState.currentRound}
                  submittedCount={submittedCount}
                  allAnswersIn={allAnswersIn}
                  onReopenAnswering={handleReopenAnswering}
                  onStartScoring={handleStartScoring}
                  picksSubmitted={picksSubmitted}
                  allPicksIn={allPicksIn}
                />
              )}

              {/* Scoring Phase */}
              {phase === 'scoring' && gameState?.currentRound && (
                gameState.currentRound.variant === RoundVariant.POOL_SELECTION ? (
                  <PoolScoringInterface
                    question={gameState.currentRound.question}
                    currentRound={gameState.currentRound}
                    onRevealPickers={handleRevealPickers}
                    onRevealAuthor={handleRevealAuthor}
                    onFinishRound={handleFinishRound}
                    revealedPickers={revealedPickers}
                    revealedAuthors={revealedAuthors}
                  />
                ) : (
                  <ScoringInterface
                    teams={gameState.teams}
                    players={gameState.players}
                    currentRound={gameState.currentRound}
                    teamPointsAwarded={teamPointsAwarded}
                    revealedAnswers={revealedAnswers}
                    revealedResponseTimes={revealedResponseTimes}
                    showFinishBtn={showFinishBtn}
                    onBackToAnswering={handleBackToAnswering}
                    onRevealAnswer={handleRevealAnswer}
                    onAwardPoints={handleAwardPoints}
                    onReopenTeamScoring={handleReopenTeamScoring}
                    onFinishRound={handleFinishRound}
                  />
                )
              )}

              {error && <div className="notification is-danger is-light mt-4">{error}</div>}
            </div>

            {/* Sidebar: Scoreboard (DOM second, visually left on desktop via order) */}
            <div className="column is-4-desktop host-sidebar">
              <HostHeader
                hostName={gameState?.host.name ?? '-'}
                hostAvatar={gameState?.host.avatar}
                roundNumber={roundNumber}
                gameStatus={gameStatus}
              />
              <div className="host-sidebar-sticky">
                <TeamScoreboard
                  teams={gameState?.teams || []}
                  players={gameState?.players || []}
                  responseTimes={gameState?.teamTotalResponseTimes}
                  onEndGame={handleEndGame}
                />
                <RoundControls
                  players={gameState?.players || []}
                  phase={phase}
                  allAnswersIn={allAnswersIn}
                  isImportedMode={isImportedMode}
                  questionCursor={gameState?.questionCursor ?? null}
                  importedQuestions={gameState?.importedQuestions ?? null}
                  onKickPlayer={handleKickPlayer}
                  onReopenAnswering={handleReopenAnswering}
                  onStartScoring={handleStartScoring}
                  onResetGame={handleResetGame}
                  onResetQuestion={handleResetQuestion}
                  onRestartQuestion={handleRestartQuestion}
                  onPreviousQuestion={handlePreviousQuestion}
                  onSkipQuestion={handleSkipQuestion}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
