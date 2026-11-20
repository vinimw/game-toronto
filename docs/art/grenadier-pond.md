# Grenadier Pond v1

O recorte usa os 396 pontos da feição OSM 174225267 e a superfície HRDEM existente. A trilha 871510614 permanece no mesmo eixo. O acabamento de margem cobre um trecho da margem leste abaixo de Hatchling Hill. O gerador rejeita pontos dentro da água, próximos às vias ou fora da faixa de altitude selecionada.

A distribuição de juncos e pedras é uma interpretação visual da margem naturalizada mostrada pela [Prefeitura de Toronto, figura 4](https://www.toronto.ca/wp-content/uploads/2018/04/8efa-city-planning-BWV-HighParkWaterNarrative.pdf). A [foto de 30 de abril de 2026](https://commons.wikimedia.org/wiki/File:Grenadier_Pond_at_High_Park_in_Toronto%2C_April_30_2026_%2802%29.jpg) serve como referência sazonal. Imagens externas não são redistribuídas. Juncos, pedras e material de água são procedurais e autorais. Reflexos são aproximações de cor por ângulo, sem captura de uma cena refletida ou estimativa de batimetria.

A superfície base fica disponível em tempo integral. Duas malhas instanciadas de margem entram por distância e ajustam cobertura na passagem opaca. High tem maior densidade e mais contribuição da segunda ondulação. As estatísticas do setor registram instâncias e cobertura.

## Revisão v1.1

A água usa ruído em coordenadas locais em metros, animado lentamente em
duas direções. A derivada por pixel reduz a ondulação à distância. High
adiciona uma frequência fina à normal. O brilho rasante aproxima a cor do
céu e da vegetação, sem renderizar uma segunda vista da cena.

A margem recebe trechos de solo úmido, pedras, juncos e arbustos. A
distribuição continua procedural e não representa um inventário botânico.
Os acabamentos seguem o HRDEM, com exclusão das trilhas e da água.

As capturas 41, 42 e 44 mantêm os enquadramentos anteriores. Entre as
capturas 64–72, apenas 66, 67 e 71 mudam de câmera. Elas servem para
revisão visual, sem comparação direta de desempenho por enquadramento.
A vista 71 usa os limites locais do polígono OSM e norte para cima.

## Aceite v1.2

A máscara visual do solo usa manchas com bordas irregulares e cor gradual.
Os agrupamentos de juncos são aproximações inspiradas na naturalização
registrada pela Prefeitura, figura 4, e na foto de primavera citada acima.
A faixa de solo, as posições de plantas e os tamanhos de pedras são
estilizados. Somente o polígono OSM e a altitude HRDEM são geográficos.
Nenhuma foto foi incorporada aos assets.

A referência de norte para cima é a renderização vertical do OSM e HRDEM.
A vista ortográfica oblíqua separada mostra a mesma cena com profundidade.
A captura 66 mudou de câmera. O comparador mantém esse par separado
dos enquadramentos equivalentes.
