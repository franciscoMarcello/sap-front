import { BusinessPartner } from './business-partner';

/**
 * O cache de opcoes de endereco era um campo unico, preenchido ANTES de o filtro de tipo entrar
 * na conta: quem chamasse primeiro definia o conteudo para todas as chamadas seguintes daquela
 * instancia. Com a trava de regiao na retirada isso deixaria de ser latente - o seletor de
 * entrega listaria endereco de cobranca e a validacao rodaria contra o endereco errado.
 */
describe('BusinessPartner - cache de enderecos por tipo', () => {

  function parceiro(): BusinessPartner {
    const bp = new BusinessPartner();
    (bp as any).BPAddresses = [
      { AddressName: 'COBRANCA', AddressType: 'bo_BillTo', U_Localidade: 10 },
      { AddressName: 'ENTREGA', AddressType: 'bo_ShipTo', U_Localidade: 20 },
      { AddressName: 'FAZENDA', AddressType: 'bo_ShipTo', U_Localidade: 30 },
    ];
    return bp;
  }

  it('filtra por tipo mesmo depois de uma chamada sem tipo', () => {
    const bp = parceiro();

    bp.getAddressOptions();
    const entrega = bp.getAddressOptions('bo_ShipTo');

    expect(entrega.length).toEqual(2);
    expect(entrega.map(op => (op.value as any).AddressName)).toEqual(['ENTREGA', 'FAZENDA']);
  });

  it('sem tipo continua devolvendo todos', () => {
    expect(parceiro().getAddressOptions().length).toEqual(3);
  });

  /**
   * O app-select reaplica a selecao observando a REFERENCIA do array - devolver um array novo a
   * cada ciclo de deteccao zeraria o que o usuario marcou. Por isso o cache continua existindo.
   */
  it('mantem a mesma referencia entre chamadas do mesmo tipo', () => {
    const bp = parceiro();

    expect(bp.getAddressOptions('bo_ShipTo')).toBe(bp.getAddressOptions('bo_ShipTo'));
  });

  it('tipos diferentes nao compartilham a mesma lista', () => {
    const bp = parceiro();

    expect(bp.getAddressOptions('bo_ShipTo')).not.toBe(bp.getAddressOptions('bo_BillTo'));
    expect(bp.getAddressOptions('bo_BillTo').length).toEqual(1);
  });

  it('parceiro sem endereco devolve lista vazia', () => {
    expect(new BusinessPartner().getAddressOptions('bo_ShipTo')).toEqual([]);
  });
});
