# acadly-fio

App de celular (Expo / React Native) para **chamada por proximidade sem GPS** e engajamento em sala, inspirado no fluxo público do Acadly.
Engenharia reversa de **caixa limpa**: só fontes públicas, citadas em [`EVIDENCE.md`](EVIDENCE.md).

```
packages/core    regras R1–R10, máquina de estados, validador (TS puro, testado)
apps/server      Fastify + Drizzle + PostgreSQL (PGlite em dev, Postgres em produção)
apps/mobile      Expo SDK 58 — telas de Professor, Aluno e Painel de Evidências
tests/           simulate_attendance.ts → relatório de acurácia (report.md / report.json)
```

## Rodar

```bash
npm install

# 1) servidor (porta 3333). SIM_BEACON=1 só em dev: simula o Bluetooth.
SIM_BEACON=1 npm run server

# 2) app — abra no Expo Go; na tela de login, informe http://<IP-do-PC>:3333
npm run mobile
```

Celular e PC na mesma rede Wi-Fi. No PowerShell: `$env:SIM_BEACON=1; npm run server`.

Fluxo: professor cria turma → aluno entra com o código → professor toca **Iniciar chamada** (janela de 120 s) → aluno toca **Marcar presença** → o professor vê presença, alertas e, na aba **Evidências**, qual regra decidiu cada tentativa.

## Testes

```bash
npm test            # 17 unitários (regras) + 8 de integração (API + banco)
npm run simulate    # 175 alunos concorrentes; gera tests/report.md e report.json
```

## Persistência

PostgreSQL em todos os ambientes, com o mesmo schema (`apps/server/src/db`).

| Ambiente | Config |
|---|---|
| Dev / testes | sem nada: PGlite (Postgres embutido) em `.data/pg`, ou em memória nos testes |
| Produção | `DATABASE_URL=postgres://...` (Neon, Supabase, RDS, Railway…) |

Migrações em SQL puro, aplicadas no boot com lock consultivo. Check-ins são serializados por sessão (`pg_advisory_xact_lock`), e `UNIQUE(session, aluno)` e `UNIQUE(session, device)` são a segunda barreira contra duplicata.

## Limites conhecidos (leia antes de usar em aula real)

1. **Bluetooth real não está implementado.** O app usa `SimulatedProvider`, que busca o token no servidor e **não prova presença física**. O contrato do mesh (token HMAC rotativo de 5 s, `hops`, testemunhas) já está no servidor. Falta o `BleProvider` com `react-native-ble-plx`, que exige *development build* e não roda no Expo Go. Em produção, deixe `SIM_BEACON` desligado.
2. **`deviceId` é um id de instalação**, não serial de hardware: iOS e Android não expõem esse dado. Para amarrar ao aparelho de verdade, use Play Integrity e App Attest.
3. **O algoritmo antifraude é nosso.** O Acadly não publica o dele. O que é `OBSERVADO`, `INFERIDO` ou `PROJETO` está rotulado em `EVIDENCE.md`. As lacunas que o próprio Acadly admite (ficar na porta, emprestar o celular) continuam existindo aqui.
4. **Login sem senha** (MVP): token HMAC por usuário. Troque por OIDC antes de produção.
5. O app atualiza por *polling* (2–3 s). O servidor também expõe SSE em `/sessions/:id/stream` para clientes web.
6. A simulação rodou em PGlite (conexão única). A concorrência em Postgres de verdade ainda precisa ser exercitada em um ambiente com `DATABASE_URL`.
