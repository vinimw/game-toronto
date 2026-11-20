# High Park visual v3

O acabamento v3 é aplicado ao recorte OSM. O snapshot, a bbox, a origem,
os IDs e os pontos de captura mantêm os mesmos valores. Toronto e o
café DEMO continuam separados do edifício OSM.

## Nature Centre

O edifício estilizado é associado ao way 43805272. As paredes seguem o
anel OSM e a triangulação do telhado é subdividida dentro desse mesmo
contorno. A evidência cartográfica usa a borda da própria malha do
telhado. A colisão usa o footprint original.

A foto histórica publicada pelo Nature Centre e a foto do pavilhão no
anúncio do escritório Kongats informaram o volume baixo e comprido, as
linhas baixas de telhado e a sequência de janelas. Os desenhos da
renovação orientaram a distinção entre revestimento de madeira,
fundação de tijolo e esquadrias. [História e foto do Forest School](https://highparknaturecentre.com/history/) ·
[Anúncio do escritório de arquitetura](https://www.kongatsarchitects.com/news2) ·
[Pranchas de arquitetura e elevações](https://anacond.ca/wp-content/uploads/2025/05/Appendix-I-%E2%80%93-Architectural-Drawings-for-RFT-Doc4856029968.pdf)

As alturas de cumeeira e beiral, a cor em luz de tarde e a posição
exata das esquadrias e da porta são aproximações. As duas águas
acompanham a silhueta geral. O modelo representa apenas o exterior e
não é um levantamento arquitetônico.

## Ambiente e qualidade

As áreas verdes guiam a vegetação decorativa. O gerador repete a mesma
distribuição a partir da semente, reserva folga nas trilhas e mantém
volumes de câmera para as árvores. Arbustos, tufos e flores são
instanciados. Os detalhes próximos à câmera usam raios de 28, 48 e 82 m
nos perfis Baixa, Equilibrada e Alta. A ortográfica usa a vista completa
para que o enquadramento permaneça comparável.

O solo usa uma textura procedural compartilhada com duas escalas de
variação. As junções curvas das trilhas recebem preenchimento visual
sob o piso, com raio igual à metade da largura da faixa. O eixo emitido
pela malha da via e as larguras usadas na navegação permanecem iguais.
A luz de tarde usa iluminação hemisférica e direcional, neblina de
distância e sombras de contato.

## Antes e depois

Comparação do export v1.1 com o v3 no mesmo Chromium headless, em
1280 × 720 e qualidade Alta. Posições da personagem e da câmera,
orientação, lente e viewport foram comparados nos metadados.

| Captura | Draw calls antes → depois | Triângulos antes → depois | Frame time médio antes → depois | p95 antes → depois |
| --- | ---: | ---: | ---: | ---: |
| 03 · Trilha | 52 → 53 | 71.772 → 54.581 | 16,67 → 16,67 ms | 16,8 → 16,7 ms |
| 04 · Vegetação | 39 → 40 | 71.378 → 52.907 | 16,67 → 16,67 ms | 16,7 → 16,8 ms |
| 05 · Nature Centre | 38 → 39 | 71.420 → 53.208 | 16,67 → 16,67 ms | 16,7 → 16,7 ms |
| 06 · Ortográfica | 112 → 113 | 73.086 → 72.282 | 16,67 → 16,67 ms | 16,7 → 16,7 ms |

As amostras ficaram perto da cadência de 60 Hz. Elas indicam o custo de
geometria e chamadas, mas têm resolução limitada para distinguir o
tempo de GPU entre quadros dentro do mesmo intervalo. O perfil Baixa,
a entrada no recorte, a caminhada e a órbita da câmera foram verificados
no navegador. FPS sustentado e consumo em celular físico seguem sem
medição.

A validação amostral manteve o desvio máximo de 6,9 mm em relação ao
snapshot. A rota de cerca de 229 m e os testes de borda passaram.
