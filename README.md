# Game Love · Toronto / High Park · POC 0.1

Protótipo jogável de exploração romântica em terceira pessoa, com visual low-poly estilizado e foco em desktop + celular.

**Status:** prova de conceito. Há uma **cena demonstrativa ilustrativa** incluída para testar controles sem conexão com serviços geográficos. Para gerar **ruas, caminhos, edifícios e lagos com geometria real do OpenStreetMap**, execute o importador (instruções abaixo). Não confundir o cenário demonstrativo com um mapa fiel.

## Executar no Mac / PC

Requisitos: Node.js 20.19+ ou 22.12+, Python 3.10+, internet na primeira instalação.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. O jogo abre no **modo de demonstração** caso não haja um arquivo OSM importado. O app não depende da API geográfica durante a execução, somente durante a importação.

## Importar geometria real de High Park

Em um terminal separado (precisa de internet):

```bash
npm run map:import
```

O script faz uma consulta na Overpass API e grava `public/data/high-park.osm.json`. Reinicie/recarregue a página. O rodapé deverá exibir **MAPA OSM IMPORTADO**. A importação deve ser feita esporadicamente; não faça consultas contínuas à API pública. Se o serviço estiver instável, o script tenta endpoints alternativos e retorna um erro sem sobrescrever o arquivo anterior.

**Área padrão:** norte/centro do High Park, um recorte do parque e seu entorno — não toda Toronto. Para mudar o recorte:

```bash
python3 tools/import_osm.py --bbox 43.645 -79.473 43.654 -79.456
```

Ordem: `sul oeste norte leste`. Recortes maiores têm custo de renderização e podem ser inadequados no celular; compare FPS no protótipo.

### Controles

| Plataforma | Controle |
| --- | --- |
| PC | `W A S D` mover · mouse arrastar câmera · `Shift` correr · rolagem zoom |
| PC | `E` memória · `I` álbum · `M` mapa · `Esc` fechar |
| Celular | joystick à esquerda · deslizar lado direito para girar a câmera · ↟ segurar para correr · tocar botão de memória |

As memórias descobertas são persistidas em `localStorage` do navegador (somente no dispositivo).

## O que funciona

- Câmera orbital suave em terceira pessoa e personagem feminino low-poly com animação procedural de caminhada.
- Mapa local com caminhos, edifícios, água e vegetação (ilustrativo por padrão; geometria real após importação).
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
  high-park.osm.json  gerado pelo importador; ausente até executar

tools/
  import_osm.py      Overpass -> geometrias locais simplificadas
  test_import_osm.py testes offline do importador
```

O projeto foi mantido **vanilla Three.js + Vite**, sem framework de interface por enquanto, para medir o custo da renderização 3D sem camadas adicionais. React pode ser introduzido para inventário/missões quando o mapa for validado.

## Validação mínima

```bash
npm run check:importer
npm run build
```

Em desktop e em celular na **mesma rede Wi-Fi**, acesse o endereço IP do computador na porta `5173`. No iPhone/Safari e Android/Chrome, verifique joystick, câmera, memória e FPS. Confirme que `MAPA OSM IMPORTADO` aparece antes de avaliar fidelidade de Toronto.

## Dados, crédito e licenças

O importador usa a [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) para obter informações do [OpenStreetMap](https://www.openstreetmap.org/copyright). **© OpenStreetMap contributors**, dados disponíveis conforme ODbL 1.0. A atribuição é apresentada no jogo no modo OSM. Se redistribuir dados adaptados, verifique suas obrigações segundo a ODbL. Nenhum dado/asset do Google Maps é copiado. O código deste protótipo é original e não reproduz assets do Summer Afternoon, usado apenas como referência de direção artística.
