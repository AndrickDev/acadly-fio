# Handoff: acadly-fio (2026-10-20)

## Estado
Protótipo da chamada presencial por Bluetooth montado, **nada commitado** (git status: ~20 arquivos modificados). APK pronto: `dist/ChamadaFio-0.2.1-prototipo.apk` (build ok, Android 13+, arm64). **Bluetooth nunca testado em aparelho real.** Teste planejado para quarta 2026-10-21 com 2 celulares (um é S21 FE).

Testes: core 21/21, server 14/14, `npm run simulate` ok, `tsc --noEmit` ok (server e mobile).

## Decisões do dono (2026-10-19/20)
- Foco só na chamada. Moodle, lista final, login/senha, iPhone: depois.
- Android 13+ mínimo. Escala: 148 salas + 5 anfiteatros + 7 blocos, 20-50 alunos/sala, ~4.000 alunos.
- Sem beacon/equipamento por sala (descartado; Acadly também diz não usar).
- Sem mesh agora: BLE direto (salto 0). Chave Direto/Repasse na Conta do professor já existe, mas Repasse age como Direto. Decidir mesh por medição, testando também um anfiteatro.
- Aula online (v0.3): chamadas surpresa em momento aleatório + desbloqueio do celular. Amigo com o celular na mão é aceito; de casa não.
- Professor resolve "revisar"; coordenação só vê relatório e exceções.
- Push (Firebase/FCM) fica para depois; hoje o aluno vê a chamada por consulta a cada 3 s com o app aberto.

## O que mudou no código
- core: `rssi` na tentativa, `review` na decisão, `RSSI_REVISAR_ABAIXO = -80` (PROVISÓRIO, sem calibração), `TOKEN_HEX_LEN = 12` (`rules.ts`, `types.ts`, `validator.ts`).
- server: migração `0002_sinal_e_modo` (sessions.mode, checkins.rssi/review, attempts.rssi); check-in aceita `readings[{token,rssi}]` e escolhe o token da própria sala; `/manual` com present=true confirma revisão (`app.ts`, `token.ts`, `db/`).
- mobile: `bleProvider` real (`proximity.ts`, escuta 6 s), professor emite token a cada 4 s (`Professor.tsx`), peça laranja "revisar" (`ui.tsx`), chave de modo (`Conta.tsx`, `App.tsx`). Provider BLE usado quando a lib existe; senão simulado.
- docs: ROADMAP.md reescrito, PRODUCT.md, docs/bluetooth.md (seção "Estado do protótipo"), contagem de testes.

## Riscos abertos
- **A validar no aparelho:** dado de fabricante volta da escuta como hex? anúncio (UUID 128 bits + 6 bytes) cabe? permissões pedidas no momento certo?
- Auditoria anterior (ainda valem): token igual para todos os alunos, `hops/witnesses` forjáveis, login só por nome, `joinCode` fraco, `witnesses` guardado no banco (LGPD), polling de 3 s não escala, `usesCleartextTraffic: true` (tirar antes de piloto fora da rede).

## Roteiro do teste (2 celulares)
1. Instalar o APK nos dois, permitir "Dispositivos por perto".
2. PC na mesma rede Wi-Fi: `npm run server` (sem `SIM_BEACON`). IP do PC na última vez: 192.168.3.8 (conferir com `ipconfig`); endereço no login: `http://IP:3333`.
3. Professor cria turma; aluno entra pelo código; professor inicia; aluno toca no botão.
4. Medir: perto, 5 m, atrás da parede, corredor. Anotar resultado e RSSI (Laboratório BLE na Conta ajuda).

## Próximo passo
Rodar o teste, registrar medidas, depois decidir: calibrar o limite, tentar o anfiteatro, e só então servidor hospedado, push e aula online. Commit/push só quando o dono pedir.
