import { t } from '../utils/i18n'
import styled from 'styled-components'

export type Gender = '男' | '女'

export default function GenderGroup({
  value,
  onChange,
  name = 'gender',
}: {
  value: Gender | ''
  onChange: (next: Gender) => void
  name?: string
}) {
  const active = value || '男'

  return (
    <Style className="gender-group" role="radiogroup" aria-label={t.gender} data-active={active}>
      <span className="gender-slider" aria-hidden="true" />
      {(['男', '女'] as const).map((option) => (
        <label
          key={option}
          className={active === option ? 'gender-option is-active' : 'gender-option'}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={active === option}
            onChange={() => onChange(option)}
          />
          <span className="gender-text">{option === '男' ? t.genderMale : t.genderFemale}</span>
        </label>
      ))}
    </Style>
  )
}

const Style = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  min-height: 32px;
  padding: 2px;
  box-sizing: border-box;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);

  .gender-slider {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc(50% - 2px);
    border-radius: 4px;
    background: var(--zy-bg1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.22s cubic-bezier(0.645, 0.045, 0.355, 1);
    pointer-events: none;
  }

  &[data-active='女'] .gender-slider {
    transform: translateX(100%);
  }

  .gender-option {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    min-height: 28px;
    border-radius: 4px;
    color: var(--zy-muted);
    font-size: 14px;
    letter-spacing: 0.12em;
    padding-left: 0.12em;
    cursor: pointer;
    transition: color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .gender-text {
    line-height: 1;
  }

  .gender-option.is-active {
    color: var(--zy-text-soft);
    font-weight: 500;
  }

  .gender-option:focus-within {
    outline: none;
  }

  .gender-option input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .gender-slider {
      transition: none;
    }
  }
`
