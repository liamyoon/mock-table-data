import TableData, { ConditionItem, ConditionNode } from '../index';

const sampleData = Array.from({ length: 100 }).map((_, i) => ({
  id: i + 1,
  userId: `user${i + 1}@example.com`,
  name: `User${i + 1}`,
  status: i % 2 === 0 ? 'active' : 'inactive',
  role: ['admin', 'user', 'guest'][i % 3],
  createdAt: `2023-01-${((i % 28) + 1).toString().padStart(2, '0')}`,
  contextId: `ctx-${i + 1}`,
}));

describe('default 테스트', () => {
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

  test('selectRow - required 체크', () => {
    expect(() => {
      table.selectRow([{ userId: undefined, required: true }]);
    }).toThrow('Missing required field: userId');
  });

  test('selectRow - type 체크', () => {
    expect(() => {
      table.selectRow([{ id: 'test', type: 'number' }]);
    }).toThrow(`Type mismatch for key 'id': expected number, got string`);
    const row = table.selectRow([{ id: 10, type: 'number' }]);
    expect(row?.id).toBe(10);
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
    const row = table.selectRow([{ userId: 'user10@example.com' }, { status: 'inactive' }]);
    expect(row?.userId).toBe('user10@example.com');
    expect(row?.status).toBe('inactive');
  });

  test('filteredList with OR nested conditions should return multiple matches', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [{ userId: 'user1@example.com' }, { userId: 'user2@example.com' }, { role: 'guest' }],
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
          conditions: [{ userId: 'user2', like: true }, { status: 'active' }],
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

describe('selectRows - condition 케이스 테스트', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('빈 배열일 경우 전체 반환', () => {
    const result = table.selectRows(undefined, undefined, []);
    expect(result.length).toBe(100);
  });

  test('undefined condition일 경우 전체 반환', () => {
    const result = table.selectRows(undefined, undefined, undefined);
    expect(result.length).toBe(100);
  });

  test('조건 객체에 키는 있으나 값이 undefined인 경우 무시하고 전체 반환', () => {
    const result = table.selectRows(undefined, undefined, [{ name: undefined }]);
    expect(result.length).toBe(100);
  });

  test('조건에 일부는 있고 일부는 비어있는 경우, 유효한 조건만 필터링됨', () => {
    const result = table.selectRows(undefined, undefined, [
      { name: 'User1' }, // 유효
      { status: undefined }, // 무시됨
    ]);
    expect(result.every((r) => r.name === 'User1')).toBe(true);
  });

  test('조건 일부가 빈 문자열인 경우 무시되고 필터링 동작', () => {
    const result = table.selectRows(undefined, undefined, [
      { name: '' }, // 무시됨
      { role: 'admin' }, // 유효
    ]);
    expect(result.every((r) => r.role === 'admin')).toBe(true);
  });

  test('조건에 숫자형 key가 undefined인 경우 무시되고 필터링 동작', () => {
    const result = table.selectRows(undefined, undefined, [
      { id: undefined }, // 무시
      { status: 'active' }, // 유효
    ]);
    expect(result.every((r) => r.status === 'active')).toBe(true);
  });

  test('조건이 모두 무효(undefined, 빈 문자열)인 경우 전체 반환', () => {
    const result = table.selectRows(undefined, undefined, [
      { name: undefined },
      { role: '' },
    ]);
    expect(result.length).toBe(100);
  });
});

describe('selectRows - 페이지네이션 케이스 테스트', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('limit만 설정한 경우 첫 N개만 반환', () => {
    const result = table.selectRows(10);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe(1);
  });

  test('limit과 offset 설정한 경우 해당 위치부터 반환', () => {
    const result = table.selectRows(10, 20);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe(21);
  });

  test('offset만 설정한 경우 전체에서 offset 이후 반환', () => {
    const result = table.selectRows(undefined, 95);
    expect(result.length).toBe(5);
    expect(result[0].id).toBe(96);
  });

  test('limit이 0인 경우 빈 배열 반환', () => {
    const result = table.selectRows(0);
    expect(result).toEqual([]);
  });

  test('offset이 범위를 넘는 경우 빈 배열 반환', () => {
    const result = table.selectRows(10, 1000);
    expect(result).toEqual([]);
  });

  test('limit과 offset이 문자열로 들어와도 숫자로 처리되어야 함', () => {
    const result = table.selectRows('10', '10');
    expect(result.length).toBe(10);
    expect(result[0].id).toBe(11);
  });

  test('meta를 true로 설정하면 메타데이터 포함 결과 반환', () => {
    const result = table.selectRows(10, 0, [], undefined, true);
    expect(result.result.length).toBe(10);
    expect(result.meta.totalCount).toBe(100);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.offset).toBe(0);
  });
});

describe('selectRows - 조건과 페이지네이션 조합 테스트', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('userId like 조건 + limit/offset', () => {
    const result = table.selectRows(5, 0, [{ userId: 'user1', like: true }]);
    expect(result.length).toBe(5);
    expect(result[0].userId).toContain('user1');
  });

  test('status active 조건 + limit/offset', () => {
    const result = table.selectRows(3, 2, [{ status: 'active' }]);
    expect(result.length).toBe(3);
    result.forEach((r) => expect(r.status).toBe('active'));
  });

  test('role이 user인 조건 + meta 포함', () => {
    const result = table.selectRows(4, 0, [{ role: 'user' }], undefined, true);
    expect(result.result.length).toBe(4);
    expect(result.meta.totalCount).toBeGreaterThan(4);
    result.result.forEach((r) => expect(r.role).toBe('user'));
  });

  test('like 검색 + 페이징 (User2)', () => {
    const result = table.selectRows(3, 3, [{ name: 'User2', like: true }]);
    expect(result.length).toBe(3);
    expect(result.every((r) => r.name.includes('User2'))).toBe(true);
  });

  test('복합 조건 AND + 페이징', () => {
    const conditions: ConditionItem[] = [
      { status: 'active' },
      { role: 'admin' },
    ];
    const result = table.selectRows(2, 0, conditions);
    expect(result.length).toBeLessThanOrEqual(2);
    result.forEach((r) => {
      expect(r.status).toBe('active');
      expect(r.role).toBe('admin');
    });
  });

  test('OR 조건 + 페이징', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [
        { userId: 'user3@example.com' },
        { userId: 'user4@example.com' },
      ],
    };
    const result = table.selectRows(1, 1, orCondition);
    expect(result.length).toBe(1);
    expect(['user3@example.com', 'user4@example.com']).toContain(result[0].userId);
  });

  test('조건 있음 + offset 범위 초과 시 빈 결과', () => {
    const result = table.selectRows(10, 1000, [{ status: 'active' }]);
    expect(result).toEqual([]);
  });

  test('조건 없음 (빈 배열) + limit/offset', () => {
    const result = table.selectRows(5, 95, []);
    expect(result.length).toBe(5);
    expect(result[0].id).toBe(96);
  });

  test('조건이 일부 속성만 비어있는 경우 정상 작동', () => {
    const result = table.selectRows(10, 0, [
      { status: undefined, required: false },
      { role: 'user' },
    ]);
    expect(result.length).toBe(10);
    result.forEach((r) => {
      expect(r.role).toBe('user');
    });
  });
});
