import { formatCurrency } from '@angular/common';
import * as moment from 'moment';
import { Action, ActionReturn } from '../../../shared/components/action/action.model';
import { ReplaceFilial } from '../../../utils/replaceFilial';

export type StatusSapNota = 'ABERTO' | 'FECHADO' | 'CANCELADO';

export const STATUS_SAP_NOTA: { valor: StatusSapNota; rotulo: string }[] = [
  { valor: 'ABERTO', rotulo: 'Aberto' },
  { valor: 'FECHADO', rotulo: 'Fechado' },
  { valor: 'CANCELADO', rotulo: 'Cancelado' },
];

export interface StatusSefaz {
  id: number;
  descricao: string;
}

// NF-e de saida emitida para a SEFAZ, devolvida por GET /nota-fiscal-lote.
export class NotaFiscalLote {
  docEntry: number;
  docNum: number;
  numero: number;
  serie: string;
  data: string;
  cardCode: string;
  cardName: string;
  filialId: number;
  filial: string;
  total: number;
  // Primeira e ultima parcela; a ultima e o DocDueDate.
  vencimentoInicial: string;
  vencimentoFinal: string;
  parcelas: number;
  vendedorCodigo: number;
  vendedor: string;
  chaveAcesso: string;
  statusSefazId: number;
  statusSefaz: string;
  statusSap: StatusSapNota;

  selecionado = false;

  static from(json: any): NotaFiscalLote {
    return Object.assign(new NotaFiscalLote(), json);
  }

  // So os dados da nota, para guardar o lote no sessionStorage. Nao serializar a nota inteira: o
  // app-table pendura FormControl na linha (formControlFactory*), que tem referencia circular.
  static paraArmazenar(nota: NotaFiscalLote): object {
    const { docEntry, docNum, numero, serie, data, cardCode, cardName, filialId, filial, total,
      vencimentoInicial, vencimentoFinal, parcelas, statusSefazId, statusSefaz, statusSap } = nota;
    return { docEntry, docNum, numero, serie, data, cardCode, cardName, filialId, filial, total,
      vencimentoInicial, vencimentoFinal, parcelas, statusSefazId, statusSefaz, statusSap };
  }

  getActions(): Action[] {
    return [
      new Action(
        this.selecionado ? 'Selecionada' : 'Selecionar',
        new ActionReturn('nota-lote-toggle-selecao', this),
        this.selecionado ? 'fas fa-check-square' : 'far fa-square',
        this.selecionado ? 'success' : 'secondary'
      ),
    ];
  }

  get notaFormatada(): string {
    if (this.numero == null) {
      return `Doc. ${this.docNum ?? this.docEntry}`;
    }
    return this.serie ? `${this.numero} / ${this.serie}` : `${this.numero}`;
  }

  get dataFormatada(): string {
    return this.data ? moment(this.data, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
  }

  // Parcela unica: a data. Varias: primeira a ultima, para nao esconder parcela antes do DocDueDate.
  get vencimentoFormatado(): string {
    const final = this.formatar(this.vencimentoFinal);
    if (!(this.parcelas > 1) || !this.vencimentoInicial || this.vencimentoInicial === this.vencimentoFinal) {
      return final;
    }
    return `${this.formatar(this.vencimentoInicial)} a ${final} (${this.parcelas} parc.)`;
  }

  private formatar(data: string): string {
    return data ? moment(data, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
  }

  get filialFormatada(): string {
    return ReplaceFilial.limparFilial(this.filial) || (this.filialId != null ? `Filial ${this.filialId}` : '');
  }

  get statusSapLabel(): string {
    return STATUS_SAP_NOTA.find((s) => s.valor === this.statusSap)?.rotulo ?? '';
  }

  get statusSefazLabel(): string {
    return this.statusSefaz || (this.statusSefazId != null ? `Status ${this.statusSefazId}` : '');
  }

  get totalCurrency(): string {
    return formatCurrency(this.total ?? 0, 'pt', 'R$');
  }
}
