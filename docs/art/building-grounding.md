# Implantação vertical dos edifícios

O HUD imprime X como leste e −Z como norte. A posição 122 m E e −85 m N
se traduz para [122, 85]. A construção mais próxima no recorte é o
Nature Centre (OSM 43805272). O método anterior posicionava o piso em
−5,75 m relativos à origem vertical. O terreno chega a −2,54 m dentro
da implantação, cobrindo cerca de 3,21 m da parede no lado alto.
A direção original da câmera não consta do briefing. As novas câmeras
usam a posição do HUD e enquadram a construção que esse ponto permite
reproduzir.

A triangulação de HRDEM e seu datum continuam iguais. A amostragem
inclui vértices do footprint, vértices do terreno sob o edifício e
interseções do perímetro com as arestas da grade. O piso usa a maior
cota coberta; uma fundação perimetral estende a base até abaixo do
mínimo. O lote estático, os setores, o Nature Centre e a cobertura e a
fachada do café usam a mesma regra. O lote incorpora a transformação
uma vez na geometria final. O modelo permanece nivelado e seu contorno
horizontal OSM continua intacto.

O diagnóstico usa bounds medidos quando a malha foi construída e bounds
estimados para setores ainda inativos. O volume decorativo do café
carrega em um setor separado, com altura máxima estimada no diagnóstico.
Alturas de portas, degraus e níveis subterrâneos não foram levantadas.
O embasamento é visual, não uma reconstrução de fundações ou acessos.
Portões, quadras, jardins, trilhas e objetos apoiados pontualmente
continuam usando seus próprios pontos de amostragem do HRDEM. O passeio
registra o erro vertical da personagem a 1× e 15×. Ele não garante
ausência de pop-in visual ou reproduz todos os ciclos de LOD.
