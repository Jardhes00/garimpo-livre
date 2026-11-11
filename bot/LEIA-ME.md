# Bot do Garimpo Livre

O bot faz duas coisas:

1. **Garimpo automático:** nos horários que você escolher (padrão: **10 ofertas às 11h** e **12 às 16h**), ele abre a página de ofertas do Mercado Livre, escolhe as melhores pelos seus critérios, gera o **link de afiliado** pela barra de afiliados, baixa a foto, **posta no grupo** no modelo do Garimpo Livre e coloca a oferta no site.
2. **Leitura do grupo (opcional):** quando você ou seu parceiro postam uma oferta à mão no grupo, ela também vai para o site.

---

## Antes de começar

- **De quem é o link de afiliado:** é da conta do Mercado Livre que fizer login no navegador do bot (Passo 5). Se as comissões são do seu parceiro, **ele** faz esse login.
- **O número do bot precisa poder postar:** se o grupo for "só administradores enviam mensagens", torne o número do bot **administrador**.
- **Comece por um grupo de teste:** crie um grupo só com você, seu parceiro e o bot para os primeiros testes.

---

## Passo 1: preparar o chip do bot

1. Coloque o chip num celular e instale o **WhatsApp** (ou WhatsApp Business).
2. **Use o número normalmente por alguns dias** antes de ligar o bot: converse com você e com seu parceiro, entre nos grupos. Número novo que já começa postando muito tem mais chance de ser bloqueado.
3. Adicione o número ao grupo de teste (e depois ao grupo de verdade, como administrador se precisar).

## Passo 2: instalar o Node.js

Baixe e instale a versão **LTS** em https://nodejs.org (é só seguir o instalador).

## Passo 3: instalar o bot

Abra o **Prompt de Comando** dentro da pasta `bot` e rode:

```
npm install
```

Demora alguns minutos na primeira vez, porque baixa um navegador interno.

## Passo 4: configurar

Copie `config.example.json`, renomeie a cópia para `config.json` e abra no Bloco de Notas.

| Campo | O que é |
|---|---|
| `grupo` | Nome **exato** do grupo onde o bot vai postar (comece com o grupo de teste) |
| `canal` | Link do Canal do WhatsApp que vai no fim de cada post |
| `avisarNumero` | Seu número com DDD (ex.: `"5511999999999"`). O bot te avisa no privado se o Mercado Livre pedir login ou se der erro. Vazio = sem avisos |
| `garimpo.horarios` | Horários e quantidades. Ex.: `{ "hora": "11:00", "quantidade": 10 }` |
| `garimpo.intervaloMinutos` | Espera entre um post e outro, sorteada entre os dois números (padrão: 3 a 6 minutos) |
| `garimpo.criterios` | Como o bot escolhe as ofertas (tabela abaixo) |
| `autorizados` | Quem pode alimentar o site postando à mão (Passo 9). Pode deixar vazio |
| `git.ativo` | `true` para o site se atualizar sozinho no GitHub (Passo 10) |

**Critérios de escolha (`garimpo.criterios`):**

| Critério | Padrão | O que faz |
|---|---|---|
| `descontoMinimo` | 25 | Só posta ofertas com pelo menos esse % de desconto |
| `notaMinima` | 4.6 | Nota mínima do produto (de 0 a 5) |
| `precoMinimo` / `precoMaximo` | 15 / 3000 | Faixa de preço em reais |
| `evitarRepetirDias` | 7 | Não repete um produto postado nesses últimos dias |
| `maxPorCategoria` | 3 | No máximo isso por categoria em cada rodada, para variar |
| `exigirFreteGratis` | false | `true` = só ofertas com frete grátis |
| `palavrasBloqueadas` | [] | Produtos que você não quer postar. Ex.: `["perfume", "pneu"]` |

## Passo 5: login no Mercado Livre (conta de afiliado)

Com o bot desligado, rode:

```
npm run login-ml
```

Abre uma janela do navegador do bot. **A pessoa dona da conta de afiliado** (você ou seu parceiro):
1. Entra no Mercado Livre com a conta dela.
2. Abre qualquer produto e confere se aparece a barra preta **"Afiliados"** no topo.
3. Fecha a janela. O login fica salvo só neste computador, na pasta `.ml-perfil`.

## Passo 6: conectar o WhatsApp do bot

```
npm start
```

Vai aparecer um **QR Code**. No celular do bot: **WhatsApp > Aparelhos conectados > Conectar aparelho** e escaneie. Quando aparecer `✅ Conectado ao grupo`, feche com **Ctrl+C**.

Se aparecer "Não achei o grupo", o bot lista os grupos em que está. Copie o nome certo para o `config.json`.

## Passo 7: primeiro teste (2 ofertas, agora)

Com o `grupo` ainda apontando para o **grupo de teste**:

```
npm run testar
```

O bot faz uma rodada na hora com **2 ofertas**. Confira no grupo de teste:
- a foto e o texto vieram certinhos;
- **o link abre o produto e é o `meli.la` da conta certa** (no painel de afiliados, os cliques aparecem para essa conta);
- o preço bate com o anúncio.

Depois feche com **Ctrl+C**.

## Passo 8: ligar de verdade

1. No `config.json`, troque `grupo` pelo nome do grupo de verdade.
2. Rode `npm start` e **deixe a janela aberta**.

O bot posta sozinho nos horários configurados. Se o computador ligar atrasado, ele ainda faz a rodada até 15 minutos depois do horário, e nunca faz a mesma rodada duas vezes no dia.

## Passo 9 (opcional): posts feitos à mão também vão para o site

Se você ou seu parceiro postarem uma oferta à mão no grupo, o bot pode colocar no site também:

1. Com `autorizados` vazio, mande uma mensagem no grupo. Na tela do bot aparece: `📋 Mensagem de Fulano. Copie para "autorizados": "5511999999999"`.
2. Coloque os ids no `config.json`: `"autorizados": ["5511999999999", "5521988888888"]` e reinicie o bot.
3. Poste no modelo (nome em `*negrito*`, linha com `R$`, link `meli.la`), de preferência como **foto com legenda**. Hashtags como `#casa` definem a categoria, `#destaque` coloca a oferta na "Pepita do dia" do site, e `#remover <link>` tira uma oferta do site.

## Passo 10 (opcional): o site se atualizar sozinho

1. Crie um repositório no GitHub (ex.: `garimpo-livre`) e envie a pasta inteira do site. O `.gitignore` já impede que o login do WhatsApp, o login do Mercado Livre, o `config.json` e os números sejam enviados.
2. No GitHub: **Settings > Pages > Deploy from a branch > main / (root)**.
3. No `config.json`, mude `git.ativo` para `true`.

---

## Para funcionar todo dia

- **Computador ligado e janela do bot aberta** nos horários. Se fechar, rode `npm start` de novo.
- **Celular do bot ligado e com internet** de vez em quando.
- **Login do Mercado Livre:** de tempos em tempos o Mercado Livre pede login de novo. O bot avisa (na tela e no seu privado, se configurou `avisarNumero`). Aí: feche o bot, rode `npm run login-ml`, entre de novo e rode `npm start`.

## Problemas comuns

| Problema | O que fazer |
|---|---|
| "O Mercado Livre pediu login" | Passo 5 de novo |
| "a barra de afiliado não apareceu" | A conta logada não é afiliada, ou a barra mudou. Rode `npm run login-ml` e confira se a barra "Afiliados" aparece nos produtos |
| "Nenhuma oferta passou nos critérios" | Diminua `descontoMinimo` ou `notaMinima` no `config.json` |
| Erro ao abrir o navegador | Rode `npm install` de novo. Se continuar, use o Edge do Windows: antes do comando, rode `set NAVEGADOR=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| QR Code não aparece ou trava | Rode `npm update whatsapp-web.js` |
| "Falha no login" do WhatsApp | Apague a pasta `.sessao` e escaneie o QR de novo |

Para ver o navegador trabalhando (bom para entender um problema), coloque `"navegadorVisivel": true` dentro de `garimpo`.

## Riscos, com sinceridade

- **WhatsApp:** o bot usa uma biblioteca não oficial (`whatsapp-web.js`) e **envia** mensagens no grupo. O WhatsApp pode bloquear números que usam automação. Por isso: número próprio para o bot, uso normal antes de ligar, intervalo entre posts e nada de mandar mensagem para quem não pediu. Se o número for bloqueado, o grupo continua com você como administrador.
- **Mercado Livre:** o bot gera os links clicando na barra de afiliados, como uma pessoa faria. Leia os **termos do Programa de Afiliados** sobre uso de ferramentas automáticas; se o Mercado Livre não aceitar, a conta de afiliado pode ter problemas. Na dúvida, use o bot só para buscar e mande os links à mão.
- **Preços:** o bot copia o preço da página na hora do post. Ofertas relâmpago e estoques mudam rápido; o rodapé do site avisa para conferir o valor final.

## Testes

```
npm test
```

Confere a leitura dos cards de oferta, a escolha das ofertas, o texto dos posts e a gravação no site, sem abrir o WhatsApp nem o Mercado Livre.
