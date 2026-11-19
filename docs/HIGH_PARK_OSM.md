# High Park norte · OpenStreetMap

A Cidade de Toronto identifica a entrada norte na Bloor Street West com High Park
Avenue. O recorte foi escolhido para incluir a calçada ao sul do cruzamento e o
Nature Centre. [High Park — Cidade de Toronto](https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/beaches-gardens-attractions/high-park/)

- Extensão WGS84 em ordem sul, oeste, norte, leste: `43.65055, -79.467485, 43.65415, -79.462515` (aproximadamente 400 × 401 m).
- Origem: `43.65235, -79.465`. O jogo usa projeção equiretangular local em metros, com X leste e Z sul.
- [Consulta da API OSM para a mesma extensão](https://api.openstreetmap.org/api/0.6/map.json?bbox=-79.467485,43.65055,-79.462515,43.65415). A versão atual da API pode refletir edições posteriores à data arquivada.
- © OpenStreetMap contributors. [ODbL 1.0 e atribuição](https://www.openstreetmap.org/copyright).

`npm run map:import` reconstrói o snapshot publicado a partir da resposta
arquivada em `tools/data/high-park-north.osm-source.json`. O arquivo conserva
IDs, nós, geometrias e etiquetas pertinentes. Metadados de editores e etiquetas
fora do escopo foram removidos. O snapshot contém a data UTC de extração e o
SHA-256 desse arquivo. O teste Python compara o conteúdo regenerado com o
publicado e confere os vértices do Nature Centre contra os nós da fonte.

O importador inclui 98 ways de circulação, 32 de edifícios e 18 de áreas verdes.
A chegada coincide com a [calçada OSM 174188399](https://www.openstreetmap.org/way/174188399).
São referências o [contorno do parque 14344414](https://www.openstreetmap.org/way/14344414),
[Colborne Lodge Drive 1366720320](https://www.openstreetmap.org/way/1366720320) e
o [Nature Centre 43805272](https://www.openstreetmap.org/way/43805272). O teste de
jogo valida o portal, o movimento e a colisão com a implantação do Nature Centre.

O relatório `geographic-correspondence.json` lista os limites, contagens,
recortes de borda, omissões e referências OSM verificáveis. A ortográfica usa norte
para cima e registra tanto a bbox da fonte quanto o enquadramento, que inclui
margem e se ajusta à imagem 16:9. Compare primeiro a bbox da fonte.

O recorte não contém superfícies de água no snapshot. O pipeline atual não
representa multipolígonos com furos, pontos de interesse, barreiras ou relevo. A
espessura de vias e as alturas sem tag são estimativas visuais. As árvores são
procedurais. Os modelos foram conferidos contra a extração e a caminhada foi
testada no navegador. Acessibilidade em campo e alinhamento com levantamento
topográfico continuam sem verificação.

## Validação geográfica v1.1

O exportador lê a resposta OSM arquivada e verifica seu SHA-256 contra o
snapshot em uso. A referência 2D projeta diretamente os nós da fonte e recorta
seus segmentos à bbox. O comparador é independente do importador e do renderer.
O lado Three.js usa os eixos extraídos dos triângulos das vias e os contornos
das malhas trianguladas de edifícios e áreas verdes. A sobreposição usa a mesma
bbox, escala e orientação. A tolerância da checagem amostral é de 3 cm, com
passo máximo de 2 m. Isso mede correspondência com os dados da fonte e não a
exatidão geográfica dos dados OSM em campo.

A primeira execução encontrou 4,45 cm de diferença na extremidade leste do
way 806990900. O importador agora calcula a interseção com a borda antes de
arredondar as coordenadas ao centímetro. A espessura artística de vias e as
arestas de fechamento criadas pelo recorte são registradas à parte.

O roteiro parte da entrada norte e percorre a calçada 174188399 até sua
extremidade interna, usando a movimentação e as colisões do jogo a 1×. O
relatório registra a chegada, a proteção nas quatro bordas, a colisão do
Nature Centre e a verificação de folga no ponto inicial. Trata-se de uma rota
testada, não uma certificação de toda a rede de trilhas. A visibilidade
noturna, relevo e barreiras reais ficam fora desta validação.

As seis capturas originais continuam no pacote. A captura 05 OSM é nomeada e
legendada como Nature Centre. Os PNGs 07 e 08 mostram a referência da fonte e a
sobreposição. O marcador 3D da memória e o portal ilustrativo ficam ocultos em
OSM, com as interações de memória e retorno ainda disponíveis.
