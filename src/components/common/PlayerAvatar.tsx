import type { PlayerAvatar as PlayerAvatarType } from '../../types/game';

type AvatarSize = 'small' | 'medium' | 'large';

const sizeStyles: Record<AvatarSize, { width: string; height: string; fontSize: string }> = {
  small: { width: '1.75rem', height: '1.75rem', fontSize: '0.875rem' },
  medium: { width: '2.5rem', height: '2.5rem', fontSize: '1.25rem' },
  large: { width: '3rem', height: '3rem', fontSize: '1.5rem' },
};

interface PlayerAvatarProps {
  avatar: PlayerAvatarType | undefined | null;
  size?: AvatarSize;
  isBumping?: boolean;
  onClick?: () => void;
  title?: string;
}

export function PlayerAvatar({
  avatar,
  size = 'medium',
  isBumping = false,
  onClick,
  title,
}: PlayerAvatarProps) {
  if (!avatar) return (<></>);

  const styles = sizeStyles[size];
  const isClickable = Boolean(onClick);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      className={`is-flex is-align-items-center is-justify-content-center ${isBumping ? 'avatar-bump' : ''}`}
      onClick={handleClick}
      style={{
        width: styles.width,
        height: styles.height,
        borderRadius: '50%',
        backgroundColor: avatar.color,
        fontSize: styles.fontSize,
        flexShrink: 0,
        cursor: isClickable ? 'pointer' : undefined,
      }}
      title={title}
    >
      {avatar.emoji}
    </div>
  );
}
