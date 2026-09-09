import { of } from 'rxjs';
import { ItemSearchComponent } from './item.component';
import { Page } from '../../../model/page.model';

/**
 * A filial da busca de produtos vinha congelada: o ItemServiceBanch e montado uma vez no
 * ngOnInit, e copiar o branchId ali fazia toda busca seguinte usar a filial do primeiro render.
 * Na tela, trocar de filial continuava buscando na antiga e a busca parava de voltar resultado.
 */
describe('ItemSearchComponent - filial da busca', () => {

  let component: ItemSearchComponent;
  let filiaisUsadas: Array<any>;

  beforeEach(() => {
    filiaisUsadas = [];
    const itemService = {
      search: (keyword, branchId) => {
        filiaisUsadas.push(branchId);
        return of(new Page());
      }
    } as any;
    component = new ItemSearchComponent(itemService);
    component.search = { clear: () => {} } as any;
  });

  it('usa a filial vigente no momento da busca, nao a do ngOnInit', () => {
    component.branchId = 2;
    component.ngOnInit();

    component.service.search('OX');
    component.branchId = 6;
    component.service.search('OX');

    expect(filiaisUsadas).toEqual([2, 6]);
  });

  it('acompanha a troca de filial mesmo sem recriar o componente', () => {
    component.branchId = 11;
    component.ngOnInit();
    component.branchId = 17;

    component.service.search('BOV');

    expect(filiaisUsadas).toEqual([17]);
  });
});
