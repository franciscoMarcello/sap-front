import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { RomaneioFazendaInsumo } from '../model/romaneio-fazenda-insumo.model';
import { BusinessPlace } from '../model/business-place';
import { ConfigService } from '../../core/services/config.service';
import { OfflineContextService } from '../../core/offline/offline-context.service';
import { OfflineCatalogRepository } from '../../core/offline/offline-catalog.repository';

@Injectable({
  providedIn: 'root'
})
export class CondicaoPagamentoService {

  url = "http://localhost:8080/prazo"

  constructor(private config : ConfigService, private hppCliente : HttpClient,
    private offline: OfflineContextService, private catalog: OfflineCatalogRepository) {
      this.url = config.getHost()+"/prazo"
  }

  getByTabela(tabela : number) : Observable<Array<CondicaoPagamento>>{
    if(this.offline.shouldUseOfflineData)
      return from(this.catalog.get('paymentTerms', String(tabela))).pipe(map(value => value?.terms || []))
    return this.hppCliente.get<Array<CondicaoPagamento>>(this.url+"/tabela/"+tabela)
  }
}


export class CondicaoPagamento{
  GroupNum : string
  PymntGroup
  ListNum : string
  Code : string
  U_desconto : number
  U_juros : number
}
