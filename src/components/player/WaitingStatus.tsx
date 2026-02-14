import {AnimatePresence, motion} from 'framer-motion';
import {Host} from "../../types/game.ts";
import {PlayerAvatar} from "../../components/common/PlayerAvatar.tsx";
import {fadeIn, springDefault} from '../../styles/motion';

interface RevealInfo {
  chapterTitle?: string;
  stage: string;
  variant?: string;
}

interface WaitingStatusProps {
  host: Host;
  isInitialRound?: boolean;
  revealInfo?: RevealInfo | null;
}

export function WaitingStatus({ host, isInitialRound = false, revealInfo }: WaitingStatusProps) {
  // If we have reveal info, show the reveal state instead of standard waiting
  if (revealInfo) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="ready"
          className="box has-text-centered has-background-info-light p-5"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={springDefault}
        >
          <h2 className="title is-3 mb-3">Get ready...</h2>
          <p className="has-text-grey is-size-5">
            {revealInfo.variant === 'binary' && 'pick either you or your partner'}
            {revealInfo.variant === 'multiple_choice' && 'pick from multiple choices'}
            {revealInfo.variant === 'open_ended' && 'share your thoughts'}
            {!revealInfo.variant && 'The question is coming...'}
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (isInitialRound) {
    return (
      <div className="box has-text-centered has-background-info-light">
        <h2 className="title is-3 mb-3">welcome to {host.name}'s game~</h2>
        <p className="has-text-grey is-size-5 mb-2">
          you'll answer questions on this device - response time matters!
        </p>
        <p className="has-text-grey is-size-5">
          your host is setting up the first round now. be ready...
        </p>
      </div>
    );
  }

  return (
    <div className="box has-text-centered has-background-warning-light">
      <h2 className="subtitle is-3 mb-3">
        <span className="is-inline-flex is-align-items-center" style={{ gap: '0.35rem', verticalAlign: 'bottom' }}>
          <PlayerAvatar avatar={host.avatar} size="small" />
          <strong>{host.name}</strong>
        </span>
        {' '}is setting up the next round
      </h2>
      <p className="has-text-grey is-size-5">get ready to think heheh</p>
    </div>
  );
}
