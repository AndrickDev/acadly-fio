# Roadmap

Ordem pensada para **provar o risco maior primeiro** (o Bluetooth funciona numa sala de verdade?), depois ligar o app aos sistemas da Fio, depois cobrir a prova.
Cada fase termina com algo demonstrável. As datas ficam em aberto até a Fio decidir o piloto.

## Concluído: protótipo (v0.1)

- [x] Regras R1 a R10, máquina de estados da chamada e validador, com 17 testes
- [x] API com PostgreSQL (PGlite em desenvolvimento) e 9 testes de integração
- [x] Simulação de 175 alunos concorrentes: 100% de acerto, nenhuma fraude aceita
- [x] App Android: turmas, chamada com cronômetro, presença ao vivo, presença manual, enquete, painel de Evidências
- [x] Retomar a chamada ao reabrir a turma; conta lembrada por papel
- [x] Identidade visual da Unifio (azul e laranja do logotipo)
- [x] [`EVIDENCE.md`](EVIDENCE.md): levantamento do Acadly só com fontes públicas

## Agora: Bluetooth real (v0.2)

Detalhes e plano de teste em [`docs/bluetooth.md`](docs/bluetooth.md).

- [ ] **Laboratório BLE**: tela que emite e escuta e mostra a força do sinal, para medir em sala de aula antes de decidir qualquer limite
- [ ] **Provedor Bluetooth**: o celular do professor emite o código que muda a cada 5 s; o do aluno escuta e envia código e sinal ao servidor
- [ ] **"Presente (revisar)"**: sinal fraco ou duvidoso vira um estado amarelo que o professor revisa de uma vez no fim, em vez de aceitar ou bloquear
- [ ] **Notificação** no celular do aluno quando a chamada abre (o Acadly faz assim)
- [ ] **Piloto numa sala** com 3 ou mais aparelhos, para testar o sinal passando de aluno em aluno (mesh) e a sala ao lado

Critério de pronto: numa sala real, presença correta para quem está dentro e "revisar" para quem está no corredor, sem o aluno fazer nenhum passo a mais.

## Próximo: integração com a Fio (v0.3)

- [ ] Importar turma e alunos por **CSV** (chave: RA). Funciona sem depender de ninguém
- [ ] **Exportar a chamada em CSV** no formato que o Portal aceita
- [ ] Puxar turmas e alunos do **Moodle** pela API (um usuário técnico criado pela TI)
- [ ] **Login com RA e senha do Moodle** (a senha é validada no Moodle e não é guardada)
- [ ] Histórico e relatório de faltas por aluno e por turma
- [ ] Monitor ou co-professor na mesma turma
- [ ] Chamada **agendada** pelo horário da turma (e, depois, pela sala via ensalamento)

## Modo Prova (v0.4)

Hoje a prova usa **ATA em papel**. A proposta é começar **em paralelo ao papel**, sem substituí-lo.

- [ ] **Lista do fiscal** no celular: toca em "Entrou" e "Entregou", com horário. Funciona sem internet e sincroniza depois
- [ ] **ATA em PDF** gerada pelo sistema, para continuar assinando até a faculdade aprovar só o digital
- [ ] Alertas: saiu e voltou, saiu antes do tempo mínimo, entrou e não entregou
- [ ] Várias turmas na mesma sala; vários fiscais
- [ ] **QR na carteirinha** para dar velocidade nas turmas grandes (depois da lista, não antes)

## Produção (v1.0)

- [ ] Servidor e Postgres hospedados, com backup
- [ ] HTTPS, segredos fora do código, limite de tentativas por IP
- [ ] **LGPD**: política, consentimento, tempo de guarda; **não guardar** o grafo de quem esteve perto de quem além do necessário para validar a chamada
- [ ] Login institucional (Moodle e conta Google `.edu.br`)
- [ ] Distribuição do aplicativo Android (APK assinado ou Google Play em teste interno)
- [ ] Testes ponta a ponta e acompanhamento de erros

## Ideias para depois

- Dentro do Moodle como atividade (LTI 1.3), para o professor abrir a chamada sem sair do curso
- Um beacon barato em cada sala, ligado ao ensalamento, para separar sala ao lado e corredor
- Alerta de evasão (faltas seguidas)
- Painel para a coordenação
- iOS (hoje fora do escopo)

## Decisões em aberto (precisam da Fio)

- Versão do Moodle, se o plugin de **Frequência** está instalado e quem administra Moodle e Portal
- Formato exato do CSV que o Portal aceita
- Se a ATA digital pode, um dia, substituir a de papel
- Qual professor e qual sala fazem o piloto

## Fora de escopo, por decisão

- **GPS**, em linha com o Acadly e com a LGPD
- Decompilar ou interceptar o aplicativo do Acadly
- Guardar histórico de proximidade entre pessoas
