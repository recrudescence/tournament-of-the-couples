import {type Theme, useTheme} from '../../hooks/useTheme';

const THEMES: Theme[] = ['holiday', 'valentines', 'halloween', 'hyper', 'nick', 'default'];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-picker has-background-info-light">
      <span className="theme-picker-buttons is-flex-wrap-wrap is-justify-content-center">
        {THEMES.map((t) => (
          <button
            key={t}
            className={`theme-picker-button ${theme === t ? 'is-active' : ''}`}
            onClick={() => setTheme(t)}
          >
            {t}
          </button>
        ))}
      </span>
    </div>
  );
}
