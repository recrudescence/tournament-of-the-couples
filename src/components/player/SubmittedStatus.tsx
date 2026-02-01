import {motion} from 'framer-motion';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {chatBubbleLeft, chatBubbleRight, springDefault, staggerDelay} from '../../styles/motion';
import type {PlayerAvatar as PlayerAvatarType, PlayerIdentity} from '../../types/game';

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
  questionText: string;
  submittedAnswer: string;
  host: { name: string; avatar: PlayerAvatarType | null };
  player: { name: string; avatar: PlayerAvatarType | null };
  playerResponseTime: number | null;
  partner: PlayerIdentity | null;
  partnerSubmitted: boolean;
  partnerAnswer: string | null; // Only populated after host reveals
  partnerResponseTime: number | null;
  answerForBoth?: boolean; // Dual answer mode - reserved for future use
  totalAnswersCount: number;
  totalPlayersCount: number;
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

interface AnswerContentProps {
  answer: string;
  partnerName?: string;
}

function AnswerContent({ answer, partnerName }: AnswerContentProps) {
  const parsedAnswer = parseAnswer(answer);

  if (parsedAnswer) {
    return (
      <div>
        {Object.entries(parsedAnswer).map(([name, text]) => {
          const prefix = name === partnerName ? partnerName : 'I';
          return (
            <p key={name} className="chat-bubble__text mb-1">
              <strong>{prefix} would say</strong>: {text}
            </p>
          );
        })}
      </div>
    );
  }

  return <p className="chat-bubble__text">{answer}</p>;
}

function BlurredPlaceholder() {
  return (
    <p className="chat-bubble__text chat-bubble__text--blurred" aria-hidden="true">
      ●●●●●●●●●●
    </p>
  );
}

export function SubmittedStatus({
  questionText,
  submittedAnswer,
  host,
  player,
  playerResponseTime,
  partner,
  partnerSubmitted,
  partnerAnswer,
  partnerResponseTime,
  totalAnswersCount,
  totalPlayersCount
}: SubmittedStatusProps) {
  // Determine ordering by response time (faster first)
  const playerAnsweredFirst = playerResponseTime !== null && partnerResponseTime !== null
    ? playerResponseTime <= partnerResponseTime
    : true; // Default to player first if times unknown

  const hostBubble = (
    <motion.div
      className="chat-bubble chat-bubble--left chat-bubble--host"
      variants={chatBubbleLeft}
      initial="hidden"
      animate="visible"
      transition={{ ...springDefault, delay: staggerDelay(0) }}
    >
      {host.avatar && (
        <PlayerAvatar avatar={host.avatar} size="small" />
      )}
      <div className="chat-bubble__content">
        <div className="chat-bubble__name">{host.name}</div>
        <p className="chat-bubble__text">{questionText}</p>
      </div>
    </motion.div>
  );

  const playerBubble = (index: number) => (
    <motion.div
      key="player"
      className="chat-bubble chat-bubble--right chat-bubble--self"
      variants={chatBubbleRight}
      initial="hidden"
      animate="visible"
      transition={{ ...springDefault, delay: staggerDelay(index) }}
    >
      {player.avatar && (
        <PlayerAvatar avatar={player.avatar} size="small" />
      )}
      <div className="chat-bubble__content">
        <div className="chat-bubble__name">{player.name}</div>
        <AnswerContent answer={submittedAnswer} partnerName={partner?.name} />
      </div>
    </motion.div>
  );

  const partnerBubble = (index: number) => partner && partner.avatar && (
    <motion.div
      key="partner"
      className="chat-bubble chat-bubble--left chat-bubble--partner"
      variants={chatBubbleLeft}
      initial="hidden"
      animate="visible"
      transition={{ ...springDefault, delay: staggerDelay(index) }}
    >
      <PlayerAvatar avatar={partner.avatar} size="small" />
      <div className="chat-bubble__content">
        <div className="chat-bubble__name">{partner.name}</div>
        {!partnerSubmitted ? (
          <TypingIndicator />
        ) : partnerAnswer ? (
          <AnswerContent answer={partnerAnswer} partnerName={partner.name} />
        ) : (
          <BlurredPlaceholder />
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="box">
      <h2 className="subtitle is-4 has-text-success has-text-centered mb-4">Answer Submitted!</h2>

      <div className="chat-container">
        {hostBubble}
        {playerAnsweredFirst ? (
          <>
            {playerBubble(1)}
            {partnerBubble(2)}
          </>
        ) : (
          <>
            {partnerBubble(1)}
            {playerBubble(2)}
          </>
        )}
      </div>

      {totalAnswersCount < totalPlayersCount && (
        <p className="has-text-centered has-text-grey mt-4">
          Waiting for other players to finish...
        </p>
      )}
    </div>
  );
}
