import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { Autorizador } from '../../../sap/model/autorizador';

@Injectable({
  providedIn: 'root'
})
export class AutorizadorService {

  url = "http://localhost:8080/autorizador"

  constructor(private config : ConfigService, private httpCliente : HttpClient) {
    this.url = config.getHost()+"/autorizador"
  }

  private toAutorizador(it : any) : Autorizador {
    return Object.assign(new Autorizador(), it)
  }

  getTodos() : Observable<Array<Autorizador>>{
    return this.httpCliente
      .get<Array<Autorizador>>(this.url)
      .pipe(map(it => (it || []).map(a => this.toAutorizador(a))))
  }

  /**
   * Motivos que o motor de regras realmente produz (uma classe RegraAutorizacao por motivo, no
   * backend). O cadastro era campo livre: um erro de digitacao criava autorizador para um motivo
   * que nenhuma regra gera, e o documento ficava pendente sem ninguem que pudesse aprovar.
   */
  getMotivos() : Observable<Array<string>>{
    return this.httpCliente.get<Array<string>>(this.url+"/motivos")
  }

  criar(autorizador : Partial<Autorizador>) : Observable<Autorizador>{
    return this.httpCliente
      .post<Autorizador>(this.url, autorizador)
      .pipe(map(it => this.toAutorizador(it)))
  }

  remover(code : string) : Observable<any>{
    return this.httpCliente.delete(this.url+"/"+code)
  }
}
