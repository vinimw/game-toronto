# High Park World Progress

Baseline c9f503e, Review Export 3.7.0. A entrada norte, Cherry Hill,
Grenadier Pond e Maple Leaf Garden têm assets próprios. O restante da
prévia ampliada usa chunks HRDEM, construções extrudadas, vegetação com
lotes instanciados e trilhas OSM drapeadas. A geometria do mapa não foi
ampliada neste passe.

O World Streaming mantém filas por tipo, estima prioridade, libera o
setor depois de sair do alcance e preserva a base geográfica. GLBs
existentes usam o Asset Manager. O setor esportivo usa três malhas
procedurais locais e não acrescenta downloads. O material de solo e
trilhas usa variação em coordenadas de mundo. Os troncos compartilhados
ganham bifurcações e a atmosfera de céu claro é aplicada ao sul do
limite visual da entrada norte. Os shaders são autorais.

O norte representa os campos OSM de futebol 680982127, tênis 1116261446
a 1116261448 e dois diamonds 14344509 e 14344528. As marcas de jogo e a
cor das superfícies são aproximações. Não há levantamento das linhas
pintadas ou do equipamento individual.

A [Prefeitura de Toronto](https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/beaches-gardens-attractions/high-park/)
documenta o parque e os acessos. O [operador](https://www.highparktrain.ca/)
publica o serviço e um mapa de rota ilustrado. A sequência de segmentos
OSM, os pontos exatos de parada e o modelo do veículo ficam pendentes.
Grenadier Café, High Park Zoo e Jamie Bell permanecem na base geográfica.
OSM usa ODbL. Não foram incorporadas imagens ou malhas de terceiros.

## Continuação

O setor esportivo incorpora redes e postes nas três quadras públicas.
Os eixos das redes vêm dos retângulos OSM; altura e materiais são
aproximações. A colisão coincide com a rede. A configuração dos
cercamentos e portões permanece pendente de levantamento.

O Grenadier Café mantém a base OSM 125699284 e ganha telhado de quatro
águas e caixilhos pela referência [Alaney2k, 5/10/2008, CC BY 3.0](https://commons.wikimedia.org/wiki/File:High_Park_Grenadier_Cafe.jpg).
A fachada exterior continua estilizada e não há interior novo.
O [mapa municipal](https://www.toronto.ca/legdocs/mmis/2026/gg/bgrd/backgroundfile-284637.pdf)
registra a parada 5 na área do restaurante. O modelo estático na
via OSM 1389554894 aproxima a posição de estacionamento na área da parada.
A posição exata e a associação de toda a rota às vias permanecem
indeterminadas. O desenho vermelho e creme segue a [referência municipal de transporte](https://www.toronto.ca/wp-content/uploads/2023/03/9563-high-park-movement-strategy-open-house-presentation-preferred-strategy-part-a-april-3-2023.pdf).
As malhas são autorais e as fotografias não foram incorporadas.

Os corredores passam a compartilhar os GLBs autorais de maple e oak
do projeto. São três setores carregados por distância, com High e
Balanced e vegetação base em Low. Os pontos de plantio são artísticos,
filtrados contra caminhos, construções, água e áreas esportivas.

## V2 · vermelho de primavera e exploração acelerada

O Maple Leaf Garden enfatiza tulipas vermelhas, bordô e coral. É uma
decisão de direção de arte para dar leitura à folha de longe. As fotos
de 27/04/2026 mostram uma floração vermelha menos densa. O chão mantém
a leitura do perímetro OSM quando as flores instanciadas são descarregadas.
A cobertura do restante do parque usa folhas curvas autorais.

O Trackless Train permanece estático. Os documentos de Toronto e do
operador descrevem paradas e mostram a rota de forma ilustrada, sem a
atribuição de segmentos OSM necessária para confirmar a animação.
A v2 detalha lanternas, frisos e engates. No café, a referência fotográfica
orienta a cor da fachada e os caixilhos. As proporções são estilizadas.

## Aceite e exploração conectada

O planejador conecta somente vértices comuns de vias OSM permitidas a
pedestres e retesta cada segmento contra as colisões da cena carregada.
O script de revisão posiciona o jogador apenas no início, orienta a
câmera nos vértices e mantém a entrada de caminhada real. Os plantios
extras saem de pontos espaçados na margem dessas rotas e exigem área
verde, distância de vias e ausência de água, edifícios ou quadras.
São aproximações visuais, já que as posições de árvores não são um
inventário OSM. O Low mantém a vegetação base.

O conjunto de tulipas preserva contagens, cores e dimensões. O caule
instanciado usa quatro lados sem tampas e a corola High tem sete
segmentos. A comparação separa o custo da redução de malha.

A consulta ao operador e ao mapa municipal não estabeleceu uma
sequência de vias e geometria de paradas com precisão suficiente para
uma circulação verificável. O veículo continua estático e o mapa
municipal permanece vinculado como referência.
