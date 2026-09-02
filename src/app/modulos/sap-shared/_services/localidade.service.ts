import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { ConfigService } from '../../../core/services/config.service';
import { SearchService } from '../../../sap/service/search.service';
import { Localidade } from '../../../sap/model/localidade/localidade';
import { Page } from '../../../sap/model/page.model';
import { OfflineContextService } from '../../../core/offline/offline-context.service';
import { OfflineCatalogRepository } from '../../../core/offline/offline-catalog.repository';

@Injectable({
  providedIn: 'root'
})
export class LocalidadeService implements SearchService<Localidade> {

  url = "http://localhost:8080/locais"

  constructor(private config : ConfigService, private hppCliente : HttpClient,
    private offline: OfflineContextService, private catalog: OfflineCatalogRepository) {
    this.url = config.getHost()+"/locais"
  }

  private toLocalidade(it : any) : Localidade {
    return Object.assign(new Localidade(), it)
  }

  get(cardCode) : Observable<Localidade>{
    if(this.offline.shouldUseOfflineData)
      return from(this.catalog.get('localities', String(cardCode))).pipe(map(it => this.toLocalidade(it)))
    return this.hppCliente
      .get<Localidade>(this.url+"/"+cardCode)
      .pipe(map((pn) => this.toLocalidade(pn)))
  }

  criar(localidade : Partial<Localidade>) : Observable<Localidade>{
    return this.hppCliente
      .post<Localidade>(this.url, localidade)
      .pipe(map((it) => this.toLocalidade(it)))
  }

  search(keyWord) : Observable<Page<Localidade>>{
    if(this.offline.shouldUseOfflineData)
      return from(this.catalog.search('localities', keyWord)).pipe(map(values => {
        const page = new Page<Localidade>()
        page.content = values.slice(0, 100).map(it => this.toLocalidade(it))
        page.totalElements = page.content.length
        page.size = page.content.length
        page.nextLink = ''
        return page
      }))
    return this.hppCliente
      .post<Page<Localidade>>(this.url+"/search",keyWord)
      .pipe(map((page) => {
        page.content = page.content.map((ff) => this.toLocalidade(ff) )
        return page
      }))
  }
}
