# Exportação de revisão do Game Love

No macOS, com Node.js 20.19+ (ou 22.12+), Python 3 e os utilitários `zip` e `unzip` disponíveis:

```sh
npm ci
npm run review:export
```

Para comparar o último export com um ZIP preservado de uma versão anterior:

```sh
npm run review:compare -- --baseline /caminho/do/game-love-review-anterior.zip
```

O comando publica `artifacts/reviews/comparison/report.html`, um resumo
`comparison.json` e imagens lado a lado no HTML. Para incluir a comparação
no próprio ZIP e no HTML do novo export, use
`npm run review:export -- --baseline /caminho/do/game-love-review-anterior.zip`.
A referência é copiada para uma área temporária. O relatório registra o
SHA-256 dessa cópia e lê a data e o commit diretamente do
`metadata.json` arquivado, mesmo quando o ZIP já contém uma comparação.
Use um caminho diferente do ZIP de saída. O exportador recusa sobrescrever
o arquivo escolhido como referência.

Extraia o ZIP e abra `report.html` ao lado das pastas de imagens.
O relatório local usa caminhos relativos e funciona offline. Para um
HTML único opcional, acrescente `--standalone` ao export ou à comparação.

O exportador usa o Chromium do Playwright quando instalado e tenta o Google Chrome local em seguida. Para baixar o Chromium, execute `npx playwright-core install chromium`. Para selecionar outro binário compatível, use `REVIEW_BROWSER_PATH=/caminho/do/chromium npm run review:export`.

O comando executa o build em um diretório temporário e roda os testes antes da captura. Reutiliza uma página de revisão do Vite nas portas 5173, 5174, 5175 ou 5177, quando disponível. Para apontar para outro servidor de desenvolvimento local, use `REVIEW_URL=http://127.0.0.1:5177 npm run review:export`. Caso necessário, o exportador cria um servidor em loopback a partir da porta 4178, que é encerrado ao final. Para sempre criar um servidor separado, use `REVIEW_ISOLATED=1 npm run review:export`. O navegador usa um perfil descartável.

O pacote fica em `artifacts/reviews/game-love-review.zip`, e a cópia aberta do último relatório em `artifacts/reviews/latest/`. A execução seguinte substitui os resultados anteriores. O ZIP automático contém os quatro relatórios JSON, as capturas produzidas e, quando disponível, o snapshot de origem OSM compactado.

| Arquivo | Conteúdo |
| --- | --- |
| `metadata.json` | Data UTC, versão Git e indicador de alterações locais, build, testes, navegador, enquadramentos, origem, coordenadas e pontos indisponíveis |
| `performance.json` | FPS, média e p95 do intervalo bruto entre quadros, chamadas de desenho, triângulos, contagens do renderer, tempo de carregamento e distribuição da vegetação procedural no High Park OSM |
| `console-errors.json` | Exceções JavaScript, promises rejeitadas, falhas HTTP ou de rede em recursos e erros de captura |
| `geographic-correspondence.json` | Extensão, hash da fonte, divergências por ID, cruzamentos, rota, limites e versão Git |
| `screenshots/` | Vistas padronizadas, três capturas do jogo mobile com HUD, referência e sobreposição OSM |
| `geography/high-park-north.osm-source.json.gz` | Resposta de origem arquivada, com SHA-256 do JSON descompactado no relatório |
| `report.html` | Relatório offline com imagens relativas, métricas, geografia, ocorrências e comparação opcional |
| `comparison.json` e `comparisons/` | Identidade da referência, compatibilidade por ID e cópia única das imagens anteriores necessárias |

A medição usa 75 amostras brutas de `requestAnimationFrame`, depois de 15 intervalos de aquecimento. A cena fica estática. O tempo de carregamento abrange dados, construção e ativação pelo `SceneManager`, e o mesmo valor aparece para os pontos que reutilizam a cena já carregada. As contagens de memória incluem geometrias e texturas do renderer, em unidades de recurso. FPS e frame time dependem da máquina, do navegador e da aceleração gráfica. Eles não substituem testes em celular físico.

No High Park OSM, `vegetation.placed` enumera a vegetação procedural do recorte. `vegetation.grid` organiza árvores e instâncias de arbustos em quadrículas de norte para sul e de oeste para leste. `detailInstancesEnabled` informa quantas instâncias de detalhe foram habilitadas pelo perfil e pelo raio da câmera antes do descarte do renderer. O perfil está em `metadata.json`.

O benchmark de movimento dura cerca de 20 s e usa o `PlayerController`,
as colisões, a animação e a renderização do jogo a 1×. A direção segue
a rota OSM validada, a partir do spawn da entrada norte, em Chromium
desktop com perfil Alta. `performance.motion` inclui FPS, média, p50 e
p95 dos intervalos, distância, duração, erros e média, mínimo e máximo
de chamadas e triângulos. O percurso é separado das amostras estáticas.

## Pontos e origem geográfica

Os pontos e poses estão em [tools/review/points.js](../tools/review/points.js). A página interna de desenvolvimento em `/tools/review/index.html` usa o `SceneManager`, a personagem e o renderizador do jogo em um contexto separado. Ela não faz parte do build de produção e funciona sem inventário, memórias desbloqueadas ou acesso ao armazenamento do jogador.

As duas vistas de Toronto continuam DEMO. O High Park real tem poses cadastradas
para a calçada, a vegetação e o Nature Centre. A quinta captura conserva o ID da
série e descreve o Nature Centre como local especial. A ortográfica mantém norte
para cima e o metadado distingue a bbox dos dados da extensão visível da câmera.
Os dados DEMO têm origem ilustrativa. Coordenadas intermediárias só são convertidas
para referência geográfica quando o modo é OSM REAL.

As vistas 14–16 usam a página real do jogo em Chromium com toque emulado.
O teste integrado aciona o joystick, verifica deslocamento e entra no
High Park pelo botão real. Os quadros mostram a entrada e a saída com
HUD, e o mapa local aberto em uma vista separada. O jogo bloqueia o
botão de interação enquanto o mapa está aberto. A sessão usa fontes de
sistema para funcionar offline. Essas vistas registram a pose efetiva
da câmera de gameplay e são separadas do benchmark estático.

As vistas 09–11 detalham vegetação, transição trilha–grama e Nature
Centre. As vistas 12–13 usam uma sessão Chromium com viewport 390 × 844,
device scale factor 1, pixel ratio de renderização 1, perfil Equilibrada
e antialiasing desativado. São vistas de viewport emulado. Os quadros
estáticos usam o mesmo tempo inicial de animação, iluminação fixa e
geração procedural com sementes estáveis.

O comparador usa os IDs e confere posição, câmera, origem, hash OSM,
resolução e configuração gráfica antes de calcular variações. Pares
incompatíveis são marcados com os motivos. Mudanças de ambiente e dados
legados incompletos são destacados para interpretação dos tempos. A
avaliação visual continua sendo feita nas pranchas, sem um critério
automático baseado em diferenças de pixels.

## Vídeo opcional

O Playwright pode gravar a página, mas um vídeo reproduzível de 15–30 segundos exigiria um percurso de entrada separado por origem do mapa e uma etapa estável de codificação MP4. O exportador atual registra que não gerou vídeo e conclui a exportação normalmente.

Para anexar um MP4 de 15–30 segundos gravado manualmente no jogo:

```sh
cp /caminho/da/gravacao.mp4 artifacts/reviews/latest/high-park-walk.mp4
(cd artifacts/reviews/latest && zip -q ../game-love-review.zip high-park-walk.mp4)
unzip -tq artifacts/reviews/game-love-review.zip
```

Revise o vídeo antes de compartilhar. Uma nova exportação volta a gerar o ZIP automático sem o anexo manual.

## Problemas comuns

- **Chromium ausente ou WebGL indisponível.** Instale o navegador indicado acima ou tente o Google Chrome atualizado. Restrições de execução de processos ou de portas locais no ambiente em que o comando roda podem impedir o Vite ou Chromium de iniciar.
- **Pacote parcial.** Captura obrigatória ausente, falha de benchmark, de cartografia ou de teste torna o export parcial. O comando retorna código 1 após publicar os diagnósticos, quando consegue gerar um ZIP válido. Veja `report.html`, `metadata.json` e `console-errors.json`. Quando o processo falha antes dessa publicação, a última exportação permanece disponível.
- **Captura indisponível.** Confira a origem e o motivo em `metadata.json`. Um ponto ausente ou obstruído é registrado individualmente, e os demais pontos ainda podem ser exportados.
- **Exportação em andamento.** Aguarde o outro comando encerrar. Se tiver certeza de que um processo anterior foi encerrado abruptamente, remova o diretório vazio `artifacts/reviews/.export-lock` e tente novamente.

## Review Export v2.2

Os ZIPs preservados esclarecem a cadeia de referências. O arquivo
`v3.2-review-v2.zip` contém o commit `8827e9e0`. O intermediário
`v3.2-review-v2.1.zip`, commit `077b8df0`, foi exportado com esse
primeiro arquivo como referência. A revisão de Landmarks, commit
`0ddc4eb`, usou o intermediário para isolar a mudança no Nature Centre.
Cada comparação tem o seu próprio ZIP de origem.

Use `--baseline <arquivo.zip>` em ambos os comandos para selecionar a
referência. Acrescente `--baseline-sha256 <64 dígitos hexadecimais>`
para conferir um hash obtido separadamente. Os relatórios registram
nome efetivo do arquivo, hash calculado, resultado da conferência,
commit e data do ZIP. O export falha se o arquivo solicitado estiver
ausente, corrompido ou divergir do hash informado.

As vistas 01–16 conservam seus IDs. As vistas 17–18 mostram missão e
velocidade abertas. As vistas 19–21 registram o jogo em outros
viewports. A vista 22 repete a composição do Nature Centre em 375 ×
667. O teste integrado passa pelos quatro viewports, abre e fecha o
mapa e os painéis e percorre os portais de ida e volta. Em mobile,
ele mede o deslocamento da personagem durante um segundo toque que
gira a câmera. As safe areas são exercitadas com insets CSS simulados
e verificações geométricas de visibilidade e sobreposição.

A comparação marca visualmente HUDs com estados ou versões de layout
diferentes. Os pares incompatíveis conservam as imagens lado a lado
para inspeção e omitem deltas de desempenho. O relatório principal
continua usando imagens relativas depois da extração.

O export preserva quatro testes de 10 segundos no High Park no modo Estável.
D, W+D, joystick horizontal e joystick diagonal são medidos na base da
câmera renderizada. O arquivo `movement-diagnostics.json` documenta
input normalizado, posição, direção do corpo, yaw e velocidade projetada
em m/s. Cada amostra deve respeitar a tolerância de 0,08 m/s.

Use `npm run review:export -- --camera-evaluation` para incluir um vídeo
do joystick com a telemetria na tela. Em uma sessão de desenvolvimento,
`?movement-debug=1` mostra o painel temporário. A tecla C recentraliza
a câmera no desktop. No celular, a ação fica em Ajuda.

A partir da v3.1, o comando acima grava dois clipes identificados,
joystick à direita e na diagonal. Cada clipe inclui a recentralização
e o teste de interrupção manual. O diagnóstico também registra a troca
de W+D para W, a liberação do joystick e a posição durante a
recentralização. O botão de câmera no cabeçalho mobile equivale a C.
Em Ajuda, alterne entre Terceira pessoa com curvas (padrão) e Estável.
O export preserva o modo Automático da v4 como cenário de regressão
em desenvolvimento.

Na v3.2, a gravação usa screenshots JPEG do viewport completo em 390 ×
844, codificados em WebM. O export confere as dimensões do viewport
visual, do canvas e dos controles. Depois decodifica três quadros
por vídeo e compara a faixa inferior com os screenshots de origem.
O FFmpeg instalado pelo Playwright é usado por padrão. A variável
`REVIEW_FFMPEG` permite indicar outro executável compatível.

O clipe `movement-diagnostics.webm` inclui a sequência numerada do
movimento lateral até a diagonal com giro manual. O JSON registra
a liberação dos controles, o fim do movimento, o acionamento, o alvo,
os quadros da interpolação e o término ou interrupção da recentralização.

O Review Export v3 grava a 24 FPS por padrão com `--camera-evaluation`.
Para uma exportação mais rápida, use
`npm run review:export -- --camera-evaluation --video-fps 12`.
Esses valores são a taxa de codificação do WebM. O relatório guarda
separadamente a taxa de screenshots de origem e as métricas do jogo.
Se a captura produzir menos quadros que a taxa de codificação, alguns
quadros são repetidos para preservar a duração.

O arquivo `movement-diagnostics.json` contém a distância desejada e real,
a variação por quadro, o estado da obstrução, o ID OSM do edifício ou os
identificadores procedurais das árvores ocultadas, e as ocorrências de
proximidade excessiva. O percurso lateral junto à Chess House é
repetido por teclado e joystick. O teste confere enquadramento e linha
de visão em alturas representativas da personagem, além do deslocamento
da câmera em relação a ela. Os vídeos identificam esse percurso extra
quando a sessão é reposicionada para o teste. Os quatro cenários de
movimento exigem rastros de recentralização concluída e interrompida
para passar.


O comportamento do modo Automático da v4 é registrado para regressão em
`automatic-camera-diagnostics.json`.

O diagnóstico da v4 registra input, yaw
renderizado, referência de movimento, heading da personagem, estados da
câmera, tempos e resultados das rotações e erro de velocidade por trecho.
A referência de movimento é capturada no início do comando e mantida
até soltá-lo. O mouse e o gesto touch podem atualizar a referência.
O acompanhamento automático usa a direção do deslocamento executado
com essa referência fixa. Os 15° são um limite de enquadramento durante
a entrada lateral, inclusive quando ela muda de diagonal para lateral.


O modo de curvas tem duas gravações com `--camera-evaluation`. O clipe
`coupled-camera-desktop.webm` usa 1280 × 720 e
`coupled-camera-mobile.webm` usa 390 × 844, ambos a 24 FPS por padrão.
`coupled-camera-diagnostics.json` contém séries por frame do protótipo
isolado e do High Park, com input, heading, yaw alvo e real, velocidades
angulares e erro angular. Cada curva só passa se os quatro ângulos
começarem a mudar no mesmo frame em que a entrada horizontal é aplicada.
A semântica de direção e o endereço local do protótipo estão em
[THIRD_PERSON_RIG.md](THIRD_PERSON_RIG.md).

O fluxo de memória produz cinco vistas em 1280 × 720 e cinco em
390 × 844. O teste usa a tecla E e o botão touch no jogo, caminha até
o raio de interação, verifica o bloqueio e a retomada dos controles,
reabre o conteúdo pelo álbum e confirma persistência após voltar de
Toronto e reabrir a página. O diagnóstico fica em
`memory-gameplay.json`. A câmera usa o modo padrão do jogo durante o
ensaio. O ponto inicial do teste é posicionado pelo modo de desenvolvimento
para repetir o trecho próximo ao Nature Centre.


A entrega geográfica ampliada adiciona dez capturas do modo
`?park=expanded` e `high-park-terrain-review.json`. O PDF de rota do
trenzinho é uma referência para a entrega futura. O ZIP inclui os
arquivos-fonte OSM e HRDEM usados no relevo. As capturas e o benchmark
do recorte norte continuam em seus perfis anteriores.
