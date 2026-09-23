/** Portal into `.zhouyi` so theme CSS variables (--zy-*) still apply. */
export function fortunePortalRoot(): HTMLElement {
  return (document.querySelector('.zhouyi') as HTMLElement | null) ?? document.body
}
