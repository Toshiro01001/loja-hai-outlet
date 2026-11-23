/* Teste do catálogo: node tests/catalogo.cjs, com a pasta do site servida em http://localhost:8311/ (python3 -m http.server 8311).
   Confere o Catálogo Hering no computador, no iPhone 13 e em 320 px: endereço de cada peça, filtros, tamanhos e mensagem do WhatsApp. */
const { chromium, devices } = require('playwright');
const URL = process.env.SITE || 'http://localhost:8311/';
let falhas = 0;
function ok(cond, texto) { if (!cond) { falhas++; console.log('  FALHOU: ' + texto); } }
async function fecharAviso(pg) { await pg.waitForTimeout(4200); if (await pg.locator('#f-nao').isVisible()) { await pg.locator('#f-nao').click(); await pg.waitForTimeout(500); } }
(async () => {
  const b = await chromium.launch();
  const telas = [['computador', { viewport: { width: 1280, height: 900 } }], ['iPhone 13', { ...devices['iPhone 13'] }], ['320 px', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }], ['menos movimento', { viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }]];
  for (const [nome, opc] of telas) {
    console.log(nome);
    const ctx = await b.newContext(opc), pg = await ctx.newPage(), erros = [];
    pg.on('pageerror', e => erros.push(e.message)); pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    /* 1. endereços das peças: o antigo continua abrindo a peça antiga e a peça Hering tem o dela */
    await pg.goto(URL + '#peca-01', { waitUntil: 'networkidle' }); await pg.waitForTimeout(1500);
    ok((await pg.locator('#p-foto').getAttribute('src')).includes('c-01'), '#peca-01 deveria abrir a foto c-01');
    await pg.goto(URL + '#peca-h-01', { waitUntil: 'networkidle' }); await pg.reload({ waitUntil: 'networkidle' }); await pg.waitForTimeout(1500);
    ok((await pg.locator('#p-foto').getAttribute('src')).includes('h-01'), '#peca-h-01 deveria abrir a foto h-01');
    ok((await pg.locator('#p-preco').textContent()).includes('149,99'), 'preço da bermuda cargo');
    ok((await pg.locator('#p-tam button').allTextContents()).join() === '42,46', 'tamanhos 42 e 46');
    /* 2. início e filtro da marca */
    await pg.goto(URL, { waitUntil: 'networkidle' }); await pg.reload({ waitUntil: 'networkidle' }); await fecharAviso(pg);
    const ids = await pg.evaluate(() => window.LOJA.catalogo.map(p => p.id));
    ok(new Set(ids).size === ids.length, 'cada peça precisa de um endereço só dela');
    ok((await pg.locator('#b-marca-texto').textContent()) === 'Abrir o Catálogo Hering', 'botão do início');
    await pg.locator('#b-marca').click(); await pg.waitForTimeout(1200);
    ok((await pg.locator('#cat-conta').textContent()).startsWith('25 peças da Hering'), 'contagem do Catálogo Hering');
    const grupos = await pg.locator('#chips button:visible').allTextContents();
    ok((await pg.evaluate(() => location.hash)) === '#catalogo-hering', 'o botão do início abre #catalogo-hering');
    ok(grupos.join('|') === 'Tudo25|Masculino25', 'com a marca escolhida, os grupos contam só as peças dela (veio ' + grupos.join('|') + ')');
    ok((await pg.locator('#chips button', { hasText: 'Masculino' }).getAttribute('aria-pressed')) === 'true', 'grupo único já aberto');
    const tipos = await pg.locator('#subchips button').allTextContents();
    ok(tipos.join('|') === 'Todos25|Camisetas e regatas13|Polos7|Bermudas e shorts5', 'tipos dentro do Masculino (veio ' + tipos.join('|') + ')');
    await pg.locator('#subchips button', { hasText: 'Polos' }).click(); await pg.waitForTimeout(700);
    ok((await pg.locator('#cat-grade button.peca, #cat-grade > *').count()) >= 7, 'grade com as polos');
    /* 3. peça de um tamanho só: já vem escolhido e vai na mensagem, com o preço */
    await pg.locator('#subchips button', { hasText: 'Bermudas' }).click(); await pg.waitForTimeout(700);
    await pg.locator('#cat-grade button', { hasText: 'Short azul-claro' }).first().click(); await pg.waitForTimeout(900);
    ok((await pg.locator('#p-tam button[aria-pressed="true"]').textContent()) === 'G', 'tamanho único já escolhido');
    const zap = decodeURIComponent(await pg.locator('#p-whats').getAttribute('href'));
    ok(zap.includes('Short azul-claro com cordão, tamanho G, R$ 89,99.'), 'mensagem do WhatsApp com tamanho e preço (veio ' + zap.split('text=')[1] + ')');
    ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'sem rolagem para o lado');
    /* 4. aba própria: fechar a peça continua no Catálogo Hering; o catálogo geral segue inteiro; Ofertas e Início seguem funcionando */
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
    ok((await pg.evaluate(() => location.hash)) === '#catalogo-hering', 'fechar a peça volta para #catalogo-hering');
    ok((await pg.locator('#aba-marca').getAttribute('aria-current')) === 'page', 'aba Catálogo Hering marcada');
    ok((await pg.locator('#t-cat').textContent()) === 'Catálogo Hering', 'título da tela');
    ok(!(await pg.locator('#marcas').isVisible()), 'fileira de marcas escondida no catálogo da marca');
    const pil = await pg.evaluate(() => { const a = document.querySelector('.abas a[aria-current]').getBoundingClientRect(), p = document.querySelector('.abas-marca').getBoundingClientRect(); return Math.abs(a.left - p.left) < 2 && Math.abs(a.width - p.width) < 2; });
    ok(pil, 'pílula verde embaixo da aba aberta');
    ok(!(await pg.evaluate(() => { const r = document.getElementById('barra').getBoundingClientRect(); return [...document.querySelectorAll('#barra a')].some(e => e.offsetWidth && (e.getBoundingClientRect().right > r.right + 1 || e.scrollWidth > e.clientWidth + 1)); })), 'abas cabem no menu');
    await pg.locator('#aba-catalogo').click(); await pg.waitForTimeout(1300);
    ok((await pg.locator('#cat-conta').textContent()).startsWith('69 peças'), 'catálogo geral com as 69 peças (veio ' + (await pg.locator('#cat-conta').textContent()) + ')');
    ok(await pg.locator('#marcas').isVisible(), 'fileira de marcas de volta no catálogo geral');
    ok((await pg.locator('#chips button:visible').allTextContents()).join('|').startsWith('Tudo69|Feminino'), 'grupos do catálogo geral');
    ok((await pg.locator('#t-cat').textContent()) === 'Catálogo', 'título do catálogo geral');
    await pg.locator('#aba-ofertas').click(); await pg.waitForTimeout(1300);
    ok((await pg.locator('#t-cat').textContent()) === 'Ofertas', 'tela Ofertas');
    await pg.locator('#aba-marca').click(); await pg.waitForTimeout(1300);
    ok((await pg.locator('#cat-conta').textContent()).startsWith('25 peças da Hering'), 'volta ao Catálogo Hering pela aba');
    await pg.goBack(); await pg.waitForTimeout(1300);
    ok((await pg.locator('#t-cat').textContent()) === 'Ofertas', 'botão de voltar do aparelho');
    await pg.locator('#aba-inicio').click(); await pg.waitForTimeout(1000);
    ok(await pg.locator('#inicio').isVisible(), 'Início');
    ok(!erros.length, 'erros no console: ' + erros.join(' / '));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? falhas + ' falha(s)' : 'Tudo certo.'); process.exit(falhas ? 1 : 0);
})();
