import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ModalComponent } from '../../modal/modal.component';
import { ActionReturn } from '../../action/action.model';
import { Column } from '../../table/column.model';
import { PaginacaoComponent } from '../../paginacao/paginacao.component';
import { Page } from '../../../../sap/model/page.model';




@Component({
  selector: 'app-modal-select',
  templateUrl: './modal.select.component.html',
})
export class ModalSelectComponent implements OnInit {


  @Input()
  name
  @Input()
  definition : Array<Column>;
  @Input()
  loading = false
  @Input()
  resultadoBusca : Page<any> = new Page()
  @Input()
  uppercaseKeyword = false

  @Input()
  set initialContent(value : any){
    if(value)
      this.content = value
  }
  
  @Output()
  changePage = new EventEmitter<number>();
  
  @Output()
  search = new EventEmitter<String>();

  @Output() 
  contentSelected = new EventEmitter<any>();
  
  keyWord = ""
  content : any = null
  currentPage = 0

  ngOnInit(): void {
    this.buscaModal.classeModal = "modal-xl"
  }
    
  @ViewChild('busca', {static: true}) buscaModal: ModalComponent;
  @ViewChild('paginacao', {static: true}) paginacaoComponent: PaginacaoComponent;

  searchFunction(){
    if(this.paginacaoComponent)
      this.paginacaoComponent.paginaAtual = 0
    this.buscaModal.openModal()
    this.search.emit(this.keyWord)
  }

  atualizaKeyWord(value : string){
    this.keyWord = this.normalizaKeyWord(value)
  }

  changePageFunction($event){
    this.changePage.emit($event)
  }

  closeModal(){
    this.buscaModal.closeModal()
  }

  action(action : ActionReturn){
    if(action.type == 'selected'){
      this.content = action.data
      this.closeModal()
      this.contentSelected.emit(this.content)
    }
  }

  /**
   * Busca que retornou um resultado so: seleciona sozinho, para o usuario nao ter que abrir o
   * modal e clicar na unica linha possivel. Mesmo efeito de clicar na linha em action().
   */
  selecionaUnico(item : any){
    this.content = item
    this.closeModal()
    this.contentSelected.emit(this.content)
  }

  clear(){
    this.content = null;
    this.keyWord = '';
    this.contentSelected.emit(undefined);
  }

  disableSearch(){
    return !this.keyWord || this.keyWord.length < 1
  }

  private normalizaKeyWord(value : string) : string {
    if(!this.uppercaseKeyword)
      return value || ''
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }
  
  isSelected() : boolean{
    return this.content ? true : false
  }
}
