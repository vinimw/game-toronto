# Implantação de edifícios em encostas

O piso continua na cota máxima do HRDEM dentro da implantação OSM. O rodapé tem sobreposição de 2,5 cm com o terreno. Até 2,5 cm de variação, a tolerância dispensa a fundação. Até 2 m, o modelo mantém o embasamento simples. Acima de 2 m, o embasamento segue o perímetro em trechos de até 4 m, com base calculada a partir do ponto mais baixo de cada trecho e uma faixa inferior escalonada. O piso permanece nivelado. Acima de 5 m o relatório exige revisão individual, mesmo quando a faixa escalonada melhora a leitura do volume.

Muros fora da implantação exigem evidência de posição e verificação do corredor de circulação. Plataformas exigem evidência de nível e acesso. Uma correção pontual exige distinguir erro do raster, erro do footprint ou estrutura elevada antes de editar sua representação. Nenhuma dessas intervenções é inferida apenas pelo desnível. A inclinação do HRDEM, a altura da fachada e a localização de portas reais exigem validações independentes.

## Casos prioritários

Os valores a seguir são desníveis do HRDEM original amostrado contra o footprint. Endereços e usos são rótulos do snapshot, quando disponíveis. A tabela identifica a hipótese que ficou pendente em cada caso.

| Way OSM | Desnível | Revisão |
|---|---:|---|
| 70364374 | 12,90 m | 383 Ellis Park Rd. Conferir seção do edifício e possíveis níveis independentes antes de inferir embasamento único. |
| 663017725 | 7,90 m | 25 Ellis Park Rd. Conferir acesso residencial pelo lado alto ou por nível inferior. |
| 663017959 | 7,41 m | 168 Ellis Park Rd. Conferir garagem, níveis da casa e relação com a rua. |
| 225740963 | 7,04 m | 20 Gothic. O número de pavimentos OSM ajuda a interpretar a escala, sem determinar a cota do térreo. |
| 663018089 | 5,98 m | 14 Olympus. Confirmar onde termina o volume apoiado na encosta. |
| 33409406 | 5,90 m | 80 Coe Hill. Confirmar diferenças entre acesso e fachada oposta. |
| 435344275 | 5,51 m | Chartwell. Conferir se o contorno agrega alas com cotas distintas. |
| 664528029 | 5,49 m | Tag layer=1. Confirmar se o volume é elevado antes de modelar um apoio definitivo. |
| 663017900 | 5,37 m | 3 Valleymede. Conferir cotas de passeio e soleira. |
| 32253957 | 5,33 m | 45 Southport. Conferir se níveis inferiores acompanham a encosta. |
| 663017949 | 5,26 m | 15 Olympus. Conferir inclinação junto à entrada. |
| 659598883 | 5,20 m | 26 Woodland Heights. Conferir relação entre implantação e talude. |
| 663017951 | 5,08 m | 19 Olympus. Conferir acesso pelo lado alto e eventual piso inferior. |
| 33409401 | 5,04 m | 65 Windermere. Conferir se há alas ou acessos em cotas diferentes. |

O pacote inclui a auditoria numérica de todos os edifícios e a lista dos casos acima de 2 m. Os casos da tabela continuam provisórios até obter evidências de campo ou desenhos confiáveis.

## Landmarks e medições

- **Nature Centre (43805272).** O footprint delimita a implantação. Componentes da fachada como beirais e detalhes salientes podem ultrapassá-lo. A diferença horizontal de cerca de 1,12 m da V1 comparava a caixa do modelo decorado à implantação. O export mede os vértices transformados e registra ambos os limites.
- **Grenadier Café (125699284).** Os 3,01 m correspondiam à diferença entre a estimativa do topo da cobertura e a medição do corpo base. A cobertura vive no setor da parada. Quando carregada, a caixa do exterior é registrada separadamente e unida à caixa do corpo base. O export ativa o setor para o diagnóstico.
- **Portas.** Os pontos são derivados dos modelos. O teste sonda a faixa exterior de aproximação com a colisão do jogador e mede a diferença vertical até a soleira. A indicação de abordagem livre cobre apenas a faixa amostrada. Sem porta modelada, o acesso fica explicitamente sem validação.
- **Transformações.** Os modelos usam o piso como translação vertical no grupo. O lote genérico incorpora a matriz mundial uma vez aos vértices, inclusive nas fundações e em suas cores. As reconstruções de setor reutilizam a mesma implantação.
- **Benchmark.** A primeira pose HUD de cada variante é capturada em páginas novas, com o mesmo perfil e conteúdo inicial. A V1 é reproduzida por uma flag de desenvolvimento. O carregamento inclui a cena toda. Os contadores de recursos são os expostos pelo renderer, e o tempo de quadro descreve o navegador automatizado.
