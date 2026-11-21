# High Park · corredores jogáveis

## Acesso ao Grenadier Café

A [documentação municipal de 2013, p. 12](https://www.toronto.ca/legdocs/mmis/2013/gm/bgrd/backgroundfile-63570.pdf#page=12) documenta a existência de uma entrada principal e pátios laterais. O [estabelecimento](https://www.grenadiercafe.net/) documenta a chegada pelo parque. O snapshot OSM fornece o perímetro, mas não oferece uma soleira georreferenciada.

Na V2 a fachada gerava duas portas por simetria. O painel oeste em E=-92,645 m, Z=771,12 m tinha 0,407 m de desnível medido. Sua condição de porta pública nessa posição não tem suporte cartográfico ou fotográfico verificável. Ele passa a ser uma janela. A porta sul do modelo representa a chegada externa estilizada. O jogo permite aproximar-se da soleira e preserva a colisão da fachada. O briefing não exige um interior jogável. O teste registra separadamente a distância efetivamente alcançada, o desnível e a ausência de passagem para o interior.

## Direção dos corredores

A entrada norte preserva portal e eixo OSM. Grupos de maple e oak com GLBs autorais introduzem variação de silhueta e escala entre o portão e as quadras. A vegetação mais baixa acompanha esses grupos e deixa livres as superfícies esportivas. Em West Road os grupos verdes criam contraste com as copas já floridas do Cherry Hill, com repetição menor entre os setores e um grupo adicional na aproximação ao café. A variação de cor do gramado e dos caminhos opera em metros no shader, sobre as superfícies existentes. Os tufos usam um lote PBR fosco por setor e não alteram a malha do HRDEM. As posições de vegetação são composição artística, com afastamento das vias e exclusão de edifícios, água e quadras. Os modelos e suas licenças já constam em [asset-licenses.md](asset-licenses.md).

As fotos municipais são referência. Este passe reutiliza os cercamentos e mobiliário existentes. Os contornos de esporte e as marcas existentes continuam com a distinção entre área mapeada e detalhe ilustrativo.

A chegada às quadras ganhou um fundo arbóreo além dos contornos de jogo. O pequeno pavimento exterior do café acompanha o relevo e materializa a aproximação vista nas referências. Sua forma é uma aproximação artística. O material reutiliza o concreto CC0 da entrada norte, com normal e roughness no perfil High, cor no Balanced e cor sólida no Low. O pavimento é uma camada visual e não eleva a personagem nem libera a passagem através da alvenaria.

## Passe de coesão dos dois percursos

Seis células de composição cobrem o trecho depois do portal, o caminho e as margens das quadras, os taludes de West Road, a trilha de Cherry Hill e o gramado do café. O desenho alterna clareiras com bancos de vegetação em camadas. As árvores vêm da mesma biblioteca da entrada. As novas folhas pinadas e flores são autorais e usam uma malha instanciada por célula. Pensadas para a primavera, as flores ficam concentradas em Cherry Hill e na aproximação ao café. A filtragem afasta vegetação dos caminhos, edifícios, água e superfícies de esporte.

As quadras ganharam uma borda mineral ao nível do terreno, restrita aos contornos existentes. A borda é acabamento ilustrativo. Cercamentos existentes permanecem como antes. O terreno continua seguindo HRDEM, com maior variação de grama e desgaste por metro nas superfícies próximas aos dois corredores. Os setores preservam as faixas de ciclo de vida existentes. Balanced reutiliza duas variantes de copa e reduz amostras de forração, e Low preserva a representação base.
