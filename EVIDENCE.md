# EVIDENCE.md — Acadly (módulo de presença e engajamento)

Método: **engenharia reversa de caixa limpa**. Nenhum APK foi decompilado e nenhum tráfego foi interceptado.
Só material público (FAQ e páginas de marketing do Acadly e de universidades parceiras).

Legenda de confiança:
- `[OBSERVADO]` — dito em fonte pública (URL abaixo).
- `[INFERIDO]` — dedução razoável do comportamento descrito.
- `[PROJETO]` — decisão desta implementação, sem evidência do Acadly.

## Fontes

- S1 — FAQ: https://moodle-lti.acadly.com/faq.html
- S2 — Página para alunos: https://moodle-lti.acadly.com/for-students.html
- S3 — Troubleshooting UIC: https://help.uillinois.edu/TDClient/37/uic/KB/ArticleDet?ID=2353
- S4 — Acadly vs clickers: https://uic.acadly.com/acadly-vs-clickers.html
- S5 — Acadly Here: https://www.acadly.com/here
- S6 — Reviews G2: https://www.g2.com/products/acadly/reviews_and_filters

Observação: as fontes divergem na duração da janela (S1: ~2 min; outra página: 2,5 min). Aqui o padrão é 120 s, configurável.

## 1. Máquina de estados da sessão de chamada

```
CRIADA ──professor inicia──▶ ABERTA ──janela expira──▶ FINALIZADA
                               │
                               └──professor encerra──▶ FINALIZADA
```

| # | Transição | Evidência |
|---|-----------|-----------|
| T1 | Professor inicia a chamada (`CRIADA → ABERTA`). Nada acontece sem o gatilho do professor. | `[OBSERVADO]` S1 "once started by the instructor" |
| T2 | Janela fixa curta; ao fim encerra sozinha (`ABERTA → FINALIZADA`). | `[OBSERVADO]` S1 (~2 min, "ends automatically") |
| T3 | Professor pode encerrar antes (`ABERTA → FINALIZADA`). | `[PROJETO]` |
| T4 | Ao finalizar, os rádios do celular do aluno são desligados. | `[OBSERVADO]` S1 |
| T5 | Depois de `FINALIZADA`, só o professor ou assistente edita presença (manual). | `[OBSERVADO]` S1 (manual edit); `[INFERIDO]` bloqueio do auto check-in |
| T6 | O app do aluno precisa estar aberto durante a janela. | `[OBSERVADO]` S1 |

## 2. Verificação de proximidade (sem GPS)

| Fato | Confiança |
|------|-----------|
| Alunos são descobertos por **mesh Bluetooth + WiFi**; o sinal "salta" de aparelho em aparelho na sala. | `[OBSERVADO]` S1, S5 |
| WiFi não é obrigatório; dados móveis servem. | `[OBSERVADO]` S1 |
| **GPS não é coletado nem armazenado.** A permissão de localização no Android é só uma "peculiaridade" do scan BLE/WiFi. | `[OBSERVADO]` S1 |
| Quem está fora da sala não entra no mesh e não é marcado. | `[OBSERVADO]` S1 |
| Janela curta impede ficar fora da sala e marcar presença à distância. | `[OBSERVADO]` S5 |
| Lacunas conhecidas: ficar na porta durante a janela, ou um amigo levar o celular do colega. | `[OBSERVADO]` FAQ (concessão do próprio Acadly) |
| Sem celular ou sem bateria: o professor ou assistente marca "Presente" à mão, no web e no mobile. | `[OBSERVADO]` S1 |
| Usuários relatam instabilidade do Bluetooth (reabrir o app). Por isso a validação aqui é tolerante a falha de rede e idempotente. | `[OBSERVADO]` S6 |

### Algoritmo desta implementação (`[PROJETO]`, derivado do acima)

O Acadly não publica o algoritmo antifraude. O modelo abaixo é nosso e sustenta as regras R1–R10.

1. **Beacon rotativo.** O telefone do professor transmite `token = HMAC(secret, sessionId ‖ slot)`, truncado. `slot = ⌊t / 5 s⌋`. O token só existe nesse slot; aceita-se ±1 slot de deriva.
2. **Mesh por saltos.** O aluno que ouve o professor tem `hops = 0`. Quem só ouve outro aluno tem `hops = n+1`, até `MAX_HOPS = 3`, e carrega a lista de testemunhas (vizinhos que ouviu).
3. **Âncora.** Se `hops > 0`, ao menos uma testemunha precisa já estar **presente** na sessão. Isso impede um cluster de celulares fora da sala atestando uns aos outros.
4. **Anti-duplicata de hardware.** Um `deviceId` só pode ser usado por **um** aluno por sessão.
5. **Anomalias** (`AlertaAnomalia`): `DUPLICATE_DEVICE`, `BURST` (rajada de tentativas), `ORPHAN_CLUSTER` (testemunhas sem âncora), `STALE_TOKEN_REPLAY`.

## 3. Regras de validação (ordem de execução)

| ID | Código de rejeição | Regra | Confiança |
|----|--------------------|-------|-----------|
| R1 | `REJECT_SESSION_NOT_FOUND` | A sessão existe. | `[PROJETO]` |
| R2 | `REJECT_OUT_OF_WINDOW` | A sessão está `ABERTA` e `agora < abertura + janela`. | `[OBSERVADO]` S1 |
| R3 | `REJECT_NOT_ENROLLED` | O aluno está matriculado na turma. | `[INFERIDO]` |
| R4 | `REJECT_RATE_LIMITED` | No máximo 5 tentativas por `deviceId` a cada 10 s. Gera alerta `BURST`. | `[PROJETO]` |
| R5 | `REJECT_ALREADY_CHECKED_IN` | Um check-in por aluno por sessão. | `[INFERIDO]` |
| R6 | `REJECT_DUPLICATE_DEVICE` | Um `deviceId` por aluno por sessão. Gera alerta `DUPLICATE_DEVICE`. | `[PROJETO]` (loophole "celular do amigo" em S-FAQ) |
| R7 | `REJECT_INVALID_TOKEN` | O token HMAC bate num slot dentro de ±1. | `[PROJETO]` |
| R8 | `REJECT_TOO_MANY_HOPS` | `hops ≤ 3`. | `[PROJETO]` |
| R9 | `REJECT_NO_ANCHOR` | Se `hops > 0`, existe testemunha já presente. Gera alerta `ORPHAN_CLUSTER`. | `[PROJETO]` |
| R10 | `ACCEPT` | Aceito: grava o check-in `AUTO`. | — |

A ordem é intencional. As verificações baratas e sem segredo vêm primeiro (R1–R6). As de criptografia e mesh vêm depois (R7–R9).

## 4. Entidades

- **Turma (`classes`)**: `id, nome, professor_id`.
- **Matrícula (`enrollments`)**: `class_id, student_id`.
- **SessaoPresenca (`sessions`)**: `id, class_id, state, opened_at, window_ms, closed_at, secret`. `[OBSERVADO]` estados e janela.
- **Participacao/CheckIn (`checkins`)**: `session_id, student_id, device_id, hops, witnesses, method (AUTO|MANUAL), at`. `UNIQUE(session_id, student_id)` e `UNIQUE(session_id, device_id)`. `[OBSERVADO]` presença manual (S1).
- **Tentativa (`attempts`)**: log de auditoria de cada validação com `rule` e `reason`. Alimenta o Painel de Evidências. `[PROJETO]`
- **AlertaAnomalia (`alerts`)**: `session_id, kind, details, at`. `[PROJETO]`
- **Atividade em tempo real (`activities`, `responses`)**: enquetes e quizzes são recurso à parte da presença. `[OBSERVADO]` S1/S4
