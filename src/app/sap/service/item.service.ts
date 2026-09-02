import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { ConfigService } from '../../core/services/config.service';
import { Page } from '../model/page.model';
import { Item } from '../model/item';
import { LastPrice } from '../../modulos/calculadora-preco-venda/models/last-price';
import { OfflineContextService } from '../../core/offline/offline-context.service';
import { OfflineCatalogRepository } from '../../core/offline/offline-catalog.repository';

@Injectable({
  providedIn: 'root'
})
export class ItemService{

  url = "http://localhost:8080/item"
  
  constructor(private config : ConfigService, private hppCliente : HttpClient,
    private offline: OfflineContextService, private catalog: OfflineCatalogRepository) {
    this.url = config.getHost()+"/item"
  }

  search(keyWord, branchId) : Observable<Page<Item>>{
    if(this.offline.shouldUseOfflineData)
      return from(this.catalog.search('products', keyWord, value => Number(value.branchId) === Number(branchId)))
        .pipe(map(values => this.localPage(values.map(value => value.product))))
    return this.hppCliente
      .post<Page<Item>>(this.url+"/search/branch/"+branchId,keyWord)
      .pipe(map((page) => {
        page.content = page.content.map((ff) => Object.assign(new Item(),ff) )
        return page
      }))
  }

  searchItem(keyWord: string): Observable<Page<Item>> {
    if(this.offline.shouldUseOfflineData)
      return from(this.catalog.search('products', keyWord))
        .pipe(map(values => this.localPage(values.map(value => value.product))))
    return this.hppCliente
      .post<Page<Item>>(this.url + '/search', keyWord, { responseType: 'json' })
      .pipe(
        map((page) => {
          page.content = page.content.map((ff) =>
            Object.assign(new Item(), ff)
          );
          return page;
        })
      );
  }

  private localPage(values: any[]): Page<Item> {
    const page = new Page<Item>()
    page.content = values.slice(0, 100).map(value => Object.assign(new Item(), value))
    page.totalElements = page.content.length
    page.size = page.content.length
    page.nextLink = ''
    return page
  }
}
