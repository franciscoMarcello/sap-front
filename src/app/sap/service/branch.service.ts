import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { ConfigService } from '../../core/services/config.service';
import { Branch } from '../model/branch';
import { OfflineContextService } from '../../core/offline/offline-context.service';
import { OfflineCatalogRepository } from '../../core/offline/offline-catalog.repository';

@Injectable({
  providedIn: 'root'
})
export class BranchService {

  url = "http://localhost:8080/branch"
  
  constructor(private config : ConfigService, private hppCliente : HttpClient,
    private offline: OfflineContextService, private catalog: OfflineCatalogRepository) {
    this.url = config.getHost()+"/branch"
  }

  get() : Observable<Array<Branch>>{
    if(this.offline.shouldUseOfflineData)
      return from(this.catalog.all('branches')).pipe(
        map(it => (it || []).map(branch => this.normaliza(branch)))
      )
    return this.hppCliente.get<Array<Branch>>(this.url)
      .pipe(map(it => (it || []).map(branch => this.normaliza(branch))))
  }

  private normaliza(branch : any) : Branch {
    const normalizado = Object.assign(new Branch(), branch)
    normalizado.Bplid = branch?.Bplid ?? branch?.BPLID
    normalizado.Bplname = branch?.Bplname ?? branch?.BPLName
    normalizado.BPLID = branch?.BPLID ?? branch?.Bplid
    normalizado.BPLName = branch?.BPLName ?? branch?.Bplname
    normalizado.prefState = branch?.prefState ?? branch?.PrefState
    return normalizado
  }
}
