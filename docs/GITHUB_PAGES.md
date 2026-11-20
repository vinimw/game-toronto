# Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` instala com `npm ci`, executa
os testes, compila com Vite, verifica os arquivos e envia somente `dist`
para GitHub Pages. Um push em `main` ou a execução manual do workflow
inicia a publicação.

1. No GitHub, abra Settings → Pages.
2. Em Build and deployment → Source, selecione GitHub Actions.
3. Após enviar o commit para a branch principal, acompanhe Actions →
   Deploy Game Love to GitHub Pages. O job deploy mostra a URL publicada.
4. Abra a URL do projeto com a query `?park=expanded`, por exemplo
   `https://USUARIO.github.io/REPOSITORIO/?park=expanded`.

O base é obtido do output `base_path` de configure-pages. Assim, renomear
o repositório atualiza o próximo deploy. Para uma configuração específica,
crie a variável de repositório `PAGES_BASE_PATH` em Settings →
Secrets and variables → Actions → Variables, com valor como
`/nome-do-repositorio/` ou `/` para domínio próprio ou site do usuário.

## Execução local

```sh
npm ci
npm test
npm run dev
```

O servidor de desenvolvimento continua em `/`. Para testar um projeto Pages
compilado em um subdiretório arbitrário, execute os dois comandos com o mesmo
nome de repositório.

```sh
PAGES_REPOSITORY_NAME=meu-repositorio npm run build
node tools/check-pages-dist.mjs
PAGES_REPOSITORY_NAME=meu-repositorio npm run preview
```

Abra `http://localhost:4173/meu-repositorio/?park=expanded`.
O build aceita também `PAGES_BASE_PATH=/meu-repositorio/`, com prioridade
sobre PAGES_REPOSITORY_NAME.

## Assets e publicação

GLBs, texturas, OSM e HRDEM usam o helper `src/asset-url.js`, baseado em
`import.meta.env.BASE_URL`. Imagens de memórias locais também passam pelo
helper. Vídeos ou novos assets aprovados devem usar o mesmo helper quando
suas URLs forem montadas em JavaScript. A versão atual não possui vídeos
de gameplay em public/.

A verificação do artefato permite os dados cartográficos atuais, os assets
autoriais/PBR da entrada e os bundles gerados. Novas imagens de memórias e
vídeos precisam de aprovação explícita e inclusão na lista do verificador.
Arquivos desconhecidos em public/ ou dist/ fazem o deploy falhar.

Os relatórios de revisão, ferramentas Blender, fotos de referência e scripts
de desenvolvimento ficam fora de dist/. Fontes e licenças constam em
`docs/art/asset-licenses.md`. Os dados OSM mantêm a atribuição no jogo.

O streaming usa fetch de arquivos estáticos e cache binário em memória.
O progresso continua no localStorage do navegador, por origem. A primeira
visita ao domínio Pages tem seu próprio armazenamento.

GitHub Pages gratuito está disponível para repositórios públicos no plano
GitHub Free. A configuração e o deploy remoto dependem de habilitar Pages
e enviar o commit.

Referências
- [Vite, publicação em Pages](https://vite.dev/guide/static-deploy.html#github-pages)
- [GitHub, workflows para Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Falhas de acesso

Se configure-pages apresentar Resource not accessible by integration,
confira a permissão pages: read do job build e a ativação de Pages nas
configurações do repositório. O job deploy precisa de pages: write e
id-token: write.

Em repositório privado, a disponibilidade depende do plano GitHub.
A API recusou a ativação deste repositório no plano atual com HTTP 422
e a mensagem “Your current plan does not support GitHub Pages for this repository.”
A publicação depende de um plano compatível, da aprovação para tornar o
repositório público ou de outra hospedagem.
