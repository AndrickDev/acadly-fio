# Chamada Fio

## Problema e objetivo

Professores do Centro Universitário de Ourinhos (Unifio) fazem a chamada à mão ou com ferramentas que aceitam fraude (código repassado, aluno na porta). Objetivo: chamada por proximidade, sem GPS, em que o aluno só toca em "Marcar presença" e o sistema confere se ele está na sala. Detalhes e comparativo com Acadly, Top Hat e iClicker em [`docs/requisitos.md`](docs/requisitos.md) e [`EVIDENCE.md`](EVIDENCE.md).

## Público e papéis

- Professor: cria turma, abre a chamada (2, 5 ou 10 min), acompanha ao vivo, corrige à mão.
- Aluno: entra na turma por código e marca presença.
- Depois: fiscal de prova, coordenação, secretaria e TI da Fio (ver roadmap).

## Fluxos da versão atual (v0.1, protótipo)

Criar turma, iniciar chamada, aluno marcar presença, servidor aplicar R1 a R10 e explicar a regra decisiva, presença manual, enquete, painel de Evidências. Regras em [`README.md`](README.md).

## Escopo

Roadmap por fase em [`ROADMAP.md`](ROADMAP.md): v0.2 chamada presencial com Bluetooth real, v0.3 aula online; Moodle/Portal, login institucional, lista final e Modo Prova ficam para depois.

## Fora de escopo (decisão)

GPS, reconhecimento facial, decompilar o Acadly, guardar histórico de proximidade entre pessoas, beacon ou equipamento por sala. iOS fica para depois do Android.

## Requisitos

Android 13 ou mais novo por enquanto (iPhone depois). LGPD: não guardar o grafo de proximidade além do necessário para validar a chamada. Interface em português-BR, contraste e rótulos de acessibilidade nos dois temas.

## Restrições técnicas

Monorepo npm: `packages/core` (TypeScript puro), `apps/server` (Fastify, Drizzle, PostgreSQL; PGlite em dev), `apps/mobile` (Expo SDK 58, React Native). Bluetooth não roda no Expo Go: exige build de desenvolvimento.

## Decisão de stack (2026-10-18)

Expo/React Native é o protótipo: entrega rápida para mostrar à Fio e validar o conceito. A meta de longo prazo é app nativo Android (Kotlin + Jetpack Compose), reaproveitando servidor e `packages/core`. O gatilho para migrar é o teste real do Bluetooth (issues de BLE); se a lib atual não der conta, o módulo de BLE vai para Kotlin primeiro. Não reescrever o app inteiro antes disso.

## Decisões pendentes

Dependem da Fio: versão do Moodle e plugin Frequência, formato do CSV do Portal, ATA digital no lugar da de papel, professor e sala do piloto. Decisões do dono do produto: ver `docs/requisitos.md` §7.

## Critério de aceite

Numa sala real, presença correta para quem está dentro e "revisar" para quem está no corredor, sem passo extra para o aluno (critério da v0.2 em `ROADMAP.md`).
