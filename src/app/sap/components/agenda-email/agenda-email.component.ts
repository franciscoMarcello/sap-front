import { Component, OnDestroy, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { AgendaRelatorio, AgendaRelatorioService } from '../../service/agenda-relatorio.service';
import { AlertService } from '../../../shared/service/alert.service';

/**
 * Gestao do e-mail semanal de inadimplencia dos vendedores: liga/desliga, dias e hora do envio,
 * e-mails em copia e envio imediato. O envio roda no servidor em segundo plano; enquanto ele roda a
 * tela consulta o andamento de poucos em poucos segundos.
 */
@Component({
  selector: 'app-agenda-email',
  templateUrl: './agenda-email.component.html',
})
export class AgendaEmailComponent implements OnInit, OnDestroy {

  readonly dias = [
    { valor: 1, nome: 'Seg' }, { valor: 2, nome: 'Ter' }, { valor: 3, nome: 'Qua' },
    { valor: 4, nome: 'Qui' }, { valor: 5, nome: 'Sex' }, { valor: 6, nome: 'Sáb' }, { valor: 7, nome: 'Dom' },
  ];

  agenda: AgendaRelatorio = { ativo: true, dias: [1], hora: '07:00', copia: [] };
  /** um e-mail por linha, ou separados por virgula/ponto e virgula */
  copiaTexto = '';
  vendedor?: number;
  carregando = false;

  private timer?: ReturnType<typeof setInterval>;

  constructor(private service: AgendaRelatorioService, private alert: AlertService) {}

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    this.parar();
  }

  carregar(): void {
    this.carregando = true;
    this.service.get().subscribe({
      next: a => { this.aplicar(a); this.carregando = false; },
      error: () => { this.carregando = false; },
    });
  }

  private aplicar(a: AgendaRelatorio): void {
    this.agenda = a;
    this.copiaTexto = (a.copia || []).join('\n');
    if (a.emAndamento) { this.acompanhar(); } else { this.parar(); }
  }

  private acompanhar(): void {
    if (this.timer) { return; }
    this.timer = setInterval(() => this.service.get().subscribe(a => {
      this.agenda.ultimoEnvio = a.ultimoEnvio;
      this.agenda.ultimoStatus = a.ultimoStatus;
      this.agenda.emAndamento = a.emAndamento;
      if (!a.emAndamento) { this.parar(); }
    }), 5000);
  }

  private parar(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
  }

  temDia(valor: number): boolean {
    return this.agenda.dias.includes(valor);
  }

  alternarDia(valor: number): void {
    this.agenda.dias = this.temDia(valor)
      ? this.agenda.dias.filter(d => d !== valor)
      : [...this.agenda.dias, valor].sort();
  }

  private copiaDaTela(): string[] {
    return this.copiaTexto.split(/[\n,;]+/).map(e => e.trim()).filter(e => e);
  }

  async salvar(): Promise<void> {
    if (!this.agenda.dias.length) {
      this.alert.error('Escolha ao menos um dia da semana.');
      return;
    }
    if (!this.agenda.hora) {
      this.alert.error('Informe a hora do envio.');
      return;
    }
    try {
      const salva = await this.alert.loading(this.service.salvar({ ...this.agenda, copia: this.copiaDaTela() }));
      this.aplicar(salva);
    } catch { /* o ErrorInterceptor global ja mostra o erro */ }
  }

  async enviarAgora(): Promise<void> {
    const alvo = this.vendedor ? `ao vendedor ${this.vendedor}` : 'a todos os vendedores marcados para receber o relatório';
    const copia = this.copiaDaTela().length ? ` Cópia para: ${this.copiaDaTela().join(', ')}.` : '';
    const res = await this.alert.confirm(`Enviar o relatório agora ${alvo}?${copia}`);
    if (!res.isConfirmed) { return; }
    try {
      const resp = await lastValueFrom(this.service.enviar(this.vendedor));
      if (resp.status === 202) { this.agenda.emAndamento = true; this.acompanhar(); }
    } catch (e: any) {
      if (e?.status === 409) {
        this.alert.error('Já existe um envio em andamento. Aguarde terminar.');
      }
    }
  }
}
