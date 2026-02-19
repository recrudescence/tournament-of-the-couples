import {AnimatePresence, motion} from "framer-motion";
import {PlayerAvatar} from "../common/PlayerAvatar";
import type {PlayerAvatar as PlayerAvatarType} from "../../types/game";
import {flipInLeft, scalePop, springBouncy, springDefault} from "../../styles/motion";

interface HostHeaderProps {
  hostName: string;
  hostAvatar?: PlayerAvatarType | null;
  roundNumber: number;
  gameStatus: string;
  totalQuestions?: number | null;
}

const ROUND_COLORS = ["is-primary", "is-success", "is-info", "is-link", "is-warning"];

function getRoundColor(round: number): string {
  return ROUND_COLORS[(round - 1) % ROUND_COLORS.length] ?? "is-primary";
}

function getStatusColor(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes("waiting")) return "is-info";
  if (lower.includes("answering")) return "is-warning";
  if (lower.includes("scoring")) return "is-success";
  if (lower.includes("finished")) return "is-dark";
  return "is-light";
}

export function HostHeader({hostName, hostAvatar, roundNumber, gameStatus, totalQuestions}: HostHeaderProps) {
  return (
    <div className="box">
      <div className="columns is-mobile has-text-centered is-vcentered">
        <div className="column">
          <p className="heading mb-2">Host</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            <PlayerAvatar avatar={hostAvatar} size="small" />
            <span className="title is-6 has-text-primary mb-0">{hostName}</span>
          </div>
        </div>
        <div className="column">
          <p className="heading mb-2">Question</p>
          <div style={{ perspective: 200 }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={roundNumber}
                className={`tag is-rounded is-medium has-text-weight-bold ${getRoundColor(roundNumber)} has-text-white`}
                variants={flipInLeft}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, rotateY: 90 }}
                transition={springBouncy}
              >
                {roundNumber}{totalQuestions ? ` of ${totalQuestions}` : ''}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <div className="column">
          <p className="heading mb-2">Status</p>
          <AnimatePresence mode="wait">
            <motion.span
              key={gameStatus}
              className={`tag is-medium has-text-weight-semibold ${getStatusColor(gameStatus)}`}
              variants={scalePop}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springDefault}
            >
              {gameStatus}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}