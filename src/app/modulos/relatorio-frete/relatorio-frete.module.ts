import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';
import { SapSharedModule } from '../sap-shared/sap-shared.module';
import { TicketFreteComponent } from './componentes/ticket-frete/ticket-frete.component';
import { TicketFreteService } from './service/ticket-frete.service';

@NgModule({
  declarations: [TicketFreteComponent],
  imports: [CommonModule, SharedModule, SapSharedModule],
  providers: [TicketFreteService],
  exports: [TicketFreteComponent],
})
export class RelatorioFreteModule {}
