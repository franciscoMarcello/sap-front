import { of, throwError } from 'rxjs';
import { DocumentStatementComponent } from './documento.statement.component';

/**
 * O valor do frete na tela nao pode sobreviver a uma mudanca no pedido. Antes, durante o
 * recalculo o campo seguia exibindo o valor anterior como se fosse o vigente - e se a chamada
 * falhasse ou nunca voltasse, um numero irreal ficava travado na tela e entrava no total.
 */
describe('DocumentStatementComponent - frete confiavel na tela', () => {

  let component: DocumentStatementComponent;
  let regiaoService: any;

  function item(quantidade : number) {
    return { quantidade, unitPriceLiquid: () => 10, PriceList: 1, GroupNum: 1 } as any;
  }

  function regiaoQueCalcula(total : number) {
    return [{ ativa: true, U_Filial: 2, calcularFrete: () => ({ total }) }];
  }

  beforeEach(() => {
    regiaoService = { getByLocalidade: () => of(regiaoQueCalcula(500)) };
    component = new DocumentStatementComponent(
      {} as any, {} as any, {} as any, regiaoService,
      { get: () => of({ Code: '20', Name: 'MANICORE' }) } as any,
      { tipoOperacao: [] } as any, {} as any, {} as any,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      { backendOnline: true, hasValidCatalog: false } as any,
      {} as any, {} as any);
    component.ngOnInit();

    component.tipoEnvio = 'ent';
    component.branchId = 2;
    component.businesPartner = { CardCode: 'CLI001' } as any;
    component.enderecoEntrega = { AddressName: 'ENTREGA', U_Localidade: 20 } as any;
    component.itens = [item(10)];
  });

  /** Estado inicial: nada calculado ainda, entao nao ha valor para mostrar. */
  it('nasce sem frete confirmado', () => {
    expect(component.freteCalculado).toBeFalse();
  });

  it('invalida o valor assim que um recalculo comeca', () => {
    component.changeItens([item(10)]);
    expect(component.freteCalculado).toBeFalse();
  });

  it('zera o frete quando o pedido fica sem itens, em vez de manter o valor antigo', () => {
    component.changeItens([]);

    expect(component.frete).toEqual(0);
    expect(component.freteCalculado).toBeTrue();
  });

  it('zera o frete ao voltar para retirada', () => {
    component.tipoEnvio = 'ret';
    component.changeItens([item(10)]);

    expect(component.frete).toEqual(0);
    expect(component.freteCalculado).toBeTrue();
  });

  it('nao soma frete nao confirmado no total', () => {
    component.frete = 500;
    component.freteCalculado = false;

    expect(component.total()).toEqual(100);
  });

  it('soma o frete no total depois de confirmado', () => {
    component.frete = 500;
    component.freteCalculado = true;

    expect(component.total()).toEqual(600);
  });

  /**
   * O pedido e quebrado em um documento por condicao de pagamento. Antes cada documento levava o
   * frete CHEIO - o cliente era cobrado duas vezes quando havia duas condicoes.
   */
  it('rateia o frete entre os documentos, sem duplicar', () => {
    component.frete = 300;
    component.freteCalculado = true;
    component.itens = [
      { ...item(10), GroupNum: 'A' } as any,
      { ...item(20), GroupNum: 'B' } as any,
    ];

    const fretes = (component as any).rateiaFrete(component.agruparPorGroupNum());

    expect(fretes).toEqual([100, 200]);
    expect(fretes.reduce((a, b) => a + b, 0)).toEqual(300);
  });

  /** A sobra de centavos vai para o primeiro, para a soma fechar com o frete calculado. */
  it('sobra de centavos nao some no rateio', () => {
    component.frete = 100;
    component.freteCalculado = true;
    component.itens = [
      { ...item(1), GroupNum: 'A' } as any,
      { ...item(1), GroupNum: 'B' } as any,
      { ...item(1), GroupNum: 'C' } as any,
    ];

    const fretes = (component as any).rateiaFrete(component.agruparPorGroupNum());

    expect(fretes.reduce((a, b) => a + b, 0)).toEqual(100);
  });

  it('nao rateia frete nao confirmado', () => {
    component.frete = 300;
    component.freteCalculado = false;
    component.itens = [{ ...item(10), GroupNum: 'A' } as any];

    expect((component as any).rateiaFrete(component.agruparPorGroupNum())).toEqual([0]);
  });

  /** Falha na busca da regiao tem que virar zero + erro, nunca deixar o valor anterior. */
  it('nao mantem o valor anterior quando a busca de regiao falha', (done) => {
    component.frete = 500;
    component.freteCalculado = true;
    regiaoService.getByLocalidade = () => throwError(() => new Error('rede'));

    component.changeItens([item(10)]);

    setTimeout(() => {
      expect(component.frete).toEqual(0);
      expect(component.freteErro).toBeTruthy();
      done();
    }, 500);
  });
});
