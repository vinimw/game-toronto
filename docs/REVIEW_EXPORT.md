# Exportação de revisão do Game Love

No macOS, com Node.js 20.19+ (ou 22.12+), Python 3 e os utilitários `zip` e `unzip` disponíveis:

```sh
npm ci
npm run review:export
```

O exportador usa o Chromium do Playwright quando instalado e tenta o Google Chrome local em seguida. Para baixar o Chromium, execute `npx playwright-core install chromium`. Para selecionar outro binário compatível, use `REVIEW_BROWSER_PATH=/caminho/do/chromium npm run review:export`.

O comando executa o build em um diretório temporário e roda os testes antes da captura. Reutiliza uma página de revisão do Vite nas portas 5173, 5174, 5175 ou 5177, quando disponível. Para apontar para outro servidor de desenvolvimento local, use `REVIEW_URL=http://127.0.0.1:5177 npm run review:export`. Caso necessário, o exportador cria um servidor em loopback a partir da porta 4178, que é encerrado ao final. Para sempre criar um servidor separado, use `REVIEW_ISOLATED=1 npm run review:export`. O navegador usa um perfil descartável.

O pacote fica em `artifacts/reviews/game-love-review.zip`, e a cópia aberta do último relatório em `artifacts/reviews/latest/`. A execução seguinte substitui os resultados anteriores. O ZIP automático contém os quatro relatórios JSON, as capturas produzidas e, quando disponível, o snapshot de origem OSM compactado.

| Arquivo | Conteúdo |
| --- | --- |
| `metadata.json` | Data UTC, versão Git e indicador de alterações locais, build, testes, navegador, enquadramentos, origem, coordenadas e pontos indisponíveis |
| `performance.json` | FPS, média e p95 do intervalo bruto entre quadros, chamadas de desenho, triângulos, contagens do renderer, tempo de carregamento e distribuição da vegetação procedural no High Park OSM |
| `console-errors.json` | Exceções JavaScript, promises rejeitadas, falhas HTTP ou de rede em recursos e erros de captura |
| `geographic-correspondence.json` | Extensão, hash da fonte, divergências por ID, cruzamentos, rota, limites e versão Git |
| `screenshots/` | Seis vistas padronizadas mais referência e sobreposição OSM quando o recorte é carregado |
| `geography/high-park-north.osm-source.json.gz` | Resposta de origem arquivada, com SHA-256 do JSON descompactado no relatório |

A medição usa 75 amostras brutas de `requestAnimationFrame`, depois de 15 intervalos de aquecimento. A cena fica estática. O tempo de carregamento abrange dados, construção e ativação pelo `SceneManager`, e o mesmo valor aparece para os pontos que reutilizam a cena já carregada. As contagens de memória incluem geometrias e texturas do renderer, em unidades de recurso. FPS e frame time dependem da máquina, do navegador e da aceleração gráfica. Eles não substituem testes em celular físico.

No High Park OSM, `vegetation.placed` enumera a vegetação procedural do recorte. `vegetation.grid` organiza árvores e instâncias de arbustos em quadrículas de norte para sul e de oeste para leste. `detailInstancesEnabled` informa quantas instâncias de detalhe foram habilitadas pelo perfil e pelo raio da câmera antes do descarte do renderer. O perfil está em `metadata.json`.

## Pontos e origem geográfica

Os pontos e poses estão em [tools/review/points.js](../tools/review/points.js). A página interna de desenvolvimento em `/tools/review/index.html` usa o `SceneManager`, a personagem e o renderizador do jogo em um contexto separado. Ela não faz parte do build de produção e funciona sem inventário, memórias desbloqueadas ou acesso ao armazenamento do jogador.

As duas vistas de Toronto continuam DEMO. O High Park real tem poses cadastradas
para a calçada, a vegetação e o Nature Centre. A quinta captura conserva o ID da
série e descreve o Nature Centre como local especial. A ortográfica mantém norte
para cima e o metadado distingue a bbox dos dados da extensão visível da câmera.
Os dados DEMO têm origem ilustrativa. Coordenadas intermediárias só são convertidas
para referência geográfica quando o modo é OSM REAL.


## Vídeo opcional

O Playwright pode gravar a página, mas um vídeo reproduzível de 15–30 segundos exigiria um percurso de entrada separado por origem do mapa e uma etapa estável de codificação MP4. O exportador atual registra que não gerou vídeo e conclui a exportação normalmente.

Para anexar um MP4 de 15–30 segundos gravado manualmente no jogo:

```sh
cp /caminho/da/gravacao.mp4 artifacts/reviews/latest/high-park-walk.mp4
(cd artifacts/reviews/latest && zip -q ../game-love-review.zip high-park-walk.mp4)
unzip -tq artifacts/reviews/game-love-review.zip
```

Revise o vídeo antes de compartilhar. Uma nova exportação volta a gerar o ZIP automático sem o anexo manual.

## Problemas comuns

- **Chromium ausente ou WebGL indisponível.** Instale o navegador indicado acima ou tente o Google Chrome atualizado. Restrições de execução de processos ou de portas locais no ambiente em que o comando roda podem impedir o Vite ou Chromium de iniciar.
- **Pacote gerado com falhas.** O comando retorna código 1 após publicar os diagnósticos, quando consegue gerar um ZIP válido. Veja `metadata.json` e `console-errors.json`. Quando o processo falha antes dessa publicação, a última exportação permanece disponível.
- **Captura indisponível.** Confira a origem e o motivo em `metadata.json`. Um ponto ausente ou obstruído é registrado individualmente, e os demais pontos ainda podem ser exportados.
- **Exportação em andamento.** Aguarde o outro comando encerrar. Se tiver certeza de que um processo anterior foi encerrado abruptamente, remova o diretório vazio `artifacts/reviews/.export-lock` e tente novamente.
