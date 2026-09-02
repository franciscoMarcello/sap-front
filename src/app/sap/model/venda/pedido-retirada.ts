import { Action, ActionReturn } from "../../../shared/components/action/action.model"
import { ItemRetirada } from "./item-retirada"

export class PedidoRetirada{
    docEntryVendaFutura : number
    itensRetirada : Array<ItemRetirada>
    dataEntrega : Date
    //Endereco de entrega escolhido. O back recusa a retirada se ele cair em regiao de frete
    //diferente da do contrato - o valor foi negociado para aquele destino.
    shipToCode : string


    constructor(
        docEntryVendaFutura : number,
        itensRetirada : Array<ItemRetirada>,
        dataEntrega : Date,
        shipToCode : string = null){
        this.dataEntrega = dataEntrega
        this.docEntryVendaFutura = docEntryVendaFutura
        this.itensRetirada = itensRetirada
        this.shipToCode = shipToCode
    }
}