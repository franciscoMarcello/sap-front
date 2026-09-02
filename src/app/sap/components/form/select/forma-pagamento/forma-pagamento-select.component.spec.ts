import { SimpleChange } from '@angular/core';
import { Subject, of } from 'rxjs';
import { FormaPagamentoSelectComponent } from './forma-pagamento-select.component';

describe('FormaPagamentoSelectComponent', () => {
  function change(previousValue: any, currentValue: any, firstChange = false): SimpleChange {
    return new SimpleChange(previousValue, currentValue, firstChange);
  }

  it('nao recarrega nem reinicia quando somente a forma selecionada muda', () => {
    const service = jasmine.createSpyObj('FormaPagamentoService', ['getCondicoes']);
    const component = new FormaPagamentoSelectComponent(service);
    component.selected = 'PIX';

    component.ngOnChanges({ selected: change(null, 'PIX') });

    expect(service.getCondicoes).not.toHaveBeenCalled();
    expect(component.selected).toBe('PIX');
  });

  it('preserva a forma selecionada quando ela existe nas opcoes recarregadas', () => {
    const service = jasmine.createSpyObj('FormaPagamentoService', ['getCondicoes']);
    service.getCondicoes.and.returnValue(of([
      { PayMethCod: 'PIX', Description: 'PIX' },
      { PayMethCod: 'BOLETO', Description: 'Boleto' },
    ]));
    const component = new FormaPagamentoSelectComponent(service);
    const emitted: any[] = [];
    component.selectedOut.subscribe(value => emitted.push(value));
    component.idFilial = 2;
    component.cardCode = 'CLI001';
    component.selected = 'PIX';

    component.ngOnChanges({
      idFilial: change(null, 2, true),
      cardCode: change(null, 'CLI001', true),
      selected: change(null, 'PIX', true),
    });

    expect(service.getCondicoes).toHaveBeenCalledTimes(1);
    expect(component.selected).toBe('PIX');
    expect(emitted).toEqual([]);
  });

  it('limpa e avisa o formulario quando a forma nao pertence ao novo cliente', () => {
    const service = jasmine.createSpyObj('FormaPagamentoService', ['getCondicoes']);
    service.getCondicoes.and.returnValue(of([
      { PayMethCod: 'BOLETO', Description: 'Boleto' },
    ]));
    const component = new FormaPagamentoSelectComponent(service);
    const emitted: any[] = [];
    component.selectedOut.subscribe(value => emitted.push(value));
    component.idFilial = 2;
    component.cardCode = 'CLI002';
    component.selected = 'PIX';

    component.ngOnChanges({ cardCode: change('CLI001', 'CLI002') });

    expect(component.selected).toBeNull();
    expect(emitted).toEqual([null]);
  });

  it('ignora resposta atrasada do cliente anterior', () => {
    const first = new Subject<any[]>();
    const second = new Subject<any[]>();
    const service = jasmine.createSpyObj('FormaPagamentoService', ['getCondicoes']);
    service.getCondicoes.and.returnValues(first, second);
    const component = new FormaPagamentoSelectComponent(service);
    component.idFilial = 2;
    component.cardCode = 'CLI001';
    component.ngOnChanges({ cardCode: change(null, 'CLI001', true) });

    component.cardCode = 'CLI002';
    component.ngOnChanges({ cardCode: change('CLI001', 'CLI002') });
    second.next([{ PayMethCod: 'PIX', Description: 'PIX atual' }]);
    first.next([{ PayMethCod: 'DINHEIRO', Description: 'Resposta antiga' }]);

    expect(component.opcoes.map(option => option.value)).toEqual(['PIX']);
  });
});
