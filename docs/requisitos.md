# Levantamento de requisitos

Serve para você decidir o que aprovar. Cada item tem uma **recomendação** com o motivo; marque `[x]` no que aprovar.

Legenda de estado: `[x]` já existe e foi testado · `[~]` existe pela metade · `[ ]` não existe.
Esforço: **P** (horas), **M** (dias), **G** (semana ou mais).

## 1. Como os apps parecidos resolvem

Quase tudo abaixo vem da página de cada produto ou de comparativos de fornecedores (o do Acadly é feito por ele mesmo), então trate os pontos fracos como alegação de mercado, não como medição.

| App | Como confirma presença | Ponto forte | Ponto fraco citado | O que levamos |
|---|---|---|---|---|
| **Acadly** | Bluetooth e WiFi entre os celulares, ~2 min, sem GPS | O aluno só abre o app; professor marca à mão quem falhar | Brecha admitida: ficar na porta ou emprestar o celular. Mecanismo antifraude não é público | Mesmo princípio, mais o estado "revisar" |
| **Top Hat** | Código de 4 dígitos que muda a cada sessão; localização opcional | Simples, funciona em qualquer celular | Código pode ser repassado por mensagem | Código que muda em segundos, não por sessão |
| **iClicker** | GPS ou marcação manual | Conhecido, tem enquetes | GPS falha dentro de prédios e pode ser falsificado | Não usar GPS |
| **QR por aula** | Aluno lê um QR no projetor | Fácil de implantar | Foto do QR circula fora da sala; difícil de ler do fundo | Reservar o QR para a prova (o fiscal vê a pessoa) |
| **Plugin Frequência do Moodle** | Professor registra por sessão | Já está onde a Fio tem os dados | **Não verifiquei** os recursos de auto-registro | Verificar no Moodle da Fio antes de integrar |
| **Reconhecimento facial** (IAmHere do Ifes, Chamada Inteligente do Paraná) | Foto da turma, o sistema reconhece | Chamada em 20 a 30 s, segundo o projeto do Ifes | Dado biométrico é sensível na LGPD | **Não recomendo** para a Fio |

## 2. O que já existe

- [x] Chamada com janela de tempo (2, 5 ou 10 min) e encerramento automático
- [x] Regras R1 a R10 com o motivo da decisão exibido ao aluno (17 testes)
- [x] Aluno marca presença com um toque; o app mostra o resultado e a regra
- [x] Professor acompanha ao vivo, marca ou desfaz à mão, e vê alertas de fraude
- [x] Retomar a chamada ao reabrir a turma
- [x] Enquete rápida durante a aula
- [x] Painel de Evidências (qual regra decidiu cada tentativa)
- [x] Banco PostgreSQL, API com testes, simulação de 175 alunos (100% de acerto)
- [x] Tema escuro e claro, identidade da Unifio, ícone do app
- [~] Login: existe a tela e a sessão **fica salva** no aparelho (armazenamento seguro), mas é só por nome, sem senha
- [~] Bluetooth: o servidor valida; o aparelho usa Bluetooth real (implementado em 2026-10-20, **sem teste em aparelho**); no emulador a detecção é simulada. O Laboratório de medição está pronto

## 3. Aluno

| | Requisito | Recomendação | Esforço |
|---|---|---|---|
| [ ] | **Ver a frequência por turma** (percentual, faltas, alerta perto do limite) | **Aprovar.** É o que o aluno mais quer ver. A faculdade costuma exigir 75%, mas o percentual vem dos regimentos das instituições; confirmar o da Fio | M |
| [ ] | Histórico de presenças por aula | Aprovar junto com o item acima | P |
| [ ] | **Notificação** quando a chamada abre | **Aprovar.** O Acadly Here faz assim; sem isso o aluno precisa lembrar de abrir o app | M |
| [ ] | Login por RA e senha do Moodle | **Aprovar**, depois de confirmar com a TI como o Moodle autentica | M |
| [ ] | Manter o login por tempo limitado (ex.: 90 dias) e sair sozinho se o servidor não reconhecer a sessão | **Aprovar.** Hoje a sessão não expira (sair sozinho já está pronto) | P |
| [ ] | Bloqueio por biometria do celular ao abrir | Opcional. Útil se o aparelho for emprestado | P |
| [ ] | Justificar falta e anexar atestado | Só se a secretaria quiser. É processo da faculdade, não só do app | G |
| [ ] | Ver quais dados o app guarda sobre mim | **Aprovar** para a LGPD | P |

## 4. Professor

| | Requisito | Recomendação | Esforço |
|---|---|---|---|
| [ ] | **Tela "Hoje"**: turmas do dia em ordem de horário, um toque para iniciar | **Aprovar.** Resolve quem dá aula em turmas diferentes no mesmo dia | M |
| [ ] | **Importar turma e alunos por CSV** (chave: RA) | **Aprovar primeiro.** Funciona sem depender da TI | M |
| [ ] | **Exportar a chamada em CSV** para o Portal | **Aprovar.** O Portal aceita CSV; falta o formato exato | P |
| [ ] | Histórico de chamadas por turma | Aprovar | M |
| [ ] | Ajustar a presença depois da chamada encerrada, com registro de quem alterou | **Aprovar.** Sem isso o professor perde o controle; o registro dá segurança | M |
| [ ] | Marcar "Presente (revisar)" quando o sinal é fraco | **Aprovar.** É a resposta ao aluno no corredor, sem passo extra | M |
| [ ] | Monitor ou co-professor na mesma turma | Aprovar | M |
| [ ] | Chamada agendada pelo horário da turma | Opcional, depois do "Hoje" | M |
| [ ] | **Modo Prova** (lista do fiscal com entrada e saída, ATA em PDF) | **Aprovar como fase própria.** Hoje é ATA em papel; começar em paralelo | G |

## 5. Coordenação, secretaria e TI

| | Requisito | Recomendação | Esforço |
|---|---|---|---|
| [ ] | Relatório por turma e por curso | Aprovar | M |
| [ ] | Alerta de aluno perto do limite de faltas | Aprovar (usa a frequência do aluno) | P |
| [ ] | Registro de quem alterou cada presença | **Aprovar** (obrigatório para auditoria) | M |
| [ ] | Puxar turmas e alunos do Moodle pela API | Aprovar depois do CSV; precisa de um usuário técnico da TI | M |
| [ ] | Servidor e banco hospedados, com backup e HTTPS | **Aprovar** (sem isso não há uso real) | M |
| [ ] | Distribuir o app (APK assinado ou Google Play em teste interno) | **Aprovar** | P |
| [ ] | Política de privacidade e consentimento (LGPD) | **Aprovar** | P |

## 6. Requisitos não funcionais

- [ ] **Bluetooth validado numa sala real** (separar sala e corredor) antes de qualquer promessa à faculdade
- [x] Contraste e leitor de tela: botões e peças têm rótulo; cores atendem contraste nos dois temas
- [ ] **Desempenho com turmas de 60 ou mais alunos** (a grade de peças e a atualização a cada 2 s)
- [ ] Funcionar com internet ruim (fila local e reenvio) para o fiscal na prova
- [ ] Segredos fora do código e limite de tentativas por IP no servidor
- [ ] Android mínimo e aparelhos de teste definidos
- [ ] **Não guardar** o histórico de quem esteve perto de quem além do necessário para validar a chamada

## 7. Decisões que dependem de você

1. Posso fazer **frequência do aluno, tela "Hoje" e CSV** antes do Bluetooth? (Recomendo: o Bluetooth é o maior risco, mas esses três deixam o app apresentável sem depender do aparelho.)
2. A faculdade quer **justificativa de falta** dentro do app?
3. Posso **reservar o QR só para a prova**?
4. Reconhecimento facial fica **fora**, certo?
