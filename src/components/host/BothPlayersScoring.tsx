import { type Player, type CurrentRound } from '../../types/game';
import { PlayerAvatar } from '../common/PlayerAvatar';

// Helper to parse dual answer JSON
function parseDualAnswer(text: string): Record<string, string> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Helper to format response time
function formatResponseTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

interface BothPlayersScoringProps {
  player1: Player | undefined;
  player2: Player | undefined;
  currentRound: CurrentRound;
  revealedAnswers: Set<string>;
  onRevealAnswer: (key: string) => void;
}

/**
 * Scoring display for "both players" rounds where each player answers
 * for themselves AND their partner.
 *
 * Layout groups answers by player:
 * - Calvin
 *   - (partner's answer about Calvin)
 *   - (Calvin's answer about himself)
 * - Hannah
 *   - (partner's answer about Hannah)
 *   - (Hannah's answer about herself)
 */
export function BothPlayersScoring({
  player1,
  player2,
  currentRound,
  revealedAnswers,
  onRevealAnswer
}: BothPlayersScoringProps) {
  if (!player1 || !player2) return null;

  const player1Answer = currentRound.answers[player1.name];
  const player2Answer = currentRound.answers[player2.name];

  // Parse JSON answers: { [playerName]: answerText }
  const player1Parsed = player1Answer ? parseDualAnswer(player1Answer.text) : null;
  const player2Parsed = player2Answer ? parseDualAnswer(player2Answer.text) : null;

  // Each player section shows:
  // 1. What their partner said about them
  // 2. What they said about themselves
  const playerSections = [
    {
      subject: player1,
      partner: player2,
      // Partner's answer about this player
      partnerAnswerKey: `${player2.name}:${player1.name}`,
      partnerAnswerText: player2Parsed?.[player1.name] ?? '(no answer)',
      // Player's own answer about themselves
      selfAnswerKey: `${player1.name}:${player1.name}`,
      selfAnswerText: player1Parsed?.[player1.name] ?? '(no answer)',
    },
    {
      subject: player2,
      partner: player1,
      partnerAnswerKey: `${player1.name}:${player2.name}`,
      partnerAnswerText: player1Parsed?.[player2.name] ?? '(no answer)',
      selfAnswerKey: `${player2.name}:${player2.name}`,
      selfAnswerText: player2Parsed?.[player2.name] ?? '(no answer)',
    },
  ];

  return (
    <div className="both-players-scoring">
      {playerSections.map(({ subject, partner, partnerAnswerKey, partnerAnswerText, selfAnswerKey, selfAnswerText }) => {
        const partnerRevealed = revealedAnswers.has(partnerAnswerKey);
        const selfRevealed = revealedAnswers.has(selfAnswerKey);

        return (
          <div key={subject.socketId} className="box has-background-white-ter mb-3">
            {/* Player header */}
            <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
              Answers about
              <PlayerAvatar avatar={subject.avatar} size="medium" />
              <span className="subtitle is-5 mb-0">{subject.name}</span>
            </div>

            {/* Two answer cards side by side */}
            <div className="columns is-mobile">
              {/* Partner's answer about this player */}
              <div className="column">
                <div className="box">
                  <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.25rem' }}>
                    <PlayerAvatar avatar={partner.avatar} size="small" />
                    <span className="is-size-7 has-text-grey">According to {partner.name}, {subject.name} would say...</span>
                  </div>
                  {(() => {
                    const partnerResponseTime = currentRound.answers[partner.name]?.responseTime;
                    return !partnerRevealed ? (
                      <button
                        className="button is-link is-small"
                        onClick={() => onRevealAnswer(partnerAnswerKey)}
                      >
                        Reveal
                      </button>
                    ) : (
                      <div className="notification is-light is-small py-2 px-3">
                        <strong>{partnerAnswerText}</strong>
                        {partnerResponseTime !== undefined && partnerResponseTime >= 0 && (
                          <span className="has-text-grey ml-2 is-size-7">
                            ({formatResponseTime(partnerResponseTime)}s)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Player's own answer about themselves */}
              <div className="column">
                <div className="box">
                  <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.25rem' }}>
                    <PlayerAvatar avatar={subject.avatar} size="small" />
                    <span className="is-size-7 has-text-grey">{subject.name} actually said...</span>
                  </div>
                  {(() => {
                    const selfResponseTime = currentRound.answers[subject.name]?.responseTime;
                    return !selfRevealed ? (
                      <button
                        className="button is-link is-small"
                        onClick={() => onRevealAnswer(selfAnswerKey)}
                      >
                        Reveal
                      </button>
                    ) : (
                      <div className="notification is-light is-small py-2 px-3">
                        <strong>{selfAnswerText}</strong>
                        {selfResponseTime !== undefined && selfResponseTime >= 0 && (
                          <span className="has-text-grey ml-2 is-size-7">
                            ({formatResponseTime(selfResponseTime)}s)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
