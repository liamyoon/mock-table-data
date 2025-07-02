import TableData, { ConditionItem, ConditionNode } from '../index';

const sampleData = Array.from({ length: 100 }).map((_, i) => ({
  id: i + 1,
  userId: `user${i + 1}@example.com`,
  name: `User${i + 1}`,
  status: i % 2 === 0 ? 'active' : 'inactive',
  role: ['admin', 'user', 'guest'][i % 3],
  createdAt: `2023-01-${(i % 28 + 1).toString().padStart(2, '0')}`,
  contextId: `ctx-${i + 1}`,
}));

describe('TableData', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('insertRow - 정상 동작', () => {
    const newRow = { ...sampleData[0], id: 101 };
    const inserted = table.insertRow(newRow);
    expect(inserted).toEqual(newRow);
    expect(table.dataSource).toHaveLength(101);
  });

  test('insertRow - primary key 중복 오류', () => {
    expect(() => {
      table.insertRow(sampleData[0]);
    }).toThrow('primary key duplicate error');
  });

  test('selectRow - 특정 조건으로 찾기', () => {
    const row = table.selectRow([{ id: 5 }]);
    expect(row?.userId).toBe('user5@example.com');
  });

  test('updateRow - 특정 조건으로 수정', () => {
    table.updateRow([{ id: 1 }], {
      ...sampleData[0],
      name: 'ModifiedName',
    });
    expect(table.selectRow([{ id: 1 }])?.name).toBe('ModifiedName');
  });

  test('deleteRow - 삭제 후 존재하지 않아야 함', () => {
    table.deleteRow([{ id: 5 }]);
    expect(table.selectRow([{ id: 5 }])).toBeUndefined();
  });

  test('filteredList - like 조건', () => {
    const filtered = table.selectRows(undefined, undefined, [{ name: 'User2', like: true }]);
    expect(filtered).toHaveLength(11);
    expect(filtered[0].name).toBe('User2');
  });

  test('getRows - 정렬 및 페이징', () => {
    const rows = table.getRows(1, 0, undefined, ['id:desc']);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(100);
  });

  test('selectRows - 전체 flow(meta 포함)', () => {
    const result = table.selectRows(10, 0, [{ userId: 'user1@example.com' }], 'id:asc', true);
    expect(result.result).toHaveLength(1);
    expect(result.meta.totalCount).toBe(1);
  });

  test('selectRow should find one item using AND condition', () => {
    const row = table.selectRow([
      { userId: 'user10@example.com' },
      { status: 'inactive' },
    ]);
    expect(row?.userId).toBe('user10@example.com');
    expect(row?.status).toBe('inactive');
  });

  test('filteredList with OR nested conditions should return multiple matches', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [
        { userId: 'user1@example.com' },
        { userId: 'user2@example.com' },
        { role: 'guest' },
      ],
    };
    const result = table.filteredList(orCondition);
    expect(result.length).toBeGreaterThan(2);
    expect(result.some((r) => r.userId === 'user1@example.com')).toBe(true);
  });

  test('filteredList with OR nested like conditions  should return multiple matches', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [
        { userId: 'user1', like: true },
        {
          conditions: [
            { userId: 'user2', like: true },
            { status: 'active' },
          ],
        },
      ],
    };
    const result = table.filteredList(orCondition);
    expect(result.length).toBe(17);
  });

  test('like search should return matched entries', () => {
    const likeCondition: ConditionItem = {
      name: 'User1',
      like: true,
      type: 'string',
    };
    const result = table.filteredList([likeCondition]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.name.includes('User1'))).toBe(true);
  });

  test('sortedList returns correctly ordered data', () => {
    const sorted = table.sortedList(sampleData.slice(0, 10), ['createdAt:desc']);
    const dates = sorted.map((r) => r.createdAt);
    const sortedDates = [...dates].sort((a, b) => (a < b ? 1 : -1));
    expect(dates).toEqual(sortedDates);
  });

  test('getRows with limit/offset returns paginated result', () => {
    const result = table.getRows(10, 10) as Record<string, any>[];
    expect(result.length).toBe(10);
    expect(result[0].id).toBe(11);
  });
});
