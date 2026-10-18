# Chamada Fio: guia para agentes

Produto e escopo: [`PRODUCT.md`](PRODUCT.md). Fases: [`ROADMAP.md`](ROADMAP.md). Requisitos: [`docs/requisitos.md`](docs/requisitos.md). Bluetooth: [`docs/bluetooth.md`](docs/bluetooth.md). Setup e validação: [`docs/setup.md`](docs/setup.md).

## Stack

Monorepo npm workspaces: `packages/core` (regras R1-R10, TS puro), `apps/server` (Fastify + Drizzle + PGlite/Postgres), `apps/mobile` (Expo SDK 58, só Android). Não é Next.js: não aplicar defaults de Next/ESLint-Next.

## Comandos (reais)

- `npm install`
- `npm test` (vitest: core 17 + server 9)
- Typecheck: `npx tsc --noEmit` dentro de `apps/server` e de `apps/mobile`
- `npm run server` (com `SIM_BEACON=1` só em dev), `npm run mobile`, `npm run simulate`
- Não há lint nem build configurados. Não inventar scripts.

## Regras

- Responder em português-BR. Commits Conventional Commits em português, sem Co-Authored-By nem crédito de IA.
- Commit, push e publicação só quando o dono pedir. Nunca push em `main`, `--force` ou merge de PR.
- Regras R1-R10 ficam em `packages/core`; mudou regra, atualize testes, README e EVIDENCE.md no mesmo turno.
- Alterou comando, estrutura ou decisão: atualize as docs afetadas.
- Segredos fora do código; nunca guardar histórico de proximidade além do necessário.
- BLE só se prova em aparelho real; sem aparelho, marcar como "configurado sem execução".

## Fluxo por nível

0 trivial: direto + check. 1 bug/função: plano curto + checks. 2 feature multiarquivo: spec, teste antes, revisão uma vez. 3 auth, dados, migração, publicar: nível 2 + revisão de segurança + dono lê o diff.

## Backlog autônomo

Issues no GitHub com `status:*`, `nivel:*`. Só executar com a label `aprovado` (nível 3 exige também `aprovado-n3`). Uma issue por branch/worktree, `Refs #N`, PR com evidências.
