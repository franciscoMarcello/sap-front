import { OfflineQueueService } from './offline-queue.service';
import { offlineDb } from './offline.database';
import { PedidoVenda } from '../../sap/model/document/pedido-venda.model';

describe('OfflineQueueService', () => {
  let context: any;
  let service: OfflineQueueService;

  beforeEach(async () => {
    context = {
      currentOwnerKey: () => 'http://backend::55',
      snapshot: { catalog: { snapshotId: 'catalog-1' } },
      hasValidCatalog: true,
      state$: { subscribe: () => ({ unsubscribe: () => undefined }) },
    };
    service = new OfflineQueueService(
      { getHost: () => 'http://backend' } as any,
      {} as any,
      context,
      { isLoggedIn: () => false } as any
    );
    await offlineDb.queue.clear();
  });

  afterEach(async () => offlineDb.queue.clear());

  it('grava um recibo e um total independente para cada cotacao dividida', async () => {
    const first = quotation('CLI001', 2, 10, 5);
    const second = quotation('CLI001', 1, 25, 0);

    const receipts = await service.enqueue([first, second], 'Cliente');
    const saved = await offlineDb.queue.orderBy('createdAt').toArray();

    expect(receipts.length).toBe(2);
    expect(new Set(receipts).size).toBe(2);
    //Sem ordem: o enqueue grava as duas com o MESMO createdAt, entao o orderBy empata e o Dexie
    //desempata pela chave primaria, que e um uuid aleatorio. Comparar em ordem fazia o teste
    //passar ou falhar por sorteio.
    expect(saved.map(record => record.transmissionId).sort()).toEqual([...receipts].sort());
    expect(saved.map(record => record.total)).toEqual([25, 25]);
    expect(saved.every(record => record.status === 'PENDING')).toBeTrue();
    expect(saved.every(record => record.catalogId === 'catalog-1')).toBeTrue();
  });

  it('bloqueia novo lancamento quando o catalogo venceu', async () => {
    context.hasValidCatalog = false;

    await expectAsync(service.enqueue([quotation('CLI001', 1, 10, 0)], 'Cliente'))
      .toBeRejectedWithError('Os dados offline estão vencidos ou indisponíveis');
  });

  it('preserva o protocolo de transmissao ao editar para manter idempotencia', async () => {
    const [transmissionId] = await service.enqueue([quotation('CLI001', 1, 10, 0)], 'Cliente');
    const before = (await offlineDb.queue.toArray()).find(record => record.transmissionId === transmissionId);

    await service.edit(before.localId, quotation('CLI001', 2, 10, 0), 'Cliente alterado');
    const after = await offlineDb.queue.get(before.localId);

    expect(after.transmissionId).toBe(before.transmissionId);
    expect(after.total).toBe(20);
  });

  /**
   * O transmit grava SYNCING no IndexedDB e so entao dispara o POST. Aba fechada, travada ou sem
   * energia entre as duas coisas deixava o registro SYNCING para sempre: o runSynchronization so
   * consulta PENDING, e a tela nao oferece editar, reenviar nem excluir nesse status.
   */
  it('devolve para PENDING transmissao interrompida por queda da aba', async () => {
    const [transmissionId] = await service.enqueue([quotation('CLI001', 1, 10, 0)], 'Cliente');
    const record = (await offlineDb.queue.toArray()).find(it => it.transmissionId === transmissionId);
    await offlineDb.queue.update(record.localId, { status: 'SYNCING' });

    await service.initialize();

    expect((await offlineDb.queue.get(record.localId)).status).toBe('PENDING');
  });

  /** A retransmissao e segura: o backend deduplica pelo transmissionId, que e preservado. */
  it('preserva o protocolo de transmissao ao recuperar', async () => {
    const [transmissionId] = await service.enqueue([quotation('CLI001', 1, 10, 0)], 'Cliente');
    const record = (await offlineDb.queue.toArray()).find(it => it.transmissionId === transmissionId);
    await offlineDb.queue.update(record.localId, { status: 'SYNCING' });

    await service.initialize();

    expect((await offlineDb.queue.get(record.localId)).transmissionId).toBe(transmissionId);
  });

  it('nao mexe em registro que ja foi transmitido ou deu erro', async () => {
    const receipts = await service.enqueue(
      [quotation('CLI001', 1, 10, 0), quotation('CLI002', 1, 10, 0)], 'Cliente');
    const registros = await offlineDb.queue.orderBy('createdAt').toArray();
    await offlineDb.queue.update(registros[0].localId, { status: 'TRANSMITTED' });
    await offlineDb.queue.update(registros[1].localId, { status: 'ERROR' });

    await service.initialize();

    expect((await offlineDb.queue.get(registros[0].localId)).status).toBe('TRANSMITTED');
    expect((await offlineDb.queue.get(registros[1].localId)).status).toBe('ERROR');
  });

  /**
   * O IndexedDB e do NAVEGADOR, nao do usuario. Numa maquina compartilhada, o segundo usuario
   * abria uma URL /venda/document?offlineEdit=... esquecida pelo primeiro e via cliente, itens,
   * precos e observacoes de outra pessoa - alem de poder editar e apagar.
   */
  describe('isolamento entre usuarios do mesmo navegador', () => {

    let localIdDoOutro: string;

    beforeEach(async () => {
      await service.enqueue([quotation('CLI-DO-OUTRO', 1, 10, 0)], 'Cliente do outro');
      localIdDoOutro = (await offlineDb.queue.toArray())[0].localId;
      //o outro usuario faz login na mesma maquina
      context.currentOwnerKey = () => 'http://backend::99';
    });

    it('nao devolve cotacao de outro usuario', async () => {
      expect(await service.get(localIdDoOutro)).toBeUndefined();
    });

    it('nao edita cotacao de outro usuario', async () => {
      await service.edit(localIdDoOutro, quotation('CLI-INVASOR', 5, 10, 0), 'Invasor');

      const record = await offlineDb.queue.get(localIdDoOutro);
      expect(record.quotation.CardCode).toBe('CLI-DO-OUTRO');
      expect(record.customerName).toBe('Cliente do outro');
    });

    it('nao apaga cotacao de outro usuario', async () => {
      await service.remove(localIdDoOutro);

      expect(await offlineDb.queue.get(localIdDoOutro)).toBeDefined();
    });

    it('nao reenvia cotacao de outro usuario', async () => {
      await offlineDb.queue.update(localIdDoOutro, { status: 'ERROR', lastError: 'falhou' });

      await service.retry(localIdDoOutro);

      expect((await offlineDb.queue.get(localIdDoOutro)).status).toBe('ERROR');
    });

    it('o dono continua acessando a propria cotacao', async () => {
      context.currentOwnerKey = () => 'http://backend::55';

      expect(await service.get(localIdDoOutro)).toBeDefined();
    });

    /** Sessao ausente ou expirada: negar e o padrao seguro. */
    it('sem sessao nao devolve nada', async () => {
      context.currentOwnerKey = () => null;

      expect(await service.get(localIdDoOutro)).toBeUndefined();
    });
  });

  function quotation(cardCode: string, quantity: number, unitPrice: number, freight: number): PedidoVenda {
    return Object.assign(new PedidoVenda(), {
      CardCode: cardCode,
      Frete: freight,
      DocumentLines: [{ Quantity: quantity, U_preco_negociado: unitPrice }],
    });
  }
});
