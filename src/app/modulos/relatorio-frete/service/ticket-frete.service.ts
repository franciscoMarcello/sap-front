import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { TicketFreteLocalidade } from '../../../sap/model/ticket-frete.model';

@Injectable({ providedIn: 'root' })
export class TicketFreteService {

  private baseUrl = 'http://localhost:8080/relatorios/frete';

  constructor(private config : ConfigService, private http : HttpClient) {
    this.baseUrl = config.getHost() + '/relatorios/frete';
  }

  getTicketMedioPorLocalidade(de : string, ate : string, filial : number = null) : Observable<Array<TicketFreteLocalidade>> {
    let params = new HttpParams().set('de', de).set('ate', ate)
    if(filial != null)
      params = params.set('filial', filial.toString())
    return this.http.get<Array<TicketFreteLocalidade>>(this.baseUrl + '/ticket-medio-localidade', { params })
  }
}
