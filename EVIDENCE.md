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

---

## 5. O que o Acadly faz de bom (para copiar o espírito, não o código)

| Prática | Evidência | Como entra no acadly-fio |
|---|---|---|
| **Zero esforço do aluno**: abre o app, o resto é automático; sem GPS. | `[OBSERVADO]` S1, S2 | Mantido. Nenhum passo extra para o aluno. |
| **Início flexível** para o professor: app, web, add-in de PowerPoint ou execução agendada. | `[OBSERVADO]` acadly.com | Agendamento da chamada pelo horário da turma (futuro). |
| **Rádios desligam ao fim da janela** (bateria e privacidade). | `[OBSERVADO]` S1, S2 | Mantido no `BleProvider`: scan só durante a janela. |
| **Casos duvidosos são sinalizados para revisão do professor**, não só aceitos ou bloqueados. Cita corredor, estacionamento, "dispositivos que andam juntos" e "dispositivos compartilhados". | `[OBSERVADO]` acadly.com ("flags them in realtime") | Novo estado **"Presente (revisar)"**. Zero esforço do aluno, uma revisão do professor ao fim. |
| **Plano B manual** (sem celular, bateria acabou, falha de Bluetooth). | `[OBSERVADO]` S1, S2 | Já existe (presença manual). |
| **Tolerância a falha**: dados móveis bastam; se falhar, o professor corrige no fim da aula. | `[OBSERVADO]` S1, S2 | Já existe (check-in idempotente, edição manual). |
| **Integração com o LMS** (Moodle, Canvas, Blackboard) por plugin LTI. É oferta paga do Acadly (edição enterprise). | `[OBSERVADO]` Capterra, S1 | A Fio faz a própria integração, sem pagar o Acadly (ver §6). |
| **Engajamento junto da presença**: enquetes, quizzes, nuvem de palavras, chat. | `[OBSERVADO]` S4, Capterra | Enquete já existe. O resto é futuro. |
| **Relatórios e alertas** para coordenação. | `[OBSERVADO]` acadly.com | Exportação CSV e PDF (ver §6). |

### Lacunas: o que o Acadly NÃO documenta publicamente
- **Como separa a sala ao lado do corredor.** Diz só que usa tecnologia "patent-pending" que detecta anomalias, e que "só marca quem estava fisicamente na sala, não em algum lugar próximo". O mecanismo é inferência nossa (sinal + mesh).
- **Modo prova, entrada e saída, atraso e saída antecipada.** Nada nas fontes. A listagem da Capterra cita "tests and assessments", sem detalhes.
- **Matrícula por código de sala.** O Acadly não usa. A matrícula é feita pelo professor ou pela instituição, por convite via e-mail ou LMS. O código de 6 letras do acadly-fio é decisão nossa `[PROJETO]`.

### Fontes adicionais
- S7 — Acadly (página principal): https://www.acadly.com/here
- S8 — FAQ UIC: https://uic.acadly.com/faq.html
- S9 — Capterra: https://www.capterra.com/p/181697/Acadly/
- S10 — Página para alunos: https://moodle-lti.acadly.com/for-students.html

## 6. Contexto da Fio / Unifio `[PROJETO]` (informado pelo desenvolvedor, mais o que o site da Unifio mostra)

- **Objetivo:** sistema **próprio** da faculdade, para modernizar a chamada. O desenvolvedor é da Fio. Sem pagar plataforma de terceiros.
- **Função principal:** chamada por proximidade, no celular do professor e do aluno.
- **Moodle:** em `conhecer.unifio.edu.br`. O caminho `/login/index.php` é de Moodle, o que é inferência. Versão, plugins e método de login ainda não conhecidos.
- **Sistema acadêmico:** Portal do Aluno, do Professor e do Coordenador em `waeweb.unifio.edu.br` (nome do produto desconhecido). Não sabemos se aceita importar CSV.
- **E-mail institucional:** Outlook e Gmail.
- **Ensalamento:** a faculdade publica o ensalamento por semestre. Pode vincular turma a sala no futuro.
- **Prova:** hoje se assina **ATA em papel**. O digital deve começar **em paralelo** ao papel, até a faculdade aprovar substituir.
- **Cadastro:** idealmente reaproveitar os dados do Moodle (turmas e alunos), sem digitação.
- **Testes de Bluetooth:** 2 celulares Android. iPhone fora do escopo por enquanto.
- **Visual:** azul, laranja e branco. O site da Unifio traz o logotipo em versões "Azul" e "Branco". Cores extraídas do logotipo oficial (pixels exatos): azul `#004998` e laranja `#ED8A25`. No app: azul é ação e estrutura, laranja é atenção e progresso.

### Decisões de produto derivadas
1. **Integração Moodle em fases:** CSV, depois API de matrícula com token de serviço, depois login via Moodle. Custo zero de licença (a API do Moodle é nativa).
2. **Corredor e sala ao lado:** não há solução 100%. Meta: melhor que a ATA em papel, em que qualquer um assina por um amigo. Estratégia: sinal + testemunhas + estado "revisar", sem passo extra para aluno e professor.
3. **Modo Prova:** primeiro um **checklist digital do fiscal** (entrada e saída com horário, funciona sem internet), que gera a ATA em PDF para assinar. QR do aluno só depois, para ganhar velocidade.

### Acréscimo: o que a App Store mostra do "Acadly Here" `[OBSERVADO]` S7b
Fonte S7b — https://apps.apple.com/us/app/-/id1554424140 (app separado do Acadly, só para iPhone).

- Janela de **~150 s**, que o administrador pode encerrar antes. (Outras páginas dizem ~2 min.)
- O processo **é disparado por notificação** no celular do aluno. O histórico cita um bug em que, no iOS 12, a notificação não iniciava a chamada. Isso indica que o app **não precisa estar aberto o tempo todo**, o que a página para alunos sugere. Para o acadly-fio: notificação push ao abrir a chamada `[PROJETO]`.
- Administrador: cria grupos e sessões, vê a contagem **em tempo real**, edita o status à mão, adiciona **co-administradores** e exporta **CSV por sessão ou consolidado**.
- Lembretes (versão 1.0.5) e tela de progresso em tempo real para quem faz a chamada (1.1.0).
- O aluno vê estatísticas de presença no próprio app.
- Etiquetas de privacidade (declaradas pelo desenvolvedor): coleta nome, e-mail, ID de usuário e dados de uso. **Não declara localização.**
- Observação de cuidado: a UIC informa que o Acadly também registra a proximidade entre alunos e a usa para rastreamento de contatos. Isso é sensível em LGPD. O acadly-fio **não** deve guardar o grafo de proximidade além do necessário para validar a chamada `[PROJETO]`.

### Decisão sobre engenharia reversa `[PROJETO]`
Este levantamento usa **só fontes públicas**. Não foi usada nenhuma ferramenta de engenharia reversa (incluindo a REA) sobre o app do Acadly. O mecanismo antifraude é "patent-pending", e replicá-lo a partir de análise do aplicativo traria risco jurídico para a Fio. As regras R1 a R10 são de autoria própria.
