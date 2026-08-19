/**
 * Módulo M-07 `ui` — Web UI em TypeScript puro, sem framework (§2 deixa livre).
 *
 * Regras de contrato, todas vindas de achados da crítica adversarial:
 *   SEC-01  o conteúdo do deck NUNCA vai ao DOM por innerHTML — só `textContent`.
 *   UX-03   teclado (espaço revela, 1–4 notam), foco gerido, rótulos para leitor
 *           de tela, e `lang="zh-Hans"` no hanzi — sem isso o leitor pronuncia os
 *           caracteres com fonética errada.
 *   UX-04   no estado `writing` os botões ficam inertes: clique duplo não gera
 *           um segundo evento (e a deduplicação por eventId não o pegaria).
 *   UX-05   indicador "x de N" na sessão.
 *   UX-02   a tela sem cartões devidos informa QUANDO o próximo vence.
 *   PROC-04 há tela de erro para deck malformado, falha de escrita e falha de sync.
 *   C-20    o controle de sincronização é alcançável de QUALQUER estado.
 */

import type { SessionApi, SessionView } from '../session/index.ts'
import type { Grade } from '../scheduler/index.ts'

/** D5: a UI emite 0, 3, 4 e 5; o agendador aceita 0..5. */
const GRADES: ReadonlyArray<{ q: Grade; label: string; hint: string; key: string }> = [
  { q: 0, label: 'De novo', hint: 'não lembrei', key: '1' },
  { q: 3, label: 'Difícil', hint: 'lembrei com esforço', key: '2' },
  { q: 4, label: 'Bom', hint: 'lembrei', key: '3' },
  { q: 5, label: 'Fácil', hint: 'imediato', key: '4' },
]

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<'className' | 'textContent' | 'lang' | 'id', string>> = {},
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (props.className) node.className = props.className
  if (props.textContent !== undefined) node.textContent = props.textContent // SEC-01
  if (props.lang) node.lang = props.lang
  if (props.id) node.id = props.id
  return node
}

export type MountOptions = {
  /** Exibido quando o uso de armazenamento passa do limiar de C-19. */
  quotaWarning?: () => boolean
  /** OBS-02: o precache concluiu — a aplicação pode AFIRMAR que funciona sem rede. */
  offlineReady?: () => boolean
  /** Presente a partir do Incremento 3. */
  syncEnabled?: boolean
}

export function mount(root: HTMLElement, api: SessionApi, opts: MountOptions = {}): void {
  injectStyles()

  const status = el('p', { className: 'status', id: 'status' })
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')

  const stage = el('section', { className: 'stage' })
  stage.setAttribute('aria-label', 'cartão em revisão')

  // C-20: fora do palco, portanto alcançável em qualquer estado.
  const bar = el('nav', { className: 'bar' })
  bar.setAttribute('aria-label', 'ações da sessão')
  const syncBtn = el('button', { className: 'sync', textContent: 'Sincronizar' })
  syncBtn.type = 'button'
  syncBtn.addEventListener('click', () => void api.syncNow())
  if (opts.syncEnabled) bar.append(syncBtn)

  root.replaceChildren(status, stage, bar)

  const render = (): void => {
    const v = api.view()
    stage.replaceChildren(...screenFor(v, api))
    status.textContent = statusFor(v, opts)
  }

  api.onChange(render)
  render()

  document.addEventListener('keydown', (e) => {
    const v = api.view()
    if (e.key === ' ' || e.key === 'Enter') {
      if (v.state === 'showing') {
        e.preventDefault()
        api.reveal()
      }
      return
    }
    if (v.state !== 'revealed') return
    const hit = GRADES.find((g) => g.key === e.key)
    if (hit) {
      e.preventDefault()
      void api.grade(hit.q)
    }
  })
}

function statusFor(v: SessionView, opts: MountOptions): string {
  const warn = opts.quotaWarning?.() ? ' · atenção: armazenamento local quase cheio' : ''
  const off = opts.offlineReady?.() ? ' · pronto para uso sem rede' : ''
  switch (v.state) {
    case 'showing':
    case 'revealed':
    case 'writing':
      return `cartão ${v.index} de ${v.total}${off}${warn}` // UX-05
    case 'done':
      return `sessão concluída · ${v.reviewed} ${v.reviewed === 1 ? 'cartão revisado' : 'cartões revisados'}${off}${warn}`
    case 'queue-empty':
      return `nada devido agora${off}${warn}`
    case 'loading':
      return 'carregando…'
    case 'error':
      return 'erro'
  }
}

function screenFor(v: SessionView, api: SessionApi): HTMLElement[] {
  switch (v.state) {
    case 'loading':
      return [el('p', { className: 'muted', textContent: 'Carregando o baralho…' })]

    case 'queue-empty': {
      const out: HTMLElement[] = [el('h1', { textContent: 'Nada para revisar agora' })]
      // UX-02: sem isto, a tela é um beco sem saída.
      out.push(
        el('p', {
          className: 'muted',
          textContent: v.nextDueDay
            ? `O próximo cartão vence em ${v.nextDueDay}.`
            : 'Ainda não há cartões agendados.',
        }),
      )
      return out
    }

    case 'done':
      return [
        el('h1', { textContent: 'Sessão concluída' }),
        el('p', {
          className: 'muted',
          textContent: `${v.reviewed} ${v.reviewed === 1 ? 'cartão revisado' : 'cartões revisados'}. Volte amanhã.`,
        }),
      ]

    case 'error':
      return [
        el('h1', { textContent: 'Algo deu errado' }),
        el('p', { className: 'error', textContent: v.message }),
        el('p', { className: 'muted', textContent: `origem: ${v.kind}` }),
      ]

    case 'showing':
    case 'revealed':
    case 'writing': {
      const out: HTMLElement[] = []
      // UX-03: lang correto é o que faz o leitor de tela pronunciar como chinês.
      const hanzi = el('p', { className: 'hanzi', textContent: v.card.hanzi, lang: 'zh-Hans' })
      out.push(hanzi)

      if (v.state === 'showing') {
        const reveal = el('button', { className: 'reveal', textContent: 'Mostrar resposta' })
        reveal.type = 'button'
        reveal.addEventListener('click', () => api.reveal())
        out.push(reveal)
        queueMicrotask(() => reveal.focus())
        out.push(el('p', { className: 'muted', textContent: 'espaço para revelar' }))
        return out
      }

      out.push(el('p', { className: 'pinyin', textContent: v.card.pinyin }))
      out.push(el('p', { className: 'gloss', textContent: v.card.gloss }))

      const row = el('div', { className: 'grades' })
      row.setAttribute('role', 'group')
      row.setAttribute('aria-label', 'como foi a lembrança')
      for (const g of GRADES) {
        const b = el('button', { className: `grade g${g.q}` })
        b.type = 'button'
        b.append(el('span', { className: 'label', textContent: g.label }))
        b.append(el('span', { className: 'hint', textContent: g.hint }))
        b.setAttribute('aria-label', `${g.label} — ${g.hint} (tecla ${g.key})`)
        // UX-04/MEC-04: inerte durante a escrita.
        b.disabled = v.state === 'writing'
        b.addEventListener('click', () => void api.grade(g.q))
        row.append(b)
      }
      out.push(row)

      if (v.state === 'writing') out.push(el('p', { className: 'muted', textContent: 'gravando…' }))
      else queueMicrotask(() => row.querySelector<HTMLButtonElement>('button')?.focus())

      return out
    }
  }
}

function injectStyles(): void {
  if (document.getElementById('hanzi-styles')) return
  const style = document.createElement('style')
  style.id = 'hanzi-styles'
  style.textContent = `
    :root { color-scheme: light dark; --fg: #16181d; --muted: #6b7280; --bg: #fbfbfd; --line: #e5e7eb; --accent: #1f2937; }
    @media (prefers-color-scheme: dark) { :root { --fg: #e8eaed; --muted: #9aa1ac; --bg: #14161a; --line: #2a2e35; --accent: #e8eaed; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--fg);
           font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    #app { max-width: 34rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
           min-height: 100vh; display: flex; flex-direction: column; }
    .status { color: var(--muted); font-size: .8125rem; letter-spacing: .01em; margin: 0 0 2rem; }
    .stage { flex: 1; display: flex; flex-direction: column; align-items: center;
             justify-content: center; text-align: center; gap: .75rem; }
    h1 { font-size: 1.375rem; font-weight: 600; margin: 0; }
    .hanzi { font-size: clamp(3.5rem, 18vw, 6rem); line-height: 1.1; margin: 0 0 .5rem; font-weight: 500; }
    .pinyin { font-size: 1.5rem; margin: 0; color: var(--fg); }
    .gloss { font-size: 1.125rem; margin: 0 0 1rem; color: var(--muted); }
    .muted { color: var(--muted); font-size: .875rem; margin: .25rem 0 0; }
    .error { color: #b91c1c; margin: .5rem 0; }
    @media (prefers-color-scheme: dark) { .error { color: #fca5a5; } }
    button { font: inherit; cursor: pointer; border-radius: .5rem; border: 1px solid var(--line);
             background: transparent; color: var(--fg); padding: .625rem 1rem; }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    button:disabled { opacity: .45; cursor: default; }
    .reveal { padding: .75rem 1.5rem; }
    .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5rem; width: 100%; margin-top: .5rem; }
    .grade { display: flex; flex-direction: column; gap: .125rem; padding: .625rem .25rem; }
    .grade .label { font-size: .9375rem; }
    .grade .hint { font-size: .6875rem; color: var(--muted); }
    .bar { display: flex; justify-content: center; padding-top: 1.5rem; }
    .sync { font-size: .875rem; padding: .5rem 1rem; }
  `
  document.head.append(style)
}
