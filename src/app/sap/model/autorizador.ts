import { Actiable, Action, ActionReturn } from "../../shared/components/action/action.model"

export class Autorizador implements Actiable {
    //Code do UDO e alfanumerico no service layer, nao numerico - mesma pegadinha do Comissao,
    //onde tipar como number quebrava a leitura da lista inteira
    Code : string
    Name : string
    U_motivo : string
    U_usuario : string

    getActions() : Array<Action> {
        return [
            new Action('Remover', new ActionReturn('remover', this), 'fas fa-trash', 'danger'),
        ]
    }

    toString(){
        return this.Name || String(this.Code)
    }
}
