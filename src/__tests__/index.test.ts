import TableData from '../index';

const sampleData = [
  {
    contextId: 'c1',
    userId: 'user1',
    projectId: 'p1',
    serviceType: 'api',
    createdDate: '2024-01-01',
    updatedDate: '2024-01-02',
    contextName: 'CTX1',
    customerCode: 'cust1',
  },
  {
    contextId: 'c2',
    userId: 'user2',
    projectId: 'p2',
    serviceType: 'web',
    createdDate: '2024-02-01',
    updatedDate: '2024-02-02',
    contextName: 'CTX2',
    customerCode: 'cust2',
  },
  {
    contextId: 'c3',
    userId: 'user3',
    projectId: 'p3',
    serviceType: 'web',
    createdDate: '2024-02-01',
    updatedDate: '2024-02-02',
    contextName: 'CTX3',
    customerCode: 'cust3',
  },
];

describe('TableData', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'contextId' });
  });

  test('insertRow - 정상 동작', () => {
    const newRow = { ...sampleData[0], contextId: 'c4' };
    const inserted = table.insertRow(newRow);
    expect(inserted).toEqual(newRow);
    expect(table.dataSource).toHaveLength(4);
  });

  test('insertRow - primary key 중복 오류', () => {
    expect(() => {
      table.insertRow(sampleData[0]);
    }).toThrow('primary key duplicate error');
  });

  test('selectRow - 특정 조건으로 찾기', () => {
    const row = table.selectRow([{ contextId: 'c1' }]);
    expect(row?.userId).toBe('user1');
  });

  test('updateRow - 특정 조건으로 수정', () => {
    table.updateRow([{ contextId: 'c1' }], {
      ...sampleData[0],
      contextName: 'ModifiedCTX',
    });
    expect(table.selectRow([{ contextId: 'c1' }])?.contextName).toBe('ModifiedCTX');
  });

  test('deleteRow - 삭제 후 존재하지 않아야 함', () => {
    table.deleteRow([{ contextId: 'c2' }]);
    expect(table.selectRow([{ contextId: 'c2' }])).toBeUndefined();
  });

  test('filteredList - like 조건', () => {
    const filtered = table.selectRows(undefined, undefined, [{ contextName: 'CTX', like: true }]);
    expect(filtered).toHaveLength(3);
    expect(filtered[0].contextId).toBe('c1');
  });

  test('getRows - 정렬 및 페이징', () => {
    const rows = table.getRows(1, 0, undefined, ['contextId:desc']);
    expect(rows).toHaveLength(1);
    expect(rows[0].contextId).toBe('c3');
  });

  test('selectRows - 전체 flow(meta 포함)', () => {
    const result = table.selectRows(10, 0, [{ userId: 'user1' }], 'contextId:asc', true);
    expect(result.result).toHaveLength(1);
    expect(result.meta.totalCount).toBe(1);
  });
});
