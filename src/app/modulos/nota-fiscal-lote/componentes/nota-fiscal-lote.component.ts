import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { ActionReturn } from '../../../shared/components/action/action.model';
import { Column } from '../../../shared/components/table/column.model';
import { Branch } from '../../../sap/model/branch';
import { SalesPerson } from '../../../sap/model/sales-person/sales-person';
import { NotaFiscalLote, STATUS_SAP_NOTA, StatusSapNota, StatusSefaz } from '../../../sap/model/fiscal/nota-fiscal-lote';
import { NotaFiscalLoteFiltro, NotaFiscalLoteService } from '../../../sap/service/fiscal/nota-fiscal-lote.service';
import { NotaFiscalLoteStorageService } from '../../../sap/service/fiscal/nota-fiscal-lote-storage.service';
import { SearchService } from '../../../sap/service/search.service';
import { BusinessPartner } from '../../../sap/model/business-partner/business-partner';
import { AlertService } from '../../../shared/service/alert.service';
import { AuthService } from '../../../shared/service/auth.service';

@Component({
  selector: 'app-nota-fiscal-lote',
  templateUrl: './nota-fiscal-lote.component.html',
  styleUrls: ['./nota-fiscal-lote.component.scss'],
})
export class NotaFiscalLoteComponent implements OnInit, OnDestroy {

  readonly limite = NotaFiscalLoteService.LIMITE_LOTE;
  readonly tamanhoPagina = 50;

  definition: Column[] = [];
  notas: NotaFiscalLote[] = [];
  totalItens = 0;
  paginaAtual = 0;

  loading = false;
  selecionandoFiltro = false;
  baixando = false;

  dataInicial = '';
  dataFinal = '';
  vencimentoDe = '';
  vencimentoAte = '';
  // Uma NF so. Preenchida, as datas de emissao e vencimento nao filtram (ver filtro): achar uma
  // NF de outro mes nao pode depender de lembrar de limpar a emissao. Texto, nao type=number: la
  // um "e" ou "-" digitado chega como null e a busca sairia pelas datas sem aviso.
  numeroNf = '';
  filiaisSelecionadas: Branch[] = [];
  clienteSelecionado: any = null;
  vendedorSelecionado: SalesPerson | null = null;
  filtroStatusSap: StatusSapNota | '' = '';
  // ID da "ProcessStatus"; '' = todos. String porque o <select> devolve string.
  filtroStatusSefaz = '';

  readonly statusSapOpcoes = STATUS_SAP_NOTA;
  statusSefazOpcoes: StatusSefaz[] = [];

  baixarPdf = true;
  baixarXml = true;
  // Desmarcado por padrao: so parte das notas tem boleto (forma de pagamento) e cada um e mais
  // uma chamada a BankPlus por parcela.
  baixarBoleto = false;
  // Tipos do download em andamento, para o aviso nao mudar se alguem mexer nas caixas.
  boletoNoDownload = false;

  // Trocar o valor recria os componentes de busca do filtro (ver o ngFor no template).
  versaoFiltros = 0;

  // Busca de cliente do filtro pela rota do lote, sem o recorte de carteira do vendedor.
  readonly buscaCliente: SearchService<BusinessPartner> = { search: (palavra) => this.service.buscarClientes(palavra) };

  /**
   * O lote, montado a mao: por docEntry, na ordem em que entrou. Sobrevive a troca de pagina, de
   * filtro e ao Limpar dos filtros - o usuario marca uma nota, vai atras de outra com outros
   * filtros e marca de novo. So "Limpar lote" e o X de cada nota tiram algo. Fica guardado na aba
   * (NotaFiscalLoteStorageService).
   */
  private selecao = new Map<number, NotaFiscalLote>();

  // Copia do lote para o painel, refeita a cada mudanca (loteAlterado), e nao getter: o painel
  // redesenharia a lista a cada ciclo de deteccao.
  notasDoLote: NotaFiscalLote[] = [];
  totalDoLote = 0;
  quantidadeBaixando = 0;


  // Filtro da lista que esta na tela. Paginar e "selecionar todas" usam este, nao o que esta
  // digitado no formulario e ainda nao foi aplicado com Filtrar.
  private filtroAplicado: NotaFiscalLoteFiltro = {};

  // Consulta em andamento. Uma nova cancela a anterior: sem isso a resposta de um filtro antigo
  // chegando por ultimo sobrescrevia a lista e desligava o loading da consulta atual.
  private consultaLista?: Subscription;
  private consultaTodas?: Subscription;
  // Sair da tela no meio de um lote cancela o download: sem isso o zip ainda seria salvo e os
  // avisos apareceriam depois, em outra tela.
  private download?: Subscription;

  constructor(private service: NotaFiscalLoteService, private toastr: ToastrService,
              private alert: AlertService, private storage: NotaFiscalLoteStorageService,
              private auth: AuthService) {}

  ngOnDestroy(): void {
    this.consultaLista?.unsubscribe();
    this.consultaTodas?.unsubscribe();
    this.download?.unsubscribe();
  }

  ngOnInit(): void {
    this.definition = this.service.getDefinition();
    this.service.statusSefaz().subscribe((status) => (this.statusSefazOpcoes = status ?? []));
    this.carregarLote();
    this.definirPeriodoPadrao();
    this.filtrar();
  }

  get filtrandoPorNf(): boolean {
    return (this.numeroNf ?? '').trim() !== '';
  }

  private get numeroNfValido(): number | null {
    const texto = (this.numeroNf ?? '').trim();
    return /^\d+$/.test(texto) && Number(texto) > 0 ? Number(texto) : null;
  }

  get filtro(): NotaFiscalLoteFiltro {
    const porNf = this.filtrandoPorNf;
    return {
      dataInicial: porNf ? null : this.dataInicial || null,
      dataFinal: porNf ? null : this.dataFinal || null,
      filial: this.filiaisSelecionadas
        .map((filial) => Number(filial?.Bplid ?? filial?.BPLID))
        .filter((id) => Number.isFinite(id)),
      cardCode: this.clienteSelecionado?.CardCode ?? null,
      salesPersonCode: this.vendedorSelecionado?.SalesEmployeeCode != null
        ? Number(this.vendedorSelecionado.SalesEmployeeCode)
        : null,
      // O backend filtra por faixa; uma NF so e a faixa de um numero.
      numeroDe: porNf ? this.numeroNfValido : null,
      numeroAte: porNf ? this.numeroNfValido : null,
      vencimentoDe: porNf ? null : this.vencimentoDe || null,
      vencimentoAte: porNf ? null : this.vencimentoAte || null,
      statusSap: this.filtroStatusSap || null,
      statusSefaz: this.filtroStatusSefaz !== '' ? Number(this.filtroStatusSefaz) : null,
    };
  }

  filtrar(): void {
    if (this.filtrandoPorNf && this.numeroNfValido == null) {
      this.toastr.warning('Digite o número da NF (só números).');
      return;
    }
    // Com NF preenchida as datas nao entram no filtro, entao nao barram a busca.
    if (!this.filtrandoPorNf && this.dataInicial && this.dataFinal && this.dataInicial > this.dataFinal) {
      this.toastr.warning('A emissão inicial é depois da final.');
      return;
    }
    if (!this.filtrandoPorNf && this.vencimentoDe && this.vencimentoAte && this.vencimentoDe > this.vencimentoAte) {
      this.toastr.warning('O vencimento inicial é depois do final.');
      return;
    }
    this.filtroAplicado = this.filtro;
    // O lote fica. So o "adicionar todas" pendente cai: ele era do filtro que saiu da tela.
    this.cancelarAdicionarTodas();
    this.carregarPagina(0);
  }

  carregarPagina(pagina: number): void {
    this.consultaLista?.unsubscribe();
    this.loading = true;
    this.consultaLista = this.service.listar(this.filtroAplicado, pagina, this.tamanhoPagina).subscribe({
      next: (page) => {
        this.notas = page.content;
        // Nota do lote que reaparece na busca: troca pelo dado novo (status SEFAZ pode ter
        // mudado). O set mantem a posicao no lote.
        this.notas.filter((nota) => this.selecao.has(nota.docEntry))
          .forEach((nota) => this.selecao.set(nota.docEntry, nota));
        this.totalItens = page.totalElements;
        this.paginaAtual = pagina;
        this.loading = false;
        this.loteAlterado();
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  limparFiltros(): void {
    this.definirPeriodoPadrao();
    this.vencimentoDe = '';
    this.vencimentoAte = '';
    this.numeroNf = '';
    this.filiaisSelecionadas = [];
    this.clienteSelecionado = null;
    this.vendedorSelecionado = null;
    this.filtroStatusSap = '';
    this.filtroStatusSefaz = '';
    this.versaoFiltros++;
    this.filtrar();
  }

  onFilialChange(branches: Branch[]): void {
    this.filiaisSelecionadas = branches ?? [];
    this.filtrar();
  }

  onClienteChange(parceiro: any): void {
    this.clienteSelecionado = parceiro ?? null;
    this.filtrar();
  }

  onVendedorChange(vendedor: SalesPerson): void {
    this.vendedorSelecionado = vendedor ?? null;
    this.filtrar();
  }

  get quantidadeSelecionada(): number {
    return this.selecao.size;
  }

  get todasDaPaginaSelecionadas(): boolean {
    return this.notas.length > 0 && this.notas.every((nota) => nota.selecionado);
  }

  action(event: ActionReturn): void {
    if (event.type === 'nota-lote-toggle-selecao' && !this.loteTravado()) {
      const nota = event.data as NotaFiscalLote;
      if (this.selecao.has(nota.docEntry)) {
        this.remover(nota.docEntry);
      } else {
        this.adicionar([nota]);
      }
    }
  }

  alternarSelecaoDaPagina(): void {
    if (this.loteTravado()) {
      return;
    }
    if (this.todasDaPaginaSelecionadas) {
      this.remover(...this.notas.map((nota) => nota.docEntry));
    } else {
      this.adicionar(this.notas);
    }
  }

  /**
   * Poe no lote tudo o que o filtro da lista devolve, nao so a pagina, somando ao que ja estava.
   * Busca uma pagina do tamanho do teto; se o filtro tiver mais notas que isso, nao adiciona nada
   * e pede para estreitar, em vez de pegar um pedaco arbitrario. Confere o total de novo na
   * resposta: entre a lista e o clique podem ter entrado notas.
   */
  adicionarTodasDoFiltro(): void {
    if (this.loteTravado()) {
      return;
    }
    if (this.totalItens > this.limite) {
      this.avisarFiltroGrande(this.totalItens);
      return;
    }
    this.consultaTodas?.unsubscribe();
    this.selecionandoFiltro = true;
    this.consultaTodas = this.service.listar(this.filtroAplicado, 0, this.limite).subscribe({
      next: (page) => {
        this.selecionandoFiltro = false;
        if (page.totalElements > this.limite) {
          this.avisarFiltroGrande(page.totalElements);
          return;
        }
        this.adicionar(page.content);
      },
      error: () => {
        this.selecionandoFiltro = false;
      },
    });
  }

  private avisarFiltroGrande(total: number): void {
    this.toastr.warning(
      `O filtro tem ${total} notas e o lote aceita até ${this.limite}. Estreite o período, a filial ou o cliente.`);
  }

  private cancelarAdicionarTodas(): void {
    this.consultaTodas?.unsubscribe();
    this.selecionandoFiltro = false;
  }

  /**
   * Unico lugar que poe nota no lote, e por isso o unico que aplica o teto: o que ja esta no lote
   * e ignorado, e se o resto passar do limite nada entra (tudo ou nada, como o "adicionar todas").
   */
  private adicionar(notas: NotaFiscalLote[]): boolean {
    // Tambem pega resposta de "adicionar todas" pedida antes do download comecar.
    if (this.loteTravado()) {
      return false;
    }
    const novas = new Map<number, NotaFiscalLote>();
    notas.filter((nota) => !this.selecao.has(nota.docEntry)).forEach((nota) => novas.set(nota.docEntry, nota));
    if (novas.size === 0) {
      return true;
    }
    if (this.selecao.size + novas.size > this.limite) {
      this.toastr.warning(
        `O lote tem ${this.selecao.size} nota(s); com estas ficaria com ${this.selecao.size + novas.size}, e o limite é ${this.limite}.`);
      return false;
    }
    novas.forEach((nota, docEntry) => this.selecao.set(docEntry, nota));
    this.loteAlterado();
    return true;
  }

  // Pelo docEntry: a linha da tabela costuma ser outro objeto da mesma nota que esta no lote.
  remover(...docEntries: number[]): void {
    if (this.loteTravado()) {
      return;
    }
    const removeu = docEntries.map((docEntry) => this.selecao.delete(docEntry)).some((r) => r);
    if (removeu) {
      this.loteAlterado();
    }
  }

  limparLote(): void {
    if (this.selecao.size === 0 || this.loteTravado()) {
      return;
    }
    this.alert.confirm(`Tirar as ${this.selecao.size} nota(s) do lote?`).then((resposta) => {
      if (resposta.isConfirmed) {
        this.esvaziarLote();
      }
    });
  }

  private esvaziarLote(): void {
    this.cancelarAdicionarTodas();
    this.selecao.clear();
    this.loteAlterado();
  }

  trackByDocEntry(_: number, nota: NotaFiscalLote): number {
    return nota.docEntry;
  }

  baixar(): void {
    if (this.selecao.size === 0) {
      this.toastr.warning('Selecione ao menos uma nota.');
      return;
    }
    if (!this.algumTipoMarcado) {
      this.toastr.warning('Marque DANFE, XML ou boleto.');
      return;
    }
    if (this.selecao.size > this.limite) {
      this.toastr.warning(`O lote aceita até ${this.limite} notas; há ${this.selecao.size} selecionadas.`);
      return;
    }
    this.baixando = true;
    const quantidade = this.selecao.size;
    this.quantidadeBaixando = quantidade;
    this.boletoNoDownload = this.baixarBoleto;
    this.download?.unsubscribe();
    this.download = this.service.baixar(Array.from(this.selecao.keys()), this.baixarPdf, this.baixarXml, this.baixarBoleto).subscribe({
      next: (download) => {
        this.salvar(download.arquivo, download.nome);
        this.baixando = false;
        if (download.notasComErro > 0) {
          this.toastr.warning(
            `${download.notasComErro} de ${quantidade} nota(s) não vieram completas. O motivo está no arquivo erros.txt dentro do zip.`,
            'Lote baixado com pendências',
            { timeOut: 15000 });
        } else {
          this.toastr.success(`${quantidade} nota(s) baixada(s).`);
        }
        // Nao e erro: a forma de pagamento da nota nao e boleto, ou o boleto foi cancelado.
        if (download.notasSemBoleto > 0) {
          this.toastr.info(
            `${download.notasSemBoleto} nota(s) sem boleto (forma de pagamento sem boleto ou boleto cancelado). A lista está em avisos.txt.`,
            'Boletos',
            { timeOut: 15000 });
        }
      },
      error: () => {
        this.baixando = false;
      },
    });
  }

  get algumTipoMarcado(): boolean {
    return this.baixarPdf || this.baixarXml || this.baixarBoleto;
  }

  /**
   * Durante o download o lote nao muda: o zip sai das notas do momento do clique, e mexer no
   * painel enquanto isso (tirar uma nota que esta sendo baixada, por exemplo) daria a impressao
   * errada do que vem no arquivo.
   */
  private loteTravado(): boolean {
    if (this.baixando) {
      this.toastr.info('Espere o download terminar para mudar o lote.');
    }
    return this.baixando;
  }

  // Toda mudanca do lote passa por aqui: refaz a copia do painel, a marcacao da tabela e o que
  // esta guardado na aba.
  private loteAlterado(): void {
    this.notasDoLote = Array.from(this.selecao.values());
    this.totalDoLote = this.notasDoLote.reduce((soma, nota) => soma + (Number(nota.total) || 0), 0);
    this.notas.forEach((nota) => (nota.selecionado = this.selecao.has(nota.docEntry)));
    this.storage.salvar(this.notasDoLote, this.usuario());
  }

  private carregarLote(): void {
    this.storage.carregar(this.usuario()).forEach((nota) => this.selecao.set(nota.docEntry, nota));
    this.loteAlterado();
  }

  /**
   * Dono do lote guardado: um id que nao repete entre contas nem muda ao renovar o token. Os dois
   * tokens do app invertem os campos:
   *  - Keycloak (tem iss): sub e o id da conta; jti muda a cada renovacao.
   *  - interno (JwtHandler do backend): sub e o NOME da pessoa, que pode repetir; jti e o id da
   *    conta (user.id), junto com a origem (vendedor, cliente...), que tem ids proprios.
   * O getUser() nao serve: devolve o nome de exibicao.
   */
  private usuario(): string {
    try {
      const token = this.auth.getDecodeToken();
      if (token?.iss) {
        return `kc:${token.sub ?? ''}`;
      }
      return `int:${token?.origin ?? ''}:${token?.jti ?? token?.username ?? ''}`;
    } catch {
      return '';
    }
  }

  private definirPeriodoPadrao(): void {
    this.dataInicial = moment().startOf('month').format('YYYY-MM-DD');
    this.dataFinal = moment().format('YYYY-MM-DD');
  }

  private salvar(conteudo: Blob | null, nome: string): void {
    if (!conteudo) {
      return;
    }
    const url = URL.createObjectURL(conteudo);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.click();
    // Revoga no proximo tick: revogar antes do clique processar cancela o download.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
