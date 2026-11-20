# High Park Landmarks v1

## Referências do Nature Centre

O modelo representa o pavilhão histórico de 375 Colborne Lodge Drive.
O volume baixo e comprido e a sequência de aberturas vêm das imagens
do Forest School. A fotografia de 1932 e o estudo da ATA também
contextualizam as duas varandas e o pavilhão central.
[História e foto de arquivo do Nature Centre](https://highparknaturecentre.com/history/) ·
[Estudo de patrimônio da ATA Architects](https://ataarchitectsinc.com/portfolio-item/high-park-forest-school/)

A foto externa de 2016 orienta a madeira escura, as esquadrias claras
e os detalhes verdes. A divulgação do Jane’s Walk 2025 mostra o nome
do edifício e portas duplas verdes em uma aproximação pelo terreno.
O desenho aproxima esses elementos na fachada oeste para que sejam
legíveis nas vistas do jogo.
[Foto externa de 2016](https://toronto.kidsoutandabout.com/content/high-park-nature-centre) ·
[Foto do Jane’s Walk](https://www.janeswalkfestivalto.com/saturday-may-3-2025/high-park-nature-centre-walk)

A ATA documenta a estrutura de madeira da varanda oeste e o beiral
com mudança de inclinação. As pranchas de concurso A4.00–A4.02 e A7.00
informaram a leitura dos beirais e da cobertura baixa. São documentos
de projeto. A representação combina essas referências com fotos do
pavilhão histórico.
[Pranchas de arquitetura de Kongats](https://anacond.ca/wp-content/uploads/2025/05/Appendix-I-%E2%80%93-Architectural-Drawings-for-RFT-Doc4856029968.pdf) ·
[Anúncio do projeto](https://www.kongatsarchitects.com/news2)

## Modelo e entorno

Na versão anterior, a entrada era uma face plana, com porta simples
e pouca diferenciação entre a varanda e o corpo do pavilhão. O novo
modelo usa um plano de esquadrias recuado, pilares de madeira, porta
dupla, bandeira, alvenaria na base e uma placa legível. A cobertura
tem duas águas principais, beirais quebrados e variação discreta de
cor. O telhado e a colisão usam o mesmo perímetro OSM do way 43805272.

A posição da placa, espaçamento e número de vãos, cores ao entardecer,
inclinações, alturas e profundidade da varanda são aproximações.
A faixa de solo, os seixos e a vegetação baixa são decoração procedural.
A colocação verifica a colisão e as margens caminháveis. A vegetação
da região mantém seu povoamento anterior.

O cadastro em `src/landmarks.js` associa o ID `high-park:nature-centre`
ao dataset, à referência OSM, à âncora WGS84, ao construtor e ao detalhe
por perfil. A âncora fica no interior do footprint e pode identificar
o lugar para interações ou memórias futuras. A malha continua seguindo
a geometria importada. Baixa mostra a estrutura, Equilibrada acrescenta
fachada, sombra e entorno próximo, e Alta inclui a camada de seixos.
Os detalhes de fachada e entorno são ocultados à distância.

## Revisão

As vistas 05, 11 e 13 permitem comparar o pavilhão, a entrada de perto
e a composição vertical. Elas mantêm os enquadramentos do baseline do
visual v3.2 feito no commit `077b8df`. O relatório do export lista
as métricas antes e depois por vista. A correspondência geográfica
mantém o desvio amostral máximo de 6,86 mm e a rota de 228,74 m.
As medições usam Chromium headless. O teste de toque usa emulação,
sem dados de desempenho de um celular físico.
