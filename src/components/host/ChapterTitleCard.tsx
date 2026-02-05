import { motion } from 'framer-motion';
import { chapterEntrance, springBouncy } from '../../styles/motion';

interface ChapterTitleCardProps {
  title: string;
}

export function ChapterTitleCard({ title }: ChapterTitleCardProps) {
  return (
    <motion.div
      className="box has-background-primary has-text-white has-text-centered p-6"
      variants={chapterEntrance}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={springBouncy}
      style={{ perspective: 1000 }}
    >
      <h2 className="title is-2 has-text-white mb-0">{title}</h2>
    </motion.div>
  );
}
