import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'

export type SelectOption<T extends string = string> = {
  value: T
  label: string
}

type Props<T extends string = string> = {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  'aria-label'?: string
}

type MenuPos = {
  top: number
  left: number
  width: number
}

export default function Select<T extends string = string>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '请选择',
  className,
  'aria-label': ariaLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const selected = options.find((item) => item.value === value)
  const label = selected?.label ?? placeholder

  const updatePos = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePos()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    const onReposition = () => updatePos()

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  return (
    <Wrap ref={rootRef} className={className} data-open={open ? '' : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
      >
        <span className={`value${selected ? '' : ' is-placeholder'}`}>{label}</span>
        <span className="chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && pos
        ? createPortal(
            <Menu
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-activedescendant={`${listId}-${value}`}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {options.map((option) => {
                const active = option.value === value
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${option.value}`}
                      role="option"
                      aria-selected={active}
                      className={`option${active ? ' is-active' : ''}`}
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })}
            </Menu>,
            document.body,
          )
        : null}
    </Wrap>
  )
}

const Wrap = styled.div`
  position: relative;
  width: 100%;

  .trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    color: #111827;
    font-size: 14px;
    line-height: 1;
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  .trigger:hover:not(:disabled) {
    border-color: #9ca3af;
  }

  .trigger:focus-visible,
  &[data-open] .trigger {
    border-color: #0f766e;
  }

  .trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    background: #f9fafb;
  }

  .value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .value.is-placeholder {
    color: #9ca3af;
  }

  .chevron {
    flex-shrink: 0;
    color: #6b7280;
    font-size: 12px;
    line-height: 1;
    transition: transform 0.15s ease;
  }

  &[data-open] .chevron {
    transform: rotate(180deg);
  }
`

const Menu = styled.ul`
  position: fixed;
  z-index: 1000;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
  max-height: 240px;
  overflow: auto;
  box-sizing: border-box;

  .option {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #111827;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  .option:hover {
    background: #f3f4f6;
  }

  .option.is-active {
    background: #ecfdf5;
    color: #0f766e;
    font-weight: 600;
  }
`
