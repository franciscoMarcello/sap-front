import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { NotaFiscalLoteComponent } from './nota-fiscal-lote.component';
import { NotaFiscalLoteStorageService } from '../../../sap/service/fiscal/nota-fiscal-lote-storage.service';
import { NotaFiscalLote } from '../../../sap/model/fiscal/nota-fiscal-lote';
import { NotaFiscalLoteService } from '../../../sap/service/fiscal/nota-fiscal-lote.service';
import { Page } from '../../../sap/model/page.model';
import { BusinessPartnerDefinition } from '../../../sap/model/business-partner/business-partner-definition';

describe('NotaFiscalLoteComponent', () => {

  const CHAVE = NotaFiscalLoteStorageService.CHAVE;
  // O lote fica no sessionStorage e o ngOnInit o recarrega: sem limpar, um teste herdaria o
  // lote do anterior.
  beforeEach(() => sessionStorage.removeItem(CHAVE));
  afterEach(() => sessionStorage.removeItem(CHAVE));

  // Storage de verdade; auth e confirm falsos.
  function novoComponente(service: any, toastr: any, opcoes: { confirma?: boolean; usuario?: string; token?: any } = {}) {
    const alert = { confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: opcoes.confirma ?? true })) };
    // Token Keycloak por padrao; name igual para todo mundo de proposito: o lote nao separa por nome.
    const auth = { getDecodeToken: () => opcoes.token ?? ({ iss: 'https://sso', sub: opcoes.usuario ?? 'Fulano', name: 'Nome Igual' }) };
    return new NotaFiscalLoteComponent(service, toastr, alert as any, new NotaFiscalLoteStorageService(), auth as any);
  }

  function nota(docEntry: number, numero = docEntry + 500): NotaFiscalLote {
    return NotaFiscalLote.from({ docEntry, numero, serie: '2', data: '2026-09-30', total: 10 });
  }

  function pagina(notas: NotaFiscalLote[], totalElements = notas.length): Page<NotaFiscalLote> {
    return Object.assign(new Page<NotaFiscalLote>(), { content: notas, totalElements, size: notas.length });
  }

  // Sem TestBed, mesmo estilo do spec da cobranca: o que interessa e a selecao e o lote.
  function tela(paginas: { [pagina: number]: Page<NotaFiscalLote> }, todasDoFiltro?: Page<NotaFiscalLote>,
                opcoes: { confirma?: boolean; usuario?: string; token?: any } = {}) {
    const chamadas = { listar: [] as any[], baixar: [] as any[] };
    const service = {
      getDefinition: () => [],
      statusSefaz: () => of([{ id: 4, descricao: 'Autorizada' }]),
      listar: (filtro: any, page: number, size: number) => {
        chamadas.listar.push({ filtro, page, size });
        if (size === NotaFiscalLoteService.LIMITE_LOTE && todasDoFiltro) {
          return of(todasDoFiltro);
        }
        return of(paginas[page] ?? pagina([]));
      },
      baixar: (docEntries: number[], pdf: boolean, xml: boolean, boleto: boolean) => {
        chamadas.baixar.push({ docEntries, pdf, xml, boleto });
        return of({ arquivo: null, nome: 'notas.zip', notasComErro: 0, notasSemBoleto: boleto ? 1 : 0 });
      },
    } as any;
    const toastr = jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error', 'info']);
    const componente = novoComponente(service, toastr, opcoes);
    componente.ngOnInit();
    return { componente, chamadas, toastr };
  }

  it('abre com o mes corrente ate hoje e ja filtra', () => {
    const { componente, chamadas } = tela({ 0: pagina([nota(1)]) });
    expect(componente.dataInicial).toMatch(/^\d{4}-\d{2}-01$/);
    expect(chamadas.listar[0].filtro.dataInicial).toBe(componente.dataInicial);
    expect(chamadas.listar[0].filtro.dataFinal).toBe(componente.dataFinal);
    expect(componente.notas.length).toBe(1);
  });

  it('selecao sobrevive a troca de pagina', () => {
    const { componente } = tela({ 0: pagina([nota(1), nota(2)], 4), 1: pagina([nota(3), nota(4)], 4) });
    componente.action({ type: 'nota-lote-toggle-selecao', data: componente.notas[0] } as any);
    componente.carregarPagina(1);
    componente.alternarSelecaoDaPagina();
    expect(componente.quantidadeSelecionada).toBe(3);

    componente.carregarPagina(0);
    expect(componente.notas.map((n) => n.selecionado)).toEqual([true, false]);
  });

  it('filtrar e limpar os filtros mantem o lote, e a nota achada de novo aparece marcada', () => {
    const { componente } = tela({ 0: pagina([nota(1)]) });
    componente.alternarSelecaoDaPagina();
    componente.filtroStatusSap = 'CANCELADO';
    componente.filtrar();
    componente.limparFiltros();
    expect(componente.quantidadeSelecionada).toBe(1);
    expect(componente.notas[0].selecionado).toBeTrue();
  });

  it('selecionar todas do filtro marca tambem as notas fora da pagina', () => {
    const { componente } = tela({ 0: pagina([nota(1), nota(2)], 3) }, pagina([nota(1), nota(2), nota(3)]));
    componente.adicionarTodasDoFiltro();
    expect(componente.quantidadeSelecionada).toBe(3);
    expect(componente.todasDaPaginaSelecionadas).toBeTrue();
  });

  it('filtro acima do teto nao seleciona nada e avisa', () => {
    const { componente, chamadas, toastr } = tela({ 0: pagina([nota(1)], NotaFiscalLoteService.LIMITE_LOTE + 1) });
    componente.adicionarTodasDoFiltro();
    expect(componente.quantidadeSelecionada).toBe(0);
    expect(chamadas.listar.length).toBe(1);
    expect(toastr.warning).toHaveBeenCalled();
  });

  it('baixa os docEntries selecionados com os tipos marcados', () => {
    const { componente, chamadas, toastr } = tela({ 0: pagina([nota(1), nota(2)]) });
    componente.alternarSelecaoDaPagina();
    componente.baixarPdf = false;
    componente.baixar();
    expect(chamadas.baixar).toEqual([{ docEntries: [1, 2], pdf: false, xml: true, boleto: false }]);
    expect(toastr.success).toHaveBeenCalled();
  });

  it('boleto vai no pedido e nota sem boleto vira aviso, nao erro', () => {
    const { componente, chamadas, toastr } = tela({ 0: pagina([nota(1)]) });
    componente.alternarSelecaoDaPagina();
    componente.baixarPdf = false;
    componente.baixarXml = false;
    componente.baixarBoleto = true;
    componente.baixar();
    expect(chamadas.baixar).toEqual([{ docEntries: [1], pdf: false, xml: false, boleto: true }]);
    expect(toastr.info).toHaveBeenCalled();
    expect(toastr.warning).not.toHaveBeenCalled();
  });

  it('boleto vem desmarcado', () => {
    const { componente } = tela({ 0: pagina([]) });
    expect(componente.baixarBoleto).toBeFalse();
  });

  it('nao baixa sem selecao nem sem tipo de arquivo', () => {
    const { componente, chamadas } = tela({ 0: pagina([nota(1)]) });
    componente.baixar();
    componente.alternarSelecaoDaPagina();
    componente.baixarPdf = false;
    componente.baixarXml = false;
    componente.baixar();
    expect(chamadas.baixar.length).toBe(0);
  });

  it('carrega os status SEFAZ da TaxPlus para o filtro', () => {
    const { componente } = tela({ 0: pagina([]) });
    expect(componente.statusSefazOpcoes).toEqual([{ id: 4, descricao: 'Autorizada' }]);
  });

  it('manda os filtros de status SAP e SEFAZ e o limpar zera os dois', () => {
    const { componente, chamadas } = tela({ 0: pagina([]) });
    componente.filtroStatusSap = 'CANCELADO';
    componente.filtroStatusSefaz = '4';
    componente.filtrar();
    expect(chamadas.listar[1].filtro.statusSap).toBe('CANCELADO');
    expect(chamadas.listar[1].filtro.statusSefaz).toBe(4);

    componente.limparFiltros();
    expect(chamadas.listar[2].filtro.statusSap).toBeNull();
    expect(chamadas.listar[2].filtro.statusSefaz).toBeNull();
  });

  it('mostra status SAP e SEFAZ legiveis', () => {
    const n = NotaFiscalLote.from({ docEntry: 1, statusSap: 'CANCELADO', statusSefaz: 'Autorizada', statusSefazId: 4 });
    expect(n.statusSapLabel).toBe('Cancelado');
    expect(n.statusSefazLabel).toBe('Autorizada');
    expect(NotaFiscalLote.from({ docEntry: 1, statusSefazId: 99 }).statusSefazLabel).toBe('Status 99');
  });

  it('manda vencimento e o limpar zera', () => {
    const { componente, chamadas } = tela({ 0: pagina([]) });
    componente.vencimentoDe = '2026-10-01';
    componente.vencimentoAte = '2026-10-31';
    componente.filtrar();
    expect([chamadas.listar[1].filtro.vencimentoDe, chamadas.listar[1].filtro.vencimentoAte]).toEqual(['2026-10-01', '2026-10-31']);

    componente.limparFiltros();
    const limpo = chamadas.listar[2].filtro;
    expect([limpo.numeroDe, limpo.numeroAte, limpo.vencimentoDe, limpo.vencimentoAte]).toEqual([null, null, null, null]);
  });

  it('periodo invertido avisa e nao consulta', () => {
    const { componente, chamadas, toastr } = tela({ 0: pagina([]) });
    componente.vencimentoDe = '2026-10-31';
    componente.vencimentoAte = '2026-10-01';
    componente.filtrar();
    componente.vencimentoDe = '';
    componente.dataInicial = '2026-09-30';
    componente.dataFinal = '2026-09-01';
    componente.filtrar();
    expect(chamadas.listar.length).toBe(1);
    expect(toastr.warning).toHaveBeenCalledTimes(2);
  });

  describe('Nº da NF', () => {
    it('busca a NF como faixa de um numero so e sem as datas', () => {
      const { componente, chamadas } = tela({ 0: pagina([]) });
      componente.vencimentoDe = '2026-10-01';
      componente.numeroNf = '5815';
      componente.filtrar();
      const filtro = chamadas.listar[1].filtro;
      expect([filtro.numeroDe, filtro.numeroAte]).toEqual([5815, 5815]);
      expect([filtro.dataInicial, filtro.dataFinal, filtro.vencimentoDe, filtro.vencimentoAte]).toEqual([null, null, null, null]);
      expect(componente.filtrandoPorNf).toBeTrue();
    });

    it('os outros filtros continuam valendo junto com a NF', () => {
      const { componente, chamadas } = tela({ 0: pagina([]) });
      componente.filtroStatusSefaz = '4';
      componente.numeroNf = '5815';
      componente.filtrar();
      expect(chamadas.listar[1].filtro.statusSefaz).toBe(4);
    });

    it('com NF, periodo invertido nas datas nao barra a busca', () => {
      const { componente, chamadas } = tela({ 0: pagina([]) });
      componente.dataInicial = '2026-09-30';
      componente.dataFinal = '2026-09-01';
      componente.numeroNf = '5815';
      componente.filtrar();
      expect(chamadas.listar.length).toBe(2);
    });

    it('apagar a NF volta a filtrar pelas datas que estavam na tela', () => {
      const { componente, chamadas } = tela({ 0: pagina([]) });
      componente.numeroNf = '5815';
      componente.filtrar();
      componente.numeroNf = '';
      componente.filtrar();
      expect(chamadas.listar[2].filtro.dataInicial).toBe(componente.dataInicial);
      expect(chamadas.listar[2].filtro.numeroDe).toBeNull();
    });

    it('NF que nao e inteiro positivo avisa e nao consulta - inclusive texto incompleto', () => {
      const { componente, chamadas, toastr } = tela({ 0: pagina([]) });
      ['0', '-3', '1.5', 'e', '12a'].forEach((valor) => {
        componente.numeroNf = valor;
        componente.filtrar();
      });
      expect(chamadas.listar.length).toBe(1);
      expect(toastr.warning).toHaveBeenCalledTimes(5);
    });

    it('espaco em volta da NF nao atrapalha e campo so com espaco e vazio', () => {
      const { componente, chamadas } = tela({ 0: pagina([]) });
      componente.numeroNf = ' 5815 ';
      componente.filtrar();
      expect(chamadas.listar[1].filtro.numeroDe).toBe(5815);
      componente.numeroNf = '   ';
      componente.filtrar();
      expect(chamadas.listar[2].filtro.numeroDe).toBeNull();
      expect(chamadas.listar[2].filtro.dataInicial).toBe(componente.dataInicial);
    });
  });

  it('vencimento mostra a faixa quando ha varias parcelas', () => {
    const unica = NotaFiscalLote.from({ docEntry: 1, vencimentoInicial: '2026-10-22', vencimentoFinal: '2026-10-22', parcelas: 1 });
    const varias = NotaFiscalLote.from({ docEntry: 2, vencimentoInicial: '2026-10-22', vencimentoFinal: '2027-02-19', parcelas: 5 });
    expect(unica.vencimentoFormatado).toBe('22/10/2026');
    expect(varias.vencimentoFormatado).toBe('22/10/2026 a 19/02/2027 (5 parc.)');
  });

  // Service cujas respostas o teste solta na ordem que quiser.
  function telaAssincrona() {
    const pendentes: { filtro: any; page: number; size: number; resposta: Subject<Page<NotaFiscalLote>> }[] = [];
    const service = {
      getDefinition: () => [],
      statusSefaz: () => of([]),
      listar: (filtro: any, page: number, size: number) => {
        const resposta = new Subject<Page<NotaFiscalLote>>();
        pendentes.push({ filtro, page, size, resposta });
        return resposta;
      },
    } as any;
    const toastr = jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error', 'info']);
    const componente = novoComponente(service, toastr);
    componente.ngOnInit();
    const responde = (i: number, p: Page<NotaFiscalLote>) => { pendentes[i].resposta.next(p); pendentes[i].resposta.complete(); };
    return { componente, pendentes, responde, toastr };
  }

  it('resposta de um filtro antigo chegando por ultimo nao sobrescreve a lista', () => {
    const { componente, responde } = telaAssincrona();
    componente.filtroStatusSap = 'CANCELADO';
    componente.filtrar();
    responde(1, pagina([nota(2)]));
    expect(componente.loading).toBeFalse();
    responde(0, pagina([nota(1)]));
    expect(componente.notas.map((n) => n.docEntry)).toEqual([2]);
  });

  it('consulta nova mantem o loading ate a propria resposta', () => {
    const { componente, responde } = telaAssincrona();
    componente.filtrar();
    responde(0, pagina([nota(1)]));
    expect(componente.loading).toBeTrue();
    responde(1, pagina([nota(2)]));
    expect(componente.loading).toBeFalse();
  });

  it('adicionar todas pendente nao volta depois de limpar o lote', fakeAsync(() => {
    const { componente, responde } = telaAssincrona();
    responde(0, pagina([nota(1), nota(2)], 2));
    componente.action({ type: 'nota-lote-toggle-selecao', data: componente.notas[0] } as any);
    componente.adicionarTodasDoFiltro();
    componente.limparLote();
    flushMicrotasks();
    responde(1, pagina([nota(1), nota(2)]));
    expect(componente.quantidadeSelecionada).toBe(0);
  }));

  it('adicionar todas pendente cai ao filtrar, mas o lote fica', () => {
    const { componente, pendentes, responde } = telaAssincrona();
    responde(0, pagina([nota(1)], 1));
    componente.action({ type: 'nota-lote-toggle-selecao', data: componente.notas[0] } as any);
    componente.adicionarTodasDoFiltro();
    componente.filtrar();
    responde(1, pagina([nota(1), nota(5)]));
    expect(componente.quantidadeSelecionada).toBe(1);
    expect(pendentes.length).toBe(3);
  });

  it('paginar usa o filtro aplicado, nao o que foi digitado sem Filtrar', () => {
    const { componente, chamadas } = tela({ 0: pagina([nota(1)], 60), 1: pagina([nota(2)], 60) });
    componente.numeroNf = '900';
    componente.carregarPagina(1);
    expect(chamadas.listar[1].filtro.numeroDe).toBeNull();
  });

  it('selecionar todas confere o total da propria resposta', () => {
    const { componente, toastr } = tela({ 0: pagina([nota(1)], 3) },
      pagina([nota(1), nota(2)], NotaFiscalLoteService.LIMITE_LOTE + 5));
    componente.adicionarTodasDoFiltro();
    expect(componente.quantidadeSelecionada).toBe(0);
    expect(toastr.warning).toHaveBeenCalled();
  });

  it('busca de cliente vai pela rota do lote', () => {
    const buscar = jasmine.createSpy('buscarClientes').and.returnValue(of(new Page()));
    const service = { getDefinition: () => [], statusSefaz: () => of([]), listar: () => of(pagina([])), buscarClientes: buscar } as any;
    const componente = novoComponente(service, jasmine.createSpyObj('ToastrService', ['warning']));
    componente.buscaCliente.search('mauro');
    expect(buscar).toHaveBeenCalledWith('mauro');
  });

  it('sair da tela no meio do download cancela e nao avisa depois', () => {
    const resposta = new Subject<any>();
    const toastr = jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error', 'info']);
    const service = {
      getDefinition: () => [], statusSefaz: () => of([]), listar: () => of(pagina([nota(1)])),
      baixar: () => resposta,
    } as any;
    const componente = novoComponente(service, toastr);
    componente.ngOnInit();
    componente.alternarSelecaoDaPagina();
    componente.baixar();
    componente.ngOnDestroy();
    resposta.next({ arquivo: null, nome: 'notas.zip', notasComErro: 0, notasSemBoleto: 0 });
    expect(toastr.success).not.toHaveBeenCalled();
    expect(resposta.observed).toBeFalse();
  });

  it('colunas da busca de cliente escapam o texto do cadastro', () => {
    const colunas = new BusinessPartnerDefinition().getDefinition();
    ['CardCode', 'CardName', 'CpfCnpjStr'].forEach((propriedade) =>
      expect(colunas.find((c) => c.property === propriedade)?.html).toBe('{{value}}'));
  });

  describe('lote montado a mao', () => {

    function marcar(componente: NotaFiscalLoteComponent, docEntry: number) {
      componente.action({ type: 'nota-lote-toggle-selecao', data: componente.notas.find((n) => n.docEntry === docEntry) } as any);
    }

    it('marca, troca o filtro, marca outra e baixa as duas', () => {
      // pagina 0 muda conforme o filtro aplicado
      const chamadas = { baixar: [] as any[] };
      const service = {
        getDefinition: () => [], statusSefaz: () => of([]),
        listar: (filtro: any) => of(pagina(filtro.statusSap === 'CANCELADO' ? [nota(2)] : [nota(1)])),
        baixar: (docEntries: number[]) => { chamadas.baixar.push(docEntries); return of({ arquivo: null, nome: 'n.zip', notasComErro: 0, notasSemBoleto: 0 }); },
      } as any;
      const componente = novoComponente(service, jasmine.createSpyObj('ToastrService', ['warning', 'success', 'info']));
      componente.ngOnInit();
      marcar(componente, 1);
      componente.filtroStatusSap = 'CANCELADO';
      componente.filtrar();
      marcar(componente, 2);

      expect(componente.notasDoLote.map((n) => n.docEntry)).toEqual([1, 2]);
      componente.baixar();
      expect(chamadas.baixar).toEqual([[1, 2]]);
    });

    it('o X tira a nota do lote e desmarca a linha, mesmo sendo outro objeto', () => {
      // objetos novos a cada busca, como vem do HTTP
      const service = { getDefinition: () => [], statusSefaz: () => of([]), listar: () => of(pagina([nota(1), nota(2)])) } as any;
      const componente = novoComponente(service, jasmine.createSpyObj('ToastrService', ['warning']));
      componente.ngOnInit();
      componente.alternarSelecaoDaPagina();
      const antes = componente.notas[0];
      componente.filtrar();
      expect(componente.notas[0]).not.toBe(antes);
      componente.remover(1);
      expect(componente.notasDoLote.map((n) => n.docEntry)).toEqual([2]);
      expect(componente.notas.map((n) => n.selecionado)).toEqual([false, true]);
    });

    it('durante o download o lote nao muda', () => {
      const resposta = new Subject<any>();
      const toastr = jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error', 'info']);
      const service = {
        getDefinition: () => [], statusSefaz: () => of([]), listar: () => of(pagina([nota(1), nota(2)])),
        baixar: () => resposta,
      } as any;
      const componente = novoComponente(service, toastr);
      componente.ngOnInit();
      marcar(componente, 1);
      componente.baixar();

      marcar(componente, 2);
      componente.remover(1);
      componente.alternarSelecaoDaPagina();
      expect(componente.notasDoLote.map((n) => n.docEntry)).toEqual([1]);
      expect(toastr.info).toHaveBeenCalled();

      resposta.next({ arquivo: null, nome: 'n.zip', notasComErro: 0, notasSemBoleto: 0 });
      resposta.complete();
      marcar(componente, 2);
      expect(componente.notasDoLote.map((n) => n.docEntry)).toEqual([1, 2]);
    });

    it('soma o total das notas do lote', () => {
      const { componente } = tela({ 0: pagina([nota(1), nota(2)]) });
      componente.alternarSelecaoDaPagina();
      expect(componente.totalDoLote).toBe(20);
    });

    it('adicionar todas soma ao que ja estava no lote', () => {
      const { componente } = tela({ 0: pagina([nota(1)], 2) }, pagina([nota(2), nota(3)]));
      marcar(componente, 1);
      componente.adicionarTodasDoFiltro();
      expect(componente.notasDoLote.map((n) => n.docEntry)).toEqual([1, 2, 3]);
    });

    describe('limpar lote', () => {
      it('confirmado esvazia e tira do storage', fakeAsync(() => {
        const { componente } = tela({ 0: pagina([nota(1)]) });
        componente.alternarSelecaoDaPagina();
        expect(sessionStorage.getItem(CHAVE)).not.toBeNull();
        componente.limparLote();
        flushMicrotasks();
        expect(componente.quantidadeSelecionada).toBe(0);
        expect(componente.notas[0].selecionado).toBeFalse();
        expect(sessionStorage.getItem(CHAVE)).toBeNull();
      }));

      it('cancelado mantem o lote', fakeAsync(() => {
        const { componente } = tela({ 0: pagina([nota(1)]) }, undefined, { confirma: false });
        componente.alternarSelecaoDaPagina();
        componente.limparLote();
        flushMicrotasks();
        expect(componente.quantidadeSelecionada).toBe(1);
      }));
    });

    describe('teto de ' + NotaFiscalLoteService.LIMITE_LOTE, () => {
      const limite = NotaFiscalLoteService.LIMITE_LOTE;
      const muitas = (inicio: number, n: number) => Array.from({ length: n }, (_, i) => nota(inicio + i));

      it('marcar a pagina que passaria do teto nao adiciona nada e avisa', () => {
        const { componente, toastr } = tela({ 0: pagina(muitas(1, limite - 1)), 1: pagina(muitas(1000, 2)) });
        componente.alternarSelecaoDaPagina();
        componente.carregarPagina(1);
        componente.alternarSelecaoDaPagina();
        expect(componente.quantidadeSelecionada).toBe(limite - 1);
        expect(toastr.warning).toHaveBeenCalled();
      });

      it('com o lote cheio a linha nao entra', () => {
        const { componente } = tela({ 0: pagina(muitas(1, limite)), 1: pagina([nota(5000)]) });
        componente.alternarSelecaoDaPagina();
        componente.carregarPagina(1);
        marcar(componente, 5000);
        expect(componente.quantidadeSelecionada).toBe(limite);
      });

      it('adicionar todas que passaria do teto nao adiciona nada', () => {
        const { componente } = tela({ 0: pagina(muitas(1, limite - 1), limite - 1) }, pagina(muitas(5000, 2)));
        componente.alternarSelecaoDaPagina();
        componente.adicionarTodasDoFiltro();
        expect(componente.quantidadeSelecionada).toBe(limite - 1);
      });

    });

    describe('guardado na aba', () => {
      it('salva so os dados da nota e um componente novo recarrega o lote', () => {
        const { componente } = tela({ 0: pagina([nota(1), nota(2)]) });
        componente.alternarSelecaoDaPagina();
        const salvo = JSON.parse(sessionStorage.getItem(CHAVE)!);
        expect(salvo.v).toBe(1);
        expect(salvo.usuario).toBe('kc:Fulano');
        expect(Object.keys(salvo.notas[0])).not.toContain('selecionado');

        const outro = tela({ 0: pagina([]) }).componente;
        expect(outro.notasDoLote.map((n) => n.docEntry)).toEqual([1, 2]);
        expect(outro.notasDoLote[0].notaFormatada).toBe('501 / 2');
      });

      it('nao serializa o FormControl que a tabela pendura na linha', () => {
        const { componente } = tela({ 0: pagina([nota(1)]) });
        const circular: any = {}; circular.eu = circular;
        (componente.notas[0] as any).formControlFactorynotaFormatada = circular;
        componente.alternarSelecaoDaPagina();
        expect(JSON.parse(sessionStorage.getItem(CHAVE)!).notas.length).toBe(1);
      });

      it('lote de outro usuario, versao desconhecida, JSON quebrado ou docEntry invalido sao ignorados', () => {
        const casos = [
          JSON.stringify({ v: 1, usuario: 'kc:Outro', notas: [{ docEntry: 1 }] }),
          JSON.stringify({ v: 2, usuario: 'kc:Fulano', notas: [{ docEntry: 1 }] }),
          '{quebrado',
          JSON.stringify({ v: 1, usuario: 'kc:Fulano', notas: [{ docEntry: 'x' }, { docEntry: -1 }, { docEntry: 7 }, { docEntry: 7 }] }),
        ];
        const lotes = casos.map((salvo) => {
          sessionStorage.setItem(CHAVE, salvo);
          return tela({ 0: pagina([]) }).componente.notasDoLote.map((n) => n.docEntry);
        });
        expect(lotes).toEqual([[], [], [], [7]]);
      });

      it('Keycloak: separa pelo sub, e renovar o token (jti novo) mantem o lote', () => {
        const kc = (sub: string, jti: string) => ({ iss: 'https://sso', sub, jti, name: 'Nome Igual' });
        const { componente } = tela({ 0: pagina([nota(1)]) }, undefined, { token: kc('sub-a', 'jti-1') });
        componente.alternarSelecaoDaPagina();
        expect(tela({ 0: pagina([]) }, undefined, { token: kc('sub-a', 'jti-2') }).componente.quantidadeSelecionada).toBe(1);
        expect(tela({ 0: pagina([]) }, undefined, { token: kc('sub-b', 'jti-1') }).componente.quantidadeSelecionada).toBe(0);
      });

      it('token interno: sub e o nome, entao separa pelo id da conta (jti) e pela origem', () => {
        // JwtHandler do backend: id(user.id), subject(user.name)
        const interno = (jti: string, origin: string) => ({ sub: 'Joao da Silva', jti, origin, username: 'joao' });
        const { componente } = tela({ 0: pagina([nota(1)]) }, undefined, { token: interno('60', 'SalePerson') });
        componente.alternarSelecaoDaPagina();
        expect(tela({ 0: pagina([]) }, undefined, { token: interno('60', 'SalePerson') }).componente.quantidadeSelecionada).toBe(1);
        expect(tela({ 0: pagina([]) }, undefined, { token: interno('61', 'SalePerson') }).componente.quantidadeSelecionada).toBe(0);
        expect(tela({ 0: pagina([]) }, undefined, { token: interno('60', 'BusinessPartner') }).componente.quantidadeSelecionada).toBe(0);
      });

      it('storage que lanca nao quebra a tela', () => {
        spyOn(Storage.prototype, 'getItem').and.throwError('SecurityError');
        spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
        const { componente } = tela({ 0: pagina([nota(1)]) });
        componente.alternarSelecaoDaPagina();
        expect(componente.quantidadeSelecionada).toBe(1);
      });
    });

  });

  it('formata nota sem numero pelo documento', () => {
    expect(NotaFiscalLote.from({ docEntry: 9, docNum: 77 }).notaFormatada).toBe('Doc. 77');
    expect(nota(1, 501).notaFormatada).toBe('501 / 2');
    expect(nota(1).dataFormatada).toBe('30/09/2026');
  });
});
