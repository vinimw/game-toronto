# Inventário visual anterior ao passe da entrada norte

- **Assets versionados:** três JSON geográficos em `public/data`, zero arquivos glTF/GLB e zero mapas de imagem externos. Sem importador de assets 3D.
- **Vegetação:** troncos de cinco lados. Copas de dodecaedros deformados, cilindros e icosaedros. O preset de sakura combinava sete icosaedros por copa. Arbustos derivavam de icosaedros e a forração usava três triângulos por tufo. Os lotes eram instanciados por geometria e as instâncias internas podiam ser ocultadas para desobstruir a câmera.
- **Materiais:** cenário e arquitetura genérica usavam Lambert; personagem em Standard. Textura de cor gerada em CPU, repetida no chão e caminhos. Havia uma textura radial de sombra de contato e texturas Canvas para placas do café DEMO e do Nature Centre. Sem normal, roughness ou AO mapeados nas superfícies principais.
- **Renderização:** WebGL, ACES Filmic, exposição 1,16. Hemisférica e direcional, fog linear por preset e sombras de contato. O jogo não ativava mapas de sombras.
- **Construções:** contornos OSM extrudados, com cobertura separada. Edifícios genéricos da prévia ampliada eram reunidos por célula espacial. O Nature Centre tinha malha autoral.
- **Relevo:** chunks da triangulação HRDEM a cerca de 8 m, cor por área geográfica e a mesma textura procedural nas vias. Os vértices das vias acompanham o terreno.
- **Qualidade:** High tem mais detalhes por amostra, raio de vegetação 82 m e teto de pixel ratio 1,65. Balanced tem 58% da forração, raio 48 m e pixel ratio até 1,2. Low usa 32% e 28 m, sem sombra de contato. Os modelos das copas principais eram iguais entre perfis.

## Novo fluxo

O Blender exporta GLB com escala métrica. O carregador usa GLTFLoader
e permite Meshopt quando o GLB o declara. A entrada atual usa GLB sem
compressão de malha e JPEG a 512 px para os materiais. KTX2/BasisU e Draco
foram considerados. O slice não incorpora transcodificadores adicionais,
pois os arquivos já são pequenos e ainda falta verificação em hardware móvel.
Mapas ARM mantêm AO e roughness no mesmo arquivo. A textura de vegetação
usa alfa recortado. A passagem atual seleciona um LOD mais leve no
Balanced e suprime sombras dinâmicas no Low.

O cache retém os bytes dos GLB; meshes, texturas e sombras pertencem à
cena e são descartadas na transição. A distância desativa lotes fora
do alcance e seleciona o LOD próximo, mantendo a cena livre de fetches
a cada frame. O pass é local à entrada norte da prévia `?park=expanded`.
A [planilha de licenças](asset-licenses.md) registra os insumos.
