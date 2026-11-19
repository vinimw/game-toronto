# Game Love · Toronto / High Park · POC 0.1

Protótipo jogável de exploração romântica em terceira pessoa, com visual low-poly estilizado e foco em desktop + celular.

**Status:** prova de conceito. Toronto é demonstrativa. O High Park inclui um recorte OSM de aproximadamente 400 × 400 m na entrada norte, com terreno plano e arte estilizada.

## Executar no Mac / PC

Requisitos: Node.js 20.19+ ou 22.12+, Python 3.10+, internet na primeira instalação.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. O jogo começa em **Toronto DEMO**. Entre no
High Park pelo portal. O rodapé exibe **OSM REAL** ao carregar o recorte e
**DEMO** se precisar usar o cenário ilustrativo. Para escolher a versão
ilustrativa, abra o jogo com `?map=demo`.

## Reproduzir o recorte da entrada norte

```bash
npm run map:import
```

O comando lê a [resposta arquivada da API OSM](tools/data/high-park-north.osm-source.json)
e grava `public/data/high-park.osm.json` sem rede. O recorte cobre Bloor Street West,
a calçada da entrada norte e o High Park Nature Centre. A extensão exata em ordem
sul, oeste, norte, leste é `43.65055, -79.467485, 43.65415, -79.462515`.
Os elementos de origem mantêm seus IDs e coordenadas WGS84 no arquivo arquivado.
A cena usa metros locais (X leste, Z sul), com recorte nas bordas. Consulte
[proveniência, verificação e limitações](docs/HIGH_PARK_OSM.md).

### Controles

| Plataforma | Controle |
| --- | --- |
| PC | `W A S D` mover · mouse arrastar câmera · `Shift` correr · rolagem zoom |
| PC | `E` memória · `I` álbum · `M` mapa · `Esc` fechar |
| Celular | joystick à esquerda · deslizar lado direito para girar a câmera · ↟ segurar para correr · tocar botão de memória |

As memórias descobertas são persistidas em `localStorage` do navegador (somente no dispositivo).

## O que funciona

- Câmera orbital suave em terceira pessoa e personagem feminino low-poly com animação procedural de caminhada.
- Mapa local com caminhos, edifícios e áreas verdes do OSM na entrada norte e vegetação decorativa procedural.
- Gerador de árvores via `InstancedMesh` para reduzir draw calls.
- Deslocamento WASD/joystick e correr, bloqueios básicos em prédios/água; zoom e rotação da câmera.
- Um marcador de memória com interação, carta demonstrativa, 3 espaços para fotos e álbum persistido.
- UI responsiva e contador de FPS.

## O que ainda não funciona / limites

- Não há transporte TTC, estação 3D, streetcars, NPCs, interiores, áudio ou missões múltiplas.
- Não há terreno de elevação real; o mapa é plano.
- Não há modelagem de fachadas reais; edifícios são volumes extrudados de footprints OSM, com altura estimada quando ausente.
- OSM pode não conter todas as ruas, caminhos, construções, vegetação e águas; relações multipoligonais complexas não são processadas na primeira versão.
- Não há carregamento progressivo por chunks: este POC limita a região importada em vez de renderizar Toronto inteira.
- Não houve validação de FPS em dispositivos reais neste ambiente. O número mostrado no rodapé serve para medir na máquina do usuário.
- A memória é uma demonstração fictícia, não uma história pessoal.

## Arquitetura

```text
src/
  main.js            bootstrap, inputs, câmera, HUD, interação e álbum
  map-loader.js      prefere snapshot OSM; fallback demonstrativo
  demo-world.js      cena ilustrativa explicitamente não geográfica
  world.js           gera meshes, vias, água, prédios, árvores e marcador
  character.js       personagem procedural animado
  geo.js             projeção local, nearest path, polígonos
  styles.css         interface desktop/mobile
public/data/
  high-park.osm.json  recorte OSM da entrada norte, gerado pelo importador

tools/
  import_osm.py      resposta arquivada OSM → coordenadas locais e recorte
  test_import_osm.py testes offline do importador
```

O projeto foi mantido **vanilla Three.js + Vite**, sem framework de interface por enquanto, para medir o custo da renderização 3D sem camadas adicionais. React pode ser introduzido para inventário/missões quando o mapa for validado.

## Validação mínima

```bash
npm test
npm run build
```

Em desktop e em celular na **mesma rede Wi-Fi**, acesse o endereço IP do computador na porta `5173`. No iPhone/Safari e Android/Chrome, verifique joystick, câmera, memória e FPS. Confirme que `MAPA OSM IMPORTADO` aparece antes de avaliar fidelidade de Toronto.

## Dados, crédito e licenças

O importador usa uma resposta arquivada da API do [OpenStreetMap](https://www.openstreetmap.org/copyright). **© OpenStreetMap contributors**, dados disponíveis conforme ODbL 1.0. A atribuição é apresentada no jogo no modo OSM. Se redistribuir dados adaptados, verifique suas obrigações segundo a ODbL. Nenhum dado/asset do Google Maps é copiado. O código deste protótipo é original e não reproduz assets do Summer Afternoon, usado apenas como referência de direção artística.

## Estabilização do protótipo

As correções, validações executadas, limitações de hardware e pendências de segurança estão em [Stage 1 — Validation](docs/STAGE_1_VALIDATION.md).

## Regiões e transições

O jogo começa em uma pequena cena **Toronto demonstrativa**. Aproxime-se do portal
para **Entrar no High Park** com `E` ou pelo botão na tela; a saída do parque permite
**Voltar a Toronto**. O mesmo personagem e progresso acompanham as transições.
High Park usa o snapshot OSM quando disponível e a cena ilustrativa existente como
fallback. Veja o [manifesto, ciclo de vida e validação das cenas](docs/REGION_SCENES.md).

Para evitar conflito com outros projetos na porta padrão:

```bash
npm run dev -- --port 5175 --strictPort
```

## Pacote para revisão externa

Execute `npm run review:export` para gerar as capturas e os relatórios em
`artifacts/reviews/game-love-review.zip`. Veja [instalação, pontos de captura
e solução de problemas](docs/REVIEW_EXPORT.md).
