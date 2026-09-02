import { of } from 'rxjs';
import { SearchComponent } from './search.component';
import { Page } from '../../../sap/model/page.model';

/**
 * Por padrao, uma busca que retorna um resultado seleciona sozinha. O comportamento pode ser
 * desativado nas telas em que o usuario ainda precisa consultar os dados desse resultado.
 */
describe('SearchComponent - selecao automatica de resultado unico', () => {

  let component: SearchComponent<any>;
  let selecionados: Array<any>;

  function pagina(content: Array<any>, nextLink: string = undefined): Page<any> {
    const page = new Page<any>();
    page.content = content;
    page.nextLink = nextLink;
    return page;
  }

  beforeEach(() => {
    selecionados = [];
    component = new SearchComponent<any>();
    component.modalSelect = {
      selecionaUnico: (item) => selecionados.push(item),
      clear: () => {}
    } as any;
  });

  function comResultado(page: Page<any>) {
    component.service = { search: () => of(page) } as any;
  }

  it('seleciona sozinho quando a busca retorna um item', () => {
    comResultado(pagina([{ ItemCode: 'PAC0000069' }]));

    component.searchService('OX BEEF');

    expect(selecionados).toEqual([{ ItemCode: 'PAC0000069' }]);
  });

  it('mantem o resultado unico aberto quando a selecao automatica esta desativada', () => {
    component.autoSelectSingleResult = false;
    comResultado(pagina([{ ItemCode: 'PAC0000069' }]));

    component.searchService('OX BEEF');

    expect(selecionados).toEqual([]);
    expect(component.resultadoBusca.content).toEqual([{ ItemCode: 'PAC0000069' }]);
  });

  it('nao seleciona nada quando a busca retorna mais de um item', () => {
    comResultado(pagina([{ ItemCode: 'A' }, { ItemCode: 'B' }]));

    component.searchService('OX');

    expect(selecionados).toEqual([]);
  });

  it('nao seleciona nada quando a busca nao retorna resultado', () => {
    comResultado(pagina([]));

    component.searchService('NAO EXISTE');

    expect(selecionados).toEqual([]);
  });

  /** Item unico na tela mas com proxima pagina nao e resultado unico da busca. */
  it('nao seleciona quando ainda ha proxima pagina', () => {
    comResultado(pagina([{ ItemCode: 'A' }], 'proxima-pagina'));

    component.searchService('OX');

    expect(selecionados).toEqual([]);
  });

  /**
   * Paginando, a ultima pagina pode vir com um item so - nao e disso que se trata, e selecionar
   * ali trocaria a escolha do usuario no meio da navegacao.
   */
  it('nao seleciona ao trocar de pagina, mesmo com um item na pagina', () => {
    comResultado(pagina([{ ItemCode: 'ULTIMO' }]));

    component.changePageService('OX');

    expect(selecionados).toEqual([]);
  });
});
