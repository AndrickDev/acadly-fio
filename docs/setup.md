# Setup e validação

Toolkit: https://github.com/soumatheusgomes/vibe-coding-toolkit, revisão `de66fe3`. Adoção proporcional, só a parte agnóstica de stack (stack real: Expo + Fastify, não Next).

## Versões

Node v26.7.0, npm workspaces, Expo SDK 58, Fastify 5, Drizzle 0.36, vitest 2.

## Comandos e estado (2026-10-18)

| Comando | Resultado |
|---|---|
| `npm install` | validated (dependências já instaladas) |
| `npm test` | validated: core 17 + server 9 passando |
| `npx tsc --noEmit` em `apps/server` | validated: exit 0 |
| `npx tsc --noEmit` em `apps/mobile` | validated: exit 0 |
| `packages/core` typecheck | pending: não há `tsconfig.json` no pacote |
| Lint | pending: não configurado (não adotado ESLint-Next) |
| Build do app (`.build-android.ps1`, `expo run:android`) | configured without execution |
| BLE em aparelho real | pending (issue da v0.2) |
| CI (`.github/workflows/ci.yml`) | configured without execution (roda no primeiro PR) |

## Decisões de adoção

| Componente | Decisão |
|---|---|
| PRODUCT.md | adotado, resumindo README/ROADMAP/requisitos |
| AGENTS.md + CLAUDE.md (`@AGENTS.md`) | adotado |
| docs/architecture, design, onboarding, quality | não aplica por ora: README e docs/bluetooth.md cobrem; criar quando houver conteúdo |
| Quality gates | testes + tsc dos dois apps no CI; sem lint |
| Security review | adiado para a v1.0 (hospedagem, LGPD) e para issues nível 3 |
| Drizzle/Next defaults | não aplica (já usa Drizzle; sem Next) |
| Labels, templates de issue/PR, CI, `.claude/settings.json` | adotado |

## Ambiente de aprovação

Labels: `status:proposed|todo|em-andamento|revisao|blocked|ideia`, `aprovado`, `aprovado-n3`, `nivel:0..3`.
