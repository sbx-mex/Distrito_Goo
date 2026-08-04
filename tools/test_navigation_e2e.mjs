import { chromium } from 'playwright';

const baseURL = process.env.DISTRITO_GO_URL || 'http://127.0.0.1:4173';
const viewports = [
  {name:'mobile-320', width:320, height:740},
  {name:'mobile-390', width:390, height:844},
  {name:'tablet-768', width:768, height:1024},
  {name:'desktop-1440', width:1440, height:1000},
];
const results = [];
let browser;

function check(name, ok, detail=''){
  results.push({name, ok:Boolean(ok), detail});
  if(!ok) throw new Error(`${name}: ${detail}`);
}

try{
  browser = await chromium.launch({headless:true});
  for(const viewport of viewports){
    const page = await browser.newPage({viewport});
    await page.clock.setFixedTime(new Date('2026-08-03T12:00:00-06:00'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, {waitUntil:'networkidle'});
    await page.waitForSelector('body.app-ready');
    check(`${viewport.name} carga`, errors.length === 0, errors.join(' | '));
    check(`${viewport.name} centro de mando`, await page.locator('#command-center-grid .command-summary-card').count() === 4, 'debe mostrar cuatro resúmenes');
    const informativeCards = page.locator('#informative-catalog-track .permanent-info-card');
    check(`${viewport.name} informativos vigentes`, await informativeCards.count() === 7, 'debe mostrar los siete registros visuales del CMS');
    const informativeImage = informativeCards.first().locator('.permanent-info-media img');
    await informativeImage.waitFor({state:'visible'});
    check(`${viewport.name} imagen informativa visible`, await informativeImage.evaluate(image => image.complete && image.naturalWidth > 0 && image.getBoundingClientRect().height >= 150), 'la imagen previa no se cargó o quedó oculta');
    const mondayAgenda = await page.locator('#home-weekly-card').innerText();
    for(const expected of ['WFM - Pronóstico', 'ECO 2026', 'AutoICA', 'Corte de Nómina', 'Best Talent - Cascada DM - SM', 'Upsize sin costo adicional', 'Concurso de Venta']){
      check(`${viewport.name} agenda incluye ${expected}`, mondayAgenda.includes(expected), 'evento vigente ausente del calendario del 3 de agosto');
    }
    check(`${viewport.name} WFM semana 34`, mondayAgenda.includes('WFM · Semana 34') && /17 de agosto al 23 de agosto/i.test(mondayAgenda), 'semana objetivo o rango dinámico incorrectos');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${viewport.name} sin corte horizontal`, overflow <= 1, `desbordamiento ${overflow}px`);
    await informativeCards.first().locator('.permanent-info-media').click();
    await page.waitForSelector('#quick-modal[open]');
    check(`${viewport.name} imagen ampliable`, await page.locator('#quick-modal .visual-detail-media').count() === 1, 'la vista previa no abre el recurso completo');
    await page.locator('#close-quick-modal').click();
    await page.locator('#header-search').click();
    await page.locator('#general-search-input').fill('inventario');
    await page.waitForSelector('#global-search-results:not([hidden])');
    check(`${viewport.name} búsqueda global`, await page.locator('#global-search-grid [data-open-search-result]').count() > 0, 'sin resultados accionables');
    await page.locator('[data-view="home"]').click();
    await page.locator('[data-command-target="eventos-cms"]').click();
    await page.waitForSelector('body[data-detail-target="eventos-cms"]');
    check(`${viewport.name} ruta contextual`, await page.locator('#context-trail:not([hidden])').count() === 1, 'breadcrumb oculto');
    await page.locator('[data-context-home]').click();
    check(`${viewport.name} volver a inicio`, await page.locator('body[data-app-view="home"]').count() === 1, 'no regresó a inicio');
    await page.close();
  }
} finally {
  await browser?.close();
}

const failed = results.filter(item => !item.ok);
console.log(JSON.stringify({ok:!failed.length, summary:{passed:results.length-failed.length, failed:failed.length, total:results.length}, checks:results}, null, 2));
if(failed.length) process.exit(1);
