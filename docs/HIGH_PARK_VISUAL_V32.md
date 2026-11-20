# High Park visual v3.2

## Refinamento

A referência é o visual v3.1 capturado pelo Review Export v2 no commit
`629dce4`. A comparação usa os mesmos 13 IDs, poses, câmeras, viewports
e perfis. O manifesto, o snapshot OSM e as regras de colisão continuam
iguais. Os pontos 01 e 02 continuam Toronto DEMO.

- **Caminhos.** As curvas compartilham seções simétricas nos vértices.
  Isso mantém o eixo OSM e elimina os discos que cobriam as curvas.
  A faixa de transição tem a cor do piso e termina em transparência.
  Os dois pavimentos da captura 03 correspondem a feições distintas no
  snapshot, a calçada OSM 174188399 e a West Road OSM 14344426.
- **Larguras.** As larguras visuais usam a tag métrica disponível e
  valores por tipo de via na ausência dela. Neste recorte os valores
  continuam estilizados. São 1,60 m para calçada, 1,50 m para passeio
  genérico e 1,55 m para trilha. Essas larguras não determinam colisões.
- **Solo e luz.** Uma textura compartilhada de 256 × 256 usa três
  escalas de tonalidade em coordenadas de mundo. Contraste hemisférico,
  luz direcional e neblina separam o primeiro plano do horizonte.
  Sombras de contato ficam desligadas em Baixa e são mais discretas
  em Equilibrada. Nenhuma dessas mudanças altera a elevação do recorte.
- **Nature Centre.** Volume, aberturas, contorno e telhado continuam
  iguais. A cor da madeira, das esquadrias e da cobertura foi ajustada.
  Uma sombra de contato curta acompanha a base, com mais alcance no
  lado oposto à luz. O exterior continua documentado nas
  [referências originais](HIGH_PARK_VISUAL_V3.md#nature-centre).

Foram mantidas 490 árvores, 834 instâncias de arbustos, 1.610 tufos e
83 flores. A distribuição nas 16 quadrículas e os volumes de vegetação
permaneceram iguais. As vistas 09 e 10 mostram os materiais e bordas de
perto. As vistas 12 e 13 permitem revisar a composição no viewport
vertical de 390 × 844.

## Medições

Comparação do benchmark no mesmo Chromium headless e perfil, entre
a referência e o candidato visual. As vistas desktop usam Alta e as
verticais, Equilibrada.

| Vista | Draw calls v3.1 → v3.2 | Triângulos v3.1 → v3.2 |
| --- | ---: | ---: |
| Trilha desktop | 53 → 54 | 61.904 → 54.308 |
| Vegetação desktop | 40 → 40 | 58.499 → 50.839 |
| Nature Centre desktop | 40 → 41 | 60.403 → 52.807 |
| Ortográfica | 113 → 114 | 82.836 → 75.240 |
| Trilha mobile emulada | 39 → 39 | 56.574 → 48.914 |
| Nature Centre mobile emulado | 39 → 40 | 58.219 → 50.623 |

Na trilha desktop a média estática ficou em 16,67 ms e o p95 ficou
entre 16,7 e 16,8 ms. O percurso de 20 s cobriu 101,25 m em cada versão
com zero quadros bloqueados. As chamadas médias no percurso passaram
de 50,69 para 51,29, os triângulos médios passaram de 60.687 para
53.065 e o p95 permaneceu em 16,7 ms. O carregamento da cena fica em
`performance.json`, com comparação no relatório. Essa medição inclui
a inicialização pelo SceneManager e varia com o servidor e o cache.

A cartografia preservou o desvio máximo de 6,86 mm nas amostras,
148 feições e 105 cruzamentos. A simulação da rota completa alcançou
o destino em 228,74 m e passou nas verificações das quatro bordas.
No jogo em Chrome, foram testados a entrada no High Park, caminhada,
órbita com mouse, velocidade de 1× e 2×, mapa e álbum. Em viewport
mobile emulado, a personagem andou com o joystick enquanto um
segundo toque girou a câmera.
O benchmark automatizado ficou perto da cadência de 60 Hz. Os
resultados não substituem medições em iOS ou Android físicos.
