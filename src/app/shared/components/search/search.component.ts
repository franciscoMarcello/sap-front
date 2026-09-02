import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Column } from '../../../shared/components/table/column.model';
import { Page } from '../../../sap/model/page.model';
import { SearchService } from '../../../sap/service/search.service';
import { ModalSelectComponent } from '../modal/select/modal.select.component';



@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
})
export class SearchComponent<T> {


  @ViewChild('modal', {static: true}) modalSelect: ModalSelectComponent;

  keyword
  loading = false
  resultadoBusca : Page<T> = new Page()

  @Input()
  service : SearchService<T>
  
  @Input()
  definition : Array<Column> = new Array()

  @Input()
  name : string

  @Input()
  uppercaseKeyword = false

  @Input()
  autoSelectSingleResult = true

  @Input()
  initialContent : T

  @Output() 
  contentSelected = new EventEmitter();

  /**
   * Cada busca nova ganha um numero de sequencia e resposta de sequencia velha e descartada.
   *
   * Sem isso, duas buscas em voo disputam o mesmo resultadoBusca: a resposta atrasada da PRIMEIRA
   * chegava depois de a segunda ter limpado a lista, entrava como unico resultado e disparava a
   * selecao automatica - escolhendo o registro da consulta errada. Em busca de cliente isso
   * significa o pedido sair para outro parceiro sem ninguem perceber.
   *
   * A troca de pagina herda a sequencia vigente: se uma busca nova comecou no meio, a pagina que
   * chegar depois pertence a consulta antiga e tambem tem que ser descartada.
   */
  private buscaSeq = 0

  changePageService($event, buscaNova = false){
    if(buscaNova)
      this.buscaSeq++
    const seq = this.buscaSeq
    this.loading = true
    this.service.search($event).subscribe({
      next : it => {
        if(seq != this.buscaSeq)
          return
        this.resultadoBusca.content.push(...it.content)
        this.resultadoBusca.nextLink = it.nextLink
        this.loading = false
        if(buscaNova)
          this.selecionaResultadoUnico()
      },
      //sem esse ramo uma busca que falha deixava o loading ligado para sempre
      error : () => {
        if(seq == this.buscaSeq)
          this.loading = false
      }
    })
  }

  searchService($event){
    this.keyword = this.normalizaKeyword($event)
    this.resultadoBusca.content.splice(0, this.resultadoBusca.content.length)
    this.changePageService(this.keyword, true)
  }

  /**
   * So vale para busca nova, nunca para troca de pagina: paginando, a ultima pagina pode vir com
   * um item so e nao e disso que se trata. O nextLink tambem precisa estar vazio - se existe
   * proxima pagina, o unico item da tela nao e o unico resultado da busca.
   */
  private selecionaResultadoUnico(){
    if(this.autoSelectSingleResult && this.resultadoBusca.content.length == 1 && !this.resultadoBusca.nextLink)
      this.modalSelect.selecionaUnico(this.resultadoBusca.content[0])
  }

  contentSelectedFun($event){
    this.contentSelected.emit($event)
  }

  clear(){
    this.modalSelect.clear()
  }

  normalizaKeyword(value : string) : string {
    if(!this.uppercaseKeyword)
      return value
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }
}
