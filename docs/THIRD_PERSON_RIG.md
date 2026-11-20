# Rig de terceira pessoa

Execute `npm run dev` e abra `/tools/review/prototype/` no servidor
local para testar a personagem e o rig em um plano com grade. O painel
mostra o heading de locomoção, o alvo da câmera e o yaw renderizado.

| Entrada | Modo experimental |
| --- | --- |
| W | Avança no heading de locomoção atual |
| W+D ou W+A | Avança em arco com esterço contínuo para a direita ou esquerda |
| A ou D | Avança e esterça mesmo sem W |
| Joystick | A componente horizontal governa o esterço. A magnitude governa a velocidade |
| S | Caminha para trás mantendo a orientação da personagem |
| Mouse ou segundo toque | Controla o ponto de vista durante o gesto. A locomoção continua na direção comandada |
| C ou botão de câmera | Volta ao acompanhamento da locomoção |

Quando a entrada lateral termina, a trajetória segue reta no heading já
alcançado. A câmera apenas termina a suavização em direção ao alvo
corrente. No modo Estável, A/D voltam a deslocar lateralmente em relação
à câmera e o yaw permanece sob controle manual.

## Implementação

Na versão anterior, o yaw de movimento ficava fixo durante o gesto e a
câmera tinha um limite de 15°, seguido de uma espera ao soltar a direção.
Isso preservava a trajetória lateral anterior, mas mantinha a câmera
fora da curva solicitada. Nas primeiras tentativas, recalcular a entrada
lateral sobre o yaw que a própria câmera acabara de alterar introduzia
realimentação.

O novo rig integra a componente horizontal uma única vez como velocidade
angular. O heading resultante define a orientação da personagem e o alvo
da câmera no mesmo frame, e a posição segue o arco calculado nesse frame.
O yaw renderizado entra apenas na interpolação da câmera. O esterço
contínuo produz uma curva contínua deliberada. Soltar o esterço deixa o
heading constante. O rig reutiliza o movimento com colisões e o resolvedor
de obstruções do jogo.

## Referências

- `three-player-controller` 0.6.3 (MIT) vincula o yaw da câmera à
  orientação do corpo na locomoção. O pacote aceita Three.js 0.159 ou
  posterior e requer `three-mesh-bvh`. O exemplo usa WebGL, como o Game
  Love. [CameraSystem](https://github.com/hh-hang/three-player-controller/blob/master/src/systems/CameraSystem.ts)
- `meshwalk` 2.1.0 (MIT) atualiza o alvo por frame e usa uma varredura
  esférica para a câmera. Declara Three.js `^0.185.1`, faixa que exclui a
  versão 0.187.0 do Game Love, e depende de `camera-controls`.
  [ThirdPersonCameraControls](https://github.com/yomotsu/meshwalk/blob/master/src/TPS/ThirdPersonCameraControls.ts)
- As skills `character-camera`, `character-kit` e `character-input`
  (MIT) orientaram a separação entre input, locomoção, modelo e órbita.
  O kit usa Three.js 0.187.0 com WebGPU e Jolt. O Game Love usa WebGL e o
  próprio sistema de colisões.
  [Skills de personagem](https://github.com/wolffe/three.js-skills/tree/main/skills/character)

Foram consultados o código e os manifestos públicos. A solução é local e
mantém as dependências existentes. A análise das referências foi de
arquitetura, compatibilidade e dependências, sem auditoria completa dos
pacotes de terceiros.
