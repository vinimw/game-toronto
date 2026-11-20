# Reconstrução de High Park v2 · entrega 1

## Como avaliar

Execute `npm run dev` e abra `/?park=expanded` no endereço do Vite.
Entre pelo portal existente de Toronto. A prévia usa a entrada norte
georreferenciada, o mesmo ID de região e a mesma origem local do
recorte anterior. O rótulo OSM · PRÉVIA indica o modo ampliado. A URL
normal continua abrindo o recorte aprovado.

A caixa WGS84 é `[43.6359, -79.4725, 43.65415, -79.4565]` na ordem
sul, oeste, norte, leste. A água e os edifícios bloqueiam deslocamento
pelo contorno importado. O plano da água usa a mediana da elevação
amostrada no interior de cada contorno. A malha do terreno é dividida
em grupos de até 32 células por lado. Vias recebem pontos intermediários
no mesmo eixo OSM para acompanhar a altura do chão. O jogo mantém a
direção, velocidade e entradas da câmera. A posição vertical usa a
mesma triangulação do terreno desenhado.

## Dados e reprodução

A geometria vem do [OpenStreetMap, ODbL 1.0](https://www.openstreetmap.org/copyright).
O pacote preserva a extração arquivada da Map API e os IDs OSM. O
importador trabalha com vias e anéis de ways. Relações multipoligonais
sem renderização ficam registradas como omissões. As superfícies
esportivas são tratadas como polígonos OSM e recebem cor no terreno.
O inventário não pressupõe uma pista de atletismo.

A elevação vem do [HRDEM Mosaic DTM de 2 m](https://open.canada.ca/data/dataset/0fe65119-e96e-4a57-8bfe-9d9245fba06b),
de Natural Resources Canada, Open Government Licence – Canada. O datum
vertical é CGVD2013. O arquivo de origem arquivado é uma janela nativa
do mosaico. A versão em jogo é reamostrada para cerca de 8 m com
valores em centímetros. A quantização não indica precisão em campo.
A faixa no recorte é 74,64–112,46 m. A precisão vertical local da
aquisição não foi confirmada em campo. A superfície do lago é uma
aproximação de nível, sem batimetria.

```sh
python3 tools/import_osm.py --dataset high-park-expanded \
  --input tools/data/high-park-expanded.osm-source.json.gz \
  --bbox 43.6359 -79.4725 43.65415 -79.4565 --origin 43.65235 -79.465 \
  --output public/data/high-park-expanded.osm.json
# Ambiente Python com rasterio e NumPy, usado somente no preparo de dados
python3 tools/import_terrain.py tools/data/high-park-hrdem.tif public/data/high-park-terrain.json
```

## O que esta entrega estabelece

O Review Export registra habitat geográfico preliminar para a entrada
norte, área esportiva, West Road, Cherry Hill, Grenadier Pond e
Hillside Gardens, além de vista aérea. O JSON
`high-park-terrain-review.json` lista coordenadas, cotas, IDs e estado de
validação, com os hashes das duas fontes arquivadas. A análise usa a
navegação e a câmera reais em desktop e Chromium com toque emulado.
A medição do recorte norte anterior continua separada.

Portões, fontes, equipamentos, detalhes dos jardins, NPCs e Trackless
Train pertencem às entregas seguintes. As encostas ainda não distinguem
superfícies sobrepostas de pontes, degraus ou muros. O Landmark de
memória continua no Nature Centre, com a posição original e altura do
terreno. A vegetação de primavera usa o preset aprovado. Não se declara
um inventário de cerejeiras pela extensão inteira.

## Referências de campo

- [Parque, entradas e instalações · City of Toronto](https://www.toronto.ca/explore-enjoy/parks-recreation/places-spaces/beaches-gardens-attractions/high-park/)
- [Mapas do parque · High Park Nature](https://highparknature.org/visit-toronto-high-park/maps-and-directions-toronto-high-park/)
- [Época e locais documentados de cerejeiras · City of Toronto](https://www.toronto.ca/explore-enjoy/festivals-events/cherry-blossoms/)
- [Mapa e documentação do trenzinho sem trilhos · City of Toronto](https://www.toronto.ca/legdocs/mmis/2026/gg/bgrd/backgroundfile-284637.pdf)
