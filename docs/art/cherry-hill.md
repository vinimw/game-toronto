# Hatchling Hill no Game Love

O trecho fica na Cherry Hill Trail, a oeste do Grenadier Café e na
encosta acima da margem leste de Grenadier Pond. A trilha é a via
OSM 871510614, o café é 125699284 e o lago é 174225267. A altimetria
continua a mesma superfície HRDEM. As vistas avaliam a trilha, a encosta
e a linha de visão para a água. A neblina do jogo e a vegetação estilizada
fazem parte da interpretação visual.

A Prefeitura de Toronto documenta o plantio na encosta e o seu caráter
inclinado. O High Park Nature Centre localiza Hatchling Hill a oeste do
restaurante e mostra as flores claras no estágio 6. O recorte OSM do
projeto não registra as posições individuais das cerejeiras da área.
Os 26 exemplares de jogo representam agrupamentos interpretados,
com os troncos afastados dos eixos e larguras das trilhas. O ponto para
memória futura usa o resolvedor de memoriais e é ajustado à trilha. Ele
não tem texto pessoal, marcador interativo ou missão.

- [City of Toronto · Cherry Blossoms](https://www.toronto.ca/explore-enjoy/festivals-events/cherry-blossoms/)
- [High Park Nature Centre · localização de Hatchling Hill](https://highparknaturecentre.com/cherry-blossom/)
- [High Park Nature Centre · estágio de pico](https://highparknaturecentre.com/cherry-blossom-tracking/)

## Arte e pipeline

O pico usa duas árvores autorais com ramificação orgânica e atlas de flores
recortado em alfa. Rotações, escalas e dois tons evitam a repetição de uma
silhueta única. A vegetação e as pétalas respeitam o HRDEM. A luz filtrada
é aproximada por manchas de contato que acompanham a encosta, em vez de
mapas adicionais de sombra. Os modelos High e Balanced reutilizam os
GLBs autorais que já existiam. O modo abaixo exporta os dois novos Low
com menos ramos e cards florais, preservando o atlas e a escala.

```sh
python3 tools/art/build_leaf_cards.py /tmp/game-love-leaves
blender --background --factory-startup --python-exit-code 1 --python tools/art/build_north_entrance.py -- public/assets/north-entrance /tmp/game-love-leaves --sakura-low
```

GLBs, atlas e elementos de solo são autorais do Game Love. As fotos
externas foram usadas apenas como referência visual, sem incorporação
aos assets. Fontes do restante do parque constam em asset-licenses.md.

## Streaming e validação

O manifesto declara o bounds, as duas variações e três LODs. O setor Low
entra primeiro, pela faixa de prefetch. High ou Balanced carrega em um
setor separado e o Low continua disponível nas bordas. Os leases dos
GLBs saem ao afastar. A troca usa uma troca de malha opaca com máscara
de folhas, sem transparência de copa. Isso preserva desenho e ordenação,
mas diferenças entre silhuetas de LOD podem ser perceptíveis.

O diagnóstico da entrada norte separa a apresentação inicial de
reativações durante deslocamento. Capturas 56 e 63 são o par da chegada
com o mesmo enquadramento. O vídeo começa fora dos limites de prefetch
de detalhe e registra a caminhada. A área distante e a volta são
exercitadas por posicionamento de revisão. Mobile é Balanced em
Chromium emulado. Medição física continua pendente.

## Passe visual v2

As imagens 56 a 63 e os quadros da caminhada v1 mostravam grama em
triângulos isolados, copas granuladas em rosa uniforme, troncos sem
variação, uma faixa bege sobre o gramado e um horizonte lavado. A v2
retém os mesmos enquadramentos para comparação.

A Prefeitura descreve a acessibilidade da encosta como distante de
caminhos pavimentados. O snapshot OSM do jogo registra especificamente
a via 871510614 como Cherry Hill Trail e `surface=asphalt`. O passe
mantém o eixo e representa o material como asfalto gasto. A proximidade
dos agrupamentos de árvores com esse caminho é uma escolha artística.
As 26 posições continuam sem confirmação individual.

Os seis GLBs sakura foram reexportados pelo modo `--sakura-all` do
gerador Blender. Os LODs compartilham a lógica de ramificação e
reduzem ramos secundários e cards. O atlas autoral agrupa flores brancas
com tons suaves nas pétalas. O shader de casca usa o próprio espaço da
malha para variar cor e sulcos. O acabamento do chão usa materiais PBR,
manchas de terra e tufos de folhas curvas em instâncias, filtrados pela
inclinação e proximidade da trilha. Sombras de contato irregulares
acompanham o relevo, e a água recebe reflexos estilizados no trecho da
margem leste. A atmosfera tem gradiente de céu e distância de névoa local.

As copas trocam de LOD por cobertura pontilhada na passagem opaca. A
primeira apresentação de cada camada entra como evento de estreia;
o vídeo e o JSON registram cobertura para distinguir uma transição
gradual de um salto no percurso. O teste reprova variação abrupta
na cobertura da camada entre frames. Ele não mede oclusão de cada
árvore por pixel. A volta segue o mesmo corredor sem deslocar a
personagem entre etapas, com mudanças de direção da câmera nas viradas.

## Grupo oeste perto do Nature Centre

O grupo sazonal `west-road-sakura`, mantido nas posições artísticas já
existentes junto à via OSM 174188399, também usa os GLBs sakura e os LODs
Low, Balanced e High. As instâncias geométricas anteriores permanecem
como fallback até a camada de assets estar pronta e reaparecem ao sair do
alcance detalhado. O OSM não confirma as posições individuais dessas
cerejeiras; elas continuam sendo uma composição visual aproximada.
