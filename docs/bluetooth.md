# Bluetooth: plano e testes

No emulador e no Expo Go a detecção é **simulada** (o app busca o código no servidor, o que não prova presença física). Em aparelho com o APK, o Bluetooth real está implementado e **ainda sem teste**. Este documento descreve a versão real e como testá-la com dois celulares Android.

Legenda: **[confirmado]** vem da documentação pública; **[a validar]** só se sabe testando no aparelho.

## Como funciona

1. O **celular do professor emite** (Bluetooth de baixa energia, sem pareamento) um código curto que muda a cada 5 s. O código sai do servidor (`GET /sessions/:id/beacon`), que é o único que conhece o segredo da chamada.
2. O **celular do aluno escuta**. Ao ouvir o código, envia ao servidor: o código, a **força do sinal (RSSI)** e o identificador do aparelho.
3. O servidor confere o código (regra R7) e aplica as demais regras. Se o sinal for fraco ou duvidoso, marca **"Presente (revisar)"** em vez de aceitar ou bloquear.
4. O aluno não faz nenhum passo extra além de tocar em **Marcar presença**.

O servidor já valida o contrato (código que muda a cada 5 s, saltos, testemunhas). Falta o lado do aparelho.

## Estado do protótipo (2026-10-20)

**Configurado sem execução em aparelho real.** Testes automáticos passam; o Bluetooth só se prova com 2 celulares.

- Professor: ao abrir a chamada, o app busca o código no servidor a cada 4 s e anuncia (UUID de serviço + dado de fabricante 0xFFFF com 6 bytes). `Professor.tsx`.
- Aluno: ao tocar, escuta 6 s e envia **todos** os códigos ouvidos com a mediana do sinal (`readings`). O servidor escolhe o que bate com o segredo da própria sala; código só da sala vizinha é rejeitado (R7). `proximity.ts`, `app.ts`.
- Sinal abaixo de `RSSI_REVISAR_ABAIXO` (-80 dBm, **provisório, sem calibração**) aceita a presença mas marca **revisar**; o professor toca no aluno (laranja) para confirmar. `packages/core/src/rules.ts`.
- Token de 12 hex (6 bytes) no servidor e no anúncio (`TOKEN_HEX_LEN`).
- **Modo da chamada** (Conta do professor): Direto ou Repasse. Repasse (mesh) **ainda não existe** e age como Direto; o aluno não vê o modo.
- Aviso ao aluno ainda é a lista de chamadas abertas (consulta a cada 3 s com o app aberto). Push (FCM) fica para depois.
- A suposição de que o dado de fabricante volta como texto hexadecimal na escuta é **a validar** no aparelho.

## Biblioteca

`munim-bluetooth` (emite e escuta na mesma biblioteca).

- **[confirmado]** Emite e escuta; no Android aceita dados de fabricante e de serviço no anúncio; o resultado do scan traz RSSI e esses dados.
- **[confirmado]** Exige React Native 0.78 ou mais novo e Expo SDK 50 ou mais novo (o projeto usa SDK 58).
- **[confirmado]** **Não roda no Expo Go**: precisa de um build de desenvolvimento.
- **[confirmado]** Android 12 ou mais novo pede `BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE` e `BLUETOOTH_CONNECT`; para escanear também pede localização.
- **[a validar]** Se a biblioteca é estável no S21 FE e no segundo aparelho. A `react-native-ble-plx` só escuta, por isso não serve sozinha.

## Riscos a medir

| Risco | Por que importa | Como tratar |
|---|---|---|
| **Tamanho do anúncio** | Um anúncio Bluetooth comum cabe em ~31 bytes. Um identificador de serviço de 128 bits já ocupa 18. | Anúncio não conectável e código de 6 a 8 bytes. **[a validar]** no aparelho. |
| **Sinal atravessa parede** | Aluno no corredor pode "ouvir" o professor. | RSSI + estado "revisar". Limite calibrado com dados reais, não chutado. |
| **Repassar o código** | Um amigo dentro da sala manda o código por mensagem a quem está fora. O código dura segundos. | Janela curta, RSSI, e o "revisar". Mesma brecha que o Acadly admite. |
| **Economia de bateria do fabricante** | Alguns Android encerram o app em segundo plano. | A chamada exige o app aberto; notificação abre a chamada. |
| **Android só** | iPhone limita o anúncio. | iOS fora do escopo. |

## O que o Bluetooth resolve e o que não resolve

| Resolve | Não resolve sozinho |
|---|---|
| Presença de casa | Aluno no corredor ou na sala ao lado (reduz com RSSI e "revisar") |
| Código repassado por mensagem depois de alguns segundos | Amigo que leva o celular do outro |
| Um aparelho para dois alunos (R6) | Alguém parado na porta durante a janela |

A meta é **ser melhor que a ATA em papel** (onde qualquer um assina por um amigo), não ser perfeito.

## Fatias de implementação

1. **Laboratório BLE**: tela com dois botões, "emitir" e "escutar", que mostra nome do aparelho e RSSI ao vivo. Serve para medir, não é produto.
2. **`BleProvider`**: implementa `ProximityProvider` (`apps/mobile/src/proximity.ts`) no lugar do simulado.
3. **Professor emite**: o app busca o código a cada ~4 s e atualiza o anúncio enquanto a chamada está aberta.
4. **Servidor aceita RSSI** no check-in e devolve o estado **revisar** (mudança em `packages/core`, com testes antes).
5. **Notificação** ao abrir a chamada.
6. **Piloto numa sala** com 3 ou mais aparelhos (mesh e sala ao lado).

Com dois aparelhos só se testa o **salto 0** (aluno ouvindo o professor direto). O sinal passando de aluno em aluno precisa de três ou mais.

## Plano de teste com dois aparelhos

Um é o professor (emite), o outro é o aluno (escuta). Anote o RSSI médio de ~10 leituras em cada ponto.

| Situação | O que esperar | Anotar |
|---|---|---|
| 1 m, linha de visão | sinal forte | RSSI |
| 5 m na mesma sala | sinal médio | RSSI |
| 10 m na mesma sala | sinal fraco | RSSI |
| Atrás de uma parede, ~5 m | sinal bem mais fraco que sem parede | RSSI |
| No corredor, perto da porta | o caso que queremos pegar | RSSI |
| Celular no bolso | atenuação do corpo | RSSI |

**Pronto quando:** os valores dentro da sala e fora dela (parede e corredor) ficam separados o bastante para definir um limite. Se não ficarem, o plano muda (por exemplo, beacon por sala) e isso é um resultado útil, não uma falha.

## Conectar o celular sem cabo

No Android 11 ou mais novo (o S21 FE tem):

1. Celular e computador na **mesma rede Wi-Fi**.
2. **Configurações → Opções do desenvolvedor → Depuração sem fio** → ativar.
3. Tocar em **Parear dispositivo com código de pareamento**. Anote o IP, a porta e o código de 6 dígitos.
4. No computador:
   ```powershell
   adb pair IP:PORTA_DO_PAREAMENTO CODIGO
   adb connect IP:PORTA_DA_TELA_PRINCIPAL_DA_DEPURACAO_SEM_FIO
   adb devices
   ```
5. O aparelho deve aparecer na lista. A porta do `connect` é a da tela principal da depuração sem fio, **diferente** da do pareamento.

Alternativa sem `adb`: gerar o APK e instalar copiando o arquivo para o celular (Drive, Telegram, e-mail). O build de desenvolvimento ainda precisa alcançar o computador pela mesma rede Wi-Fi.
