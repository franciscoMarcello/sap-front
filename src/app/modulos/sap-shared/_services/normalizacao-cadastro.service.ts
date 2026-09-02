import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';

export interface CadastroParaNormalizar {
  tipo : string
  codigo : string
  atual : string
  novo : string
  aplicado? : boolean
  erro? : string
}

@Injectable({ providedIn: 'root' })
export class NormalizacaoCadastroService {

  private url : string

  constructor(private config : ConfigService, private http : HttpClient) {
    this.url = config.getHost()+"/normalizacao-cadastro"
  }

  /** Lista o que seria alterado, sem gravar nada no SAP. */
  previa() : Observable<Array<CadastroParaNormalizar>>{
    return this.http.get<Array<CadastroParaNormalizar>>(this.url+"/previa")
  }

  aplicar() : Observable<Array<CadastroParaNormalizar>>{
    return this.http.post<Array<CadastroParaNormalizar>>(this.url+"/aplicar", {})
  }
}
