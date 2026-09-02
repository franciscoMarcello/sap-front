import { Subject, of, throwError } from 'rxjs';
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
  /**
   * Duas buscas em voo disputavam o mesmo resultadoBusca. A resposta atrasada da PRIMEIRA chegava
   * depois de a segunda ter limpado a lista, entrava como unico resultado e disparava a selecao
   * automatica - escolhendo o registro da consulta errada.
   */
  it('descarta resposta atrasada de uma busca ja superada', () => {
    const primeira = new Subject<Page<any>>();
    const segunda = new Subject<Page<any>>();
    const respostas = [primeira, segunda];
    component.service = { search: () => respostas.shift()!.asObservable() } as any;

    component.searchService('MAURO');
    component.searchService('FRISACRE');

    //a primeira responde DEPOIS da segunda ter comecado
    primeira.next(pagina([{ CardCode: 'CLI-ERRADO' }]));

    expect(selecionados).toEqual([]);
    expect(component.resultadoBusca.content).toEqual([]);
  });

  it('a resposta da busca vigente continua valendo', () => {
    const primeira = new Subject<Page<any>>();
    const segunda = new Subject<Page<any>>();
    const respostas = [primeira, segunda];
    component.service = { search: () => respostas.shift()!.asObservable() } as any;

    component.searchService('MAURO');
    component.searchService('FRISACRE');

    primeira.next(pagina([{ CardCode: 'CLI-ERRADO' }]));
    segunda.next(pagina([{ CardCode: 'CLI-CERTO' }]));

    expect(selecionados).toEqual([{ CardCode: 'CLI-CERTO' }]);
  });

  /** Pagina que chega depois de uma busca nova pertence a consulta antiga. */
  it('descarta pagina atrasada quando uma busca nova comecou', () => {
    const pagina2 = new Subject<Page<any>>();
    const buscaNova = new Subject<Page<any>>();
    const respostas = [pagina2, buscaNova];
    component.service = { search: () => respostas.shift()!.asObservable() } as any;

    component.changePageService('OX');
    component.searchService('BOV');

    pagina2.next(pagina([{ ItemCode: 'ANTIGO' }]));

    expect(component.resultadoBusca.content).toEqual([]);
  });

  it('busca que falha nao deixa o loading ligado', () => {
    component.service = { search: () => throwError(() => new Error('rede')) } as any;

    component.searchService('OX');

    expect(component.loading).toBeFalse();
  });

  it('nao seleciona ao trocar de pagina, mesmo com um item na pagina', () => {
    comResultado(pagina([{ ItemCode: 'ULTIMO' }]));

    component.changePageService('OX');

    expect(selecionados).toEqual([]);
  });
});
