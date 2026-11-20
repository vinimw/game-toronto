# Descobertas e álbum

O fluxo reutiliza o prompt de interação do HUD, o modal compartilhado,
o álbum, a missão introdutória, o estado local e as transições do
SceneManager. O estado do jogador continua independente das cenas.

## Primeira memória

`memory-001`, **Uma pausa no parque**, é uma demonstração fictícia.
A posição usa uma âncora geográfica sobre a calçada OSM 225583279,
junto ao Nature Centre. A projeção usa a origem da região. Se a
feição se afastar mais de três metros da âncora ou a posição deixar
de ser caminhável, o ponto não é colocado. No mapa ilustrativo
do High Park, o fluxo usa o ponto demonstrativo anterior.

O brilho indica uma memória disponível. Entrar no raio de cinco
metros registra a descoberta e revela a ação. Pressionar E ou tocar
no botão de interação desbloqueia a narrativa. O álbum permite
reabrir uma memória já desbloqueada.

## Dados e persistência

Definições ficam em [memories.js](../src/memories.js). Cada entrada
tem ID, região, âncora, título, resumo, narrativa, raio e referência
visual opcionais conforme o caso. Para incluir uma foto autorizada,
configure `image: {src, alt}` com um caminho local público. A
apresentação tem uma ilustração para memórias sem foto. O conteúdo
incluído no build fica acessível no cliente, portanto use no build
público apenas textos e imagens autorizados para publicação.

O formato do salvamento local está na versão 2 e preserva o ID da
memória antiga, o inventário e o progresso. Encontros e desbloqueios
são registrados uma vez por ID. O álbum e o mapa local usam esse
estado para mostrar o conteúdo e os pontos conhecidos.
