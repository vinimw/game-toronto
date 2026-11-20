# High Park visual v3.1

## Comparação visual

Foram comparadas as capturas 03, 04 e 05 do v3, do v1.1 e deste
refinamento. Posição da personagem, posição e orientação da câmera,
lente, viewport e resolução coincidem nos metadados. A ortográfica e
as duas vistas de Toronto também mantêm seus enquadramentos.

- **03 · Trilha.** O v3 deixava a faixa de entrada com poucas árvores
  próximas. Os grupos recuperam a profundidade vista no v1.1, com
  árvores de alturas diferentes, arbustos e mais vegetação no horizonte.
  O passeio fica mais estreito e visualmente distinto da via ao lado.
- **04 · Vegetação.** Copas e troncos aparecem em primeiro e segundo
  planos, onde no v3 predominavam gramado e arbustos. Os claros próximos
  à trilha continuam legíveis. Sombras de contato suaves dão peso às árvores.
- **05 · Nature Centre.** O modelo especial do v3 foi preservado.
  Cumeeiras discretamente mais baixas, beirais, soleira e rodapé dão
  continuidade aos volumes. A área em frente à entrada foi mantida livre
  de decoração alta. O anel OSM continua sendo o contorno do telhado e
  da colisão. As [referências do v3](HIGH_PARK_VISUAL_V3.md#nature-centre)
  orientam madeira, base de tijolo e esquadrias. Alturas e vãos exatos
  continuam sendo aproximações estilizadas.

## Vegetação e caminhos

O povoamento determinístico distribui grupos por distância ao longo
das trilhas e complementa as manchas arborizadas mapeadas. O interior
dos gramados mapeados permanece aberto. Nas bordas, uma faixa de até 8 m
pode receber vegetação esparsa. Copas assimétricas e escalas variadas
usam malhas instanciadas, assim como arbustos, tufos e flores. A
distribuição é procedural. Os polígonos OSM orientam a composição.

O recorte tem 490 árvores, 834 instâncias de arbustos, 1.610 tufos e 83
flores. O v3 tinha 349 árvores, 704 instâncias de arbustos, 1.319 tufos e
74 flores, contados nas malhas da cena. Cada arbusto usa dois volumes.
Os quatro quadrantes do recorte, do noroeste ao sudeste por linha,
passaram de 47, 133, 83 e 86 para 48, 207, 104 e 131 árvores.
`performance.json` informa também a malha de contagem 4 × 4 e os
detalhes habilitados em cada ponto conforme a distância e a qualidade.

Passeios comuns usam largura visual de 1,55 m. Cruzamentos pedonais,
vias para bicicletas, corredores, pistas e ruas têm configurações
próprias. Em trilhas de terra, a antiga borda sólida cedeu lugar a uma
transição estreita, irregular e transparente. As camadas pavimentadas
usam uma ordem de altura visual nos encontros. Os eixos e as regras de
navegação continuam baseados na geometria existente. A vegetação
respeita tanto a faixa visual quanto a folga anterior.

## Desempenho e validação

Comparação com o export limpo do v3 em `3ceed8a`. As medições foram
feitas no mesmo Chromium headless, qualidade Alta e 1280 × 720, com
75 amostras brutas de animação por vista estática.

| Captura | Draw calls v3 → v3.1 | Triângulos v3 → v3.1 | Média em ms v3 → v3.1 | p95 em ms v3 → v3.1 |
| --- | ---: | ---: | ---: | ---: |
| 03 · Trilha | 53 → 53 | 54.581 → 61.904 | 16,67 → 16,67 | 16,8 → 16,7 |
| 04 · Vegetação | 40 → 40 | 52.907 → 58.499 | 16,67 → 16,67 | 16,7 → 16,8 |
| 05 · Nature Centre | 39 → 40 | 53.208 → 60.403 | 16,67 → 16,67 | 16,7 → 16,8 |
| 06 · Ortográfica | 113 → 113 | 72.282 → 82.836 | 16,67 → 16,67 | 16,8 → 16,8 |

O custo de triângulos aumentou de 11% a 15% nas quatro vistas. As
amostras oscilaram perto de 60 Hz e têm resolução limitada para
identificar trabalho adicional de GPU dentro do mesmo quadro.
Sombras de contato são desativadas em qualidade Baixa e o raio
de detalhe próximo continua menor. FPS sustentado, bateria e
temperatura em celular físico continuam sem medição.

A comparação entre snapshot e Three.js passou com 148 feições, 105
cruzamentos e desvio máximo amostral de 6,86 mm para tolerância de 30
mm. A simulação de navegação percorreu 228,74 m, alcançou o destino e
confirmou as quatro bordas do recorte. O review mantém Toronto como
DEMO e High Park como OSM REAL.

No Chrome de desktop, foi possível entrar pelo portal de Toronto,
selecionar a qualidade Baixa, caminhar 6 m no High Park e orbitar com
o mouse. O navegador manteve uma instância da personagem e não
registrou exceções JavaScript. A página principal retornou 404 apenas
para `/favicon.ico`. O export de revisão registrou zero erros.
