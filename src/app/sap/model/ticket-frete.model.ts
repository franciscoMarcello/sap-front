//uma linha do relatorio de ticket medio de frete: uma localidade, quantas notas
//de entrega ela teve no periodo e quanto de frete foi cobrado no total.
//TicketMedio ja vem calculado do backend (frete total / notas, 2 casas)
export class TicketFreteLocalidade {
    CodLocalidade : string
    Localidade : string
    Notas : number
    //quantidade de produtos vendidos nessas mesmas notas
    Quantidade : number
    TotalFrete : number
    //frete total / notas
    TicketMedio : number
    //frete total / produtos vendidos
    TicketMedioProduto : number
}
