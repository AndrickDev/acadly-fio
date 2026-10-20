# Setup e validação

Toolkit: https://github.com/soumatheusgomes/vibe-coding-toolkit, revisão `de66fe3`. Adoção proporcional, só a parte agnóstica de stack (stack real: Expo + Fastify, não Next).

## Versões

Node v26.7.0, npm workspaces, Expo SDK 58, Fastify 5, Drizzle 0.36, vitest 2.

## Comandos e estado (2026-10-18)

| Comando | Resultado |
|---|---|
| `npm install` | validated (dependências já instaladas) |
| `npm test` | validated: core 21 + server 19 passando |
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

## Teste do Bluetooth com 2 celulares (servidor no Mac ou no Windows)

O servidor é Node puro e roda igual nos dois sistemas. O APK já pronto **não é refeito** no Mac: ele é copiado para os celulares e o endereço do servidor é digitado no login.

### Antes (com internet, em casa)

1. Instale o Node 22 ou mais novo (`node -v` confere). Mac: nodejs.org, ou `brew install node`.
2. `git clone https://github.com/AndrickDev/acadly-fio.git`, depois `git checkout feat/prototipo-ble` (até esse branch virar `main`).
3. `cd acadly-fio && npm install`.
4. Confira: `npm test` (deve mostrar core 21 e server 14 passando).
5. **O APK não vai no git** (`dist/` é ignorado). Copie `dist/ChamadaFio-0.2.1-prototipo.apk` do Windows para um Drive e baixe-o nos dois celulares Android 13+. Ao instalar, libere "instalar apps desconhecidos" para o navegador ou o Drive.
6. Abra o app uma vez em cada celular e permita **Dispositivos por perto**.

### No dia

1. Rede: ligue o **hotspot de um celular** (ou um roteador próprio) e conecte o computador e os dois celulares nele. Redes de faculdade costumam isolar os aparelhos entre si.
2. `npm run server` na pasta do projeto. Deve imprimir `acadly-fio server :3333 · db=pglite`. **Não** use `SIM_BEACON=1`: sem ele o código só chega por Bluetooth.
3. Descubra o IP do computador: Mac `ipconfig getifaddr en0` (ou `en1`); Windows `ipconfig`, linha "Endereço IPv4".
4. Mac: se aparecer "aceitar conexões de entrada para node?", clique em **Permitir**. Se já negou: Ajustes do Sistema, Rede, Firewall.
5. Em cada celular, no login, escreva `http://IP:3333` no endereço do servidor. Conferência rápida: abra `http://IP:3333/health` no navegador do celular; deve responder `{"ok":true}`.
6. Celular A entra como **Professor**, cria a turma e anota o código. Celular B entra como **Aluno** e usa o código da turma.
7. Professor: Iniciar chamada. Deve aparecer "Seu celular está emitindo o sinal da chamada".
8. Aluno: tocar no botão, perto do professor, e esperar cerca de 6 s.

### O que medir

| Situação | Resultado esperado | Anotar |
|---|---|---|
| 1 m | presente | aceito? sinal? |
| 5 m na sala | presente | aceito? |
| Atrás da parede | o que queremos separar | aceito, revisar ou não achou |
| Corredor | idem | idem |
| No bolso | atenuação do corpo | idem |

O **Laboratório Bluetooth** (Conta ou tela de login) mostra o RSSI ao vivo e ajuda a anotar. O limite atual (-80 dBm) é provisório; os números anotados aqui é que vão calibrá-lo.

### Se algo falhar

| Sintoma | Provável causa |
|---|---|
| Aluno não conecta ao servidor | Rede isola aparelhos, firewall do computador, IP errado |
| "Não encontrei o sinal do professor" | Bluetooth desligado, permissão negada, ou o dado do anúncio volta em formato diferente do esperado (a validar) |
| Aceito mas sempre laranja | Sinal abaixo de -80 dBm: normal no começo, é o que vamos calibrar |
| "Token inválido" | Relógios do computador e do servidor fora de hora, ou celular ouviu só outra sala |

Se usar o Claude Code no computador: abra a pasta e peça para ler `.claude/handoff.md`.

### Testar o Modo Prova (sem Bluetooth)

1. Entre como **Professor**, abra a turma (com alguns alunos já entrados pelo código) e toque na aba **Prova**.
2. Crie a prova ("P1 de Cálculo"). A lista da turma é baixada para o celular.
3. Ligue **Simular sala sem internet**, toque em alguns alunos (1º toque entrou, 2º entregou, segurar desfaz). O contador "por enviar" sobe.
4. Desligue a simulação: os toques sobem sozinhos (ou use **Enviar agora**). O contador volta a "Tudo enviado".
5. Toque em **Ver a ata** e depois em compartilhar.
6. Prova real do offline: ative o modo avião no celular e feche e abra o app; os toques continuam lá.
