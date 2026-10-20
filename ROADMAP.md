# Roadmap

Foco único por enquanto: **a chamada de presença funcionar de verdade** (professor ativa, aluno confirma, sistema confere que está na sala). Integração com Moodle/Portal, login institucional e lista de presença final ficam para depois.

Ordem: provar o risco maior primeiro (o Bluetooth separa sala de corredor?), depois a chamada completa, depois aula online, depois o resto. Cada fase termina com algo demonstrável. Datas em aberto até a Fio decidir o piloto.

## Premissas (informadas pelo dono do produto, 2026-10-19)

- Escala: 148 salas de aula, 5 anfiteatros e 7 centrais de aulas; de 20 a 50 alunos por sala; cerca de 4.000 alunos.
- Aparelhos: Android 13 ou mais novo é o mínimo. iPhone **entra depois**, não agora.
- Sem equipamento novo nas salas (sem beacon, sem roteador).
- Fluxo desejado: o professor ativa a chamada, o celular do aluno recebe um aviso, o aluno aprova e já está presente.
- Aula online: só quem assistiu a aula consegue marcar presença, e o método não pode ser repassado a um amigo.

## Concluído: protótipo (v0.1)

- [x] Regras R1 a R10, máquina de estados da chamada e validador, com 21 testes
- [x] API com PostgreSQL (PGlite em desenvolvimento) e 9 testes de integração
- [x] Simulação de 175 alunos concorrentes: 100% de acerto, nenhuma fraude aceita (sem camada de rádio: não prova separação entre salas)
- [x] App Android: turmas, chamada com cronômetro, presença ao vivo, presença manual, enquete, painel de Evidências
- [x] Laboratório BLE (tela de medição); ainda não testado em aparelho real
- [x] Identidade visual da Unifio
- [x] [`EVIDENCE.md`](EVIDENCE.md): levantamento do Acadly só com fontes públicas

## Agora: chamada presencial de verdade (v0.2)

Detalhes em [`docs/bluetooth.md`](docs/bluetooth.md).

- [ ] **Medir o Bluetooth** com o Laboratório em 2 aparelhos Android 13+: 1 m, 5 m, 10 m, atrás da parede, corredor, bolso. Resultado decide o resto
- [ ] **Token do professor por Bluetooth**: contrato único entre servidor e anúncio (hoje o servidor gera 8 bytes e o anúncio comporta 6)
- [ ] **Aluno escuta e envia código e força do sinal (RSSI)**; o servidor guarda o RSSI como evidência
- [ ] **"Presente (revisar)"**: sinal fraco ou duvidoso vira um estado que o professor resolve ao fim da aula; quem decide é o professor, não a coordenação
- [ ] **Aviso no celular do aluno** (push) quando a chamada abre; um toque em "Estou aqui" confirma
- [ ] **Token ligado ao aluno**, para não valer se repassado por mensagem
- [ ] **Trilha de auditoria** de toda correção manual (quem, quando, valor anterior)
- [ ] **Piloto numa sala** com 3 ou mais aparelhos, incluindo a sala ao lado

Critério de pronto: numa sala real, presença correta para quem está dentro e "revisar" para quem está no corredor, sem passo extra para o aluno.

Se o Bluetooth não separar sala de corredor, reavaliar com os dados: confirmação do professor, QR rotativo no projetor e sinal do Wi-Fi da sala (a faculdade já tem). Beacon por sala está **descartado**.

## Próximo: aula online (v0.3)

- [ ] Chamada em momento aleatório durante a aula ao vivo, com aviso no celular e janela curta (ex.: 60 a 90 s)
- [ ] Confirmação ligada ao aparelho do aluno (biometria ou bloqueio de tela do celular), sem senha repassável
- [ ] Várias chamadas surpresa por aula; presença = participou das chamadas mínimas
- [ ] Limite honesto documentado: nada impede o aluno de entregar o próprio celular desbloqueado a um amigo

## Depois (não agora)

- Exportar a chamada (CSV) e o que fazer com a lista de presença
- Integração com Moodle e Portal (CSV, API, login)
- Login institucional e senha; hoje o login é só por nome (protótipo)
- iPhone (descoberta e anúncio funcionam diferente; será um projeto próprio)
- Histórico e relatório de faltas por aluno, turma e curso
- Frequência do aluno e alertas de limite de faltas
- Monitor ou co-professor
- Chamada agendada pelo horário e pela sala (ensalamento)
- Modo Prova (lista do fiscal, ATA em PDF)
- Servidor hospedado com HTTPS e backup; política de privacidade e consentimento (LGPD); APK assinado
- Escala: trocar o polling de 3 s por push; barramento de eventos compartilhado se houver mais de um servidor

## Decisões em aberto

- Qual professor e sala fazem o piloto
- O que são as 7 "centrais de aulas" (se são salas grandes, estúdios ou polos)
- Meta aceitável de falso positivo e falso negativo (definir depois das medições)
- Retenção de dados de tentativas e remoção das testemunhas do banco (LGPD)

## Fora de escopo, por decisão

- **GPS**, em linha com o Acadly e com a LGPD
- **Beacon ou qualquer equipamento por sala** (o Acadly também não usa, segundo a documentação pública)
- Decompilar ou interceptar o aplicativo do Acadly
- Guardar histórico de proximidade entre pessoas
- Reconhecimento facial
