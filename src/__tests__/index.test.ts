import TableData, { ConditionItem, ConditionNode, CONDITION_RESERVED_KEYS } from '../index';

const sampleData = Array.from({ length: 100 }).map((_, i) => ({
  id: i + 1,
  subId: i + 1000,
  userId: `user${i + 1}@example.com`,
  name: `User${i + 1}`,
  status: i % 2 === 0 ? 'active' : 'inactive',
  role: ['admin', 'user', 'guest'][i % 3],
  createdAt: `2023-01-${((i % 28) + 1).toString().padStart(2, '0')}`,
  contextId: `ctx-${i + 1}`,
}));

/**
 * falsy 값(빈 문자열, null, 0, false)이 포함된 샘플 데이터
 * 실제 DB에서 흔히 발생하는 빈 값 / 초기값 케이스를 재현
 */
const sampleDataWithFalsy: Record<string, any>[] = [
  { id: 1, name: 'Alice',   score: 95,   memo: 'good',    tag: 'vip',   active: true,  grade: 'A' },
  { id: 2, name: 'Bob',     score: 0,    memo: '',        tag: 'vip',   active: false, grade: 'B' },
  { id: 3, name: '',        score: 80,   memo: 'ok',      tag: null,    active: true,  grade: 'A' },
  { id: 4, name: null,      score: null,  memo: null,     tag: '',      active: null,  grade: null },
  { id: 5, name: 'Charlie', score: 0,    memo: '',        tag: null,    active: false, grade: '' },
  { id: 6, name: '',        score: 0,    memo: null,      tag: '',      active: false, grade: null },
  { id: 7, name: 'Diana',   score: 100,  memo: 'perfect', tag: 'vip',  active: true,  grade: 'A' },
  { id: 8, name: 'Eve',     score: 50,   memo: '',        tag: null,    active: true,  grade: 'B' },
  { id: 9, name: null,      score: 0,    memo: '',        tag: '',      active: false, grade: '' },
  { id: 10, name: '',       score: null,  memo: 'retry',  tag: 'new',   active: null,  grade: 'C' },
];

describe('default 테스트', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('getNewId - 정상 동작', () => {
    const newId = table.getNewId();
    expect(newId).toBe(101);
  });

  test('getNewId - 정상 동작 2', () => {
    const newId = table.getNewId('subId');
    expect(newId).toBe(1100);
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

  test('insertRow - primary key 생성', () => {
    const newRow: any = { ...sampleData[0] };
    delete newRow.id;
    const result = table.insertRow(newRow);
    const checkRow = table.selectRow([{ id: result.id }]);
    expect(result.id).toBe(101);
    expect(checkRow?.id).toBe(result.id);
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

  test('조건 일부가 빈 문자열인 경우 해당 값과 정확히 매칭 (빈 문자열 필드가 없으면 0건)', () => {
    const result = table.selectRows(undefined, undefined, [
      { name: '' }, // name이 ''인 행만 매칭 → sampleData에 없음
      { role: 'admin' }, // 유효
    ]);
    // AND 조건이므로 name=''인 행이 없어서 0건
    expect(result.length).toBe(0);
  });

  test('조건에 숫자형 key가 undefined인 경우 무시되고 필터링 동작', () => {
    const result = table.selectRows(undefined, undefined, [
      { id: undefined }, // 무시
      { status: 'active' }, // 유효
    ]);
    expect(result.every((r) => r.status === 'active')).toBe(true);
  });

  test('조건이 모두 무효(undefined)인 경우 전체 반환, 빈 문자열은 매칭 대상', () => {
    // undefined만 조건 무시 → 전체 반환
    const result1 = table.selectRows(undefined, undefined, [{ name: undefined }]);
    expect(result1.length).toBe(100);

    // 빈 문자열은 매칭 대상 → role=''인 행이 없으므로 0건
    const result2 = table.selectRows(undefined, undefined, [{ name: undefined }, { role: '' }]);
    expect(result2.length).toBe(0);
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
    const conditions: ConditionItem[] = [{ status: 'active' }, { role: 'admin' }];
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
      conditions: [{ userId: 'user3@example.com' }, { userId: 'user4@example.com' }],
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
    const result = table.selectRows(10, 0, [{ status: undefined, required: false }, { role: 'user' }]);
    expect(result.length).toBe(10);
    result.forEach((r) => {
      expect(r.role).toBe('user');
    });
  });
});

describe('버그 수정 검증 - null 값 처리', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('condition value가 null인 경우 null/undefined인 행만 매칭됨', () => {
    // sampleData에 name이 null인 행은 없으므로 0건
    const result = table.selectRows(undefined, undefined, [{ name: null }]);
    expect(result.length).toBe(0);
  });

  test('null 매칭 - 실제 null 값이 있는 데이터에서 정확히 매칭', () => {
    const dataWithNull = [
      { id: 1, name: 'A', memo: null },
      { id: 2, name: 'B', memo: 'hello' },
      { id: 3, name: 'C', memo: null },
    ];
    const t = new TableData([...dataWithNull], { primaryKey: 'id' });
    const result = t.filteredList([{ memo: null }]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.memo === null)).toBe(true);
  });

  test('null required 체크가 동작해야 함', () => {
    expect(() => {
      table.selectRow([{ userId: null, required: true }]);
    }).toThrow('Missing required field: userId');
  });

  test('null + 다른 유효한 조건 조합 시 AND로 동작', () => {
    // sampleData에 name이 null인 행은 없으므로 AND 결과 0건
    const result = table.selectRows(undefined, undefined, [
      { name: null },
      { role: 'admin' },
    ]);
    expect(result.length).toBe(0);
  });
});

describe('버그 수정 검증 - falsy 값 정확 매칭', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('undefined만 조건 스킵 → 전체 반환', () => {
    const result = table.selectRows(undefined, undefined, [{ name: undefined }]);
    expect(result.length).toBe(100);
  });

  test('빈 문자열은 정확 매칭 대상 → name이 ""인 행만 반환 (없으면 0건)', () => {
    const result = table.selectRows(undefined, undefined, [{ name: '' }]);
    expect(result.length).toBe(0);
  });

  test('빈 문자열 정확 매칭 - 실제 빈 문자열 데이터가 있는 경우', () => {
    const dataWithEmpty = [
      { id: 1, name: 'A', tag: '' },
      { id: 2, name: 'B', tag: 'hello' },
      { id: 3, name: 'C', tag: '' },
      { id: 4, name: 'D', tag: 'world' },
    ];
    const t = new TableData([...dataWithEmpty], { primaryKey: 'id' });
    const result = t.filteredList([{ tag: '' }]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.tag === '')).toBe(true);
  });

  test('0은 정확 매칭 대상 → id가 0인 행만 반환', () => {
    const dataWithZero = [
      { id: 0, name: 'Zero' },
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' },
    ];
    const t = new TableData([...dataWithZero], { primaryKey: 'id' });
    const result = t.filteredList([{ id: 0 }]);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Zero');
  });

  test('false는 정확 매칭 대상 → active가 false인 행만 반환', () => {
    const dataWithBool = [
      { id: 1, name: 'A', active: true },
      { id: 2, name: 'B', active: false },
      { id: 3, name: 'C', active: false },
    ];
    const t = new TableData([...dataWithBool], { primaryKey: 'id' });
    const result = t.filteredList([{ active: false }]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.active === false)).toBe(true);
  });

  test('null은 정확 매칭 대상 → null/undefined인 행만 반환', () => {
    const dataWithNull = [
      { id: 1, name: 'A', memo: null },
      { id: 2, name: 'B', memo: 'text' },
      { id: 3, name: 'C' },  // memo가 undefined
    ];
    const t = new TableData([...dataWithNull], { primaryKey: 'id' });
    const result = t.filteredList([{ memo: null }]);
    expect(result.length).toBe(2);  // null + undefined 모두 매칭
  });

  test('undefined + null + 빈 문자열 혼합: undefined만 무시, 나머지는 매칭 대상', () => {
    const result = table.selectRows(undefined, undefined, [
      { name: undefined },  // 스킵
      { status: null },     // null 매칭 → sampleData에 status=null 없음 → 0건
      { role: '' },         // '' 매칭 → sampleData에 role='' 없음 → 0건
    ]);
    // AND 조건: status=null 매칭 실패 → 0건
    expect(result.length).toBe(0);
  });

  test('유효한 조건과 undefined만 혼합될 때 유효한 조건만 적용됨', () => {
    const result = table.selectRows(undefined, undefined, [
      { status: undefined },  // 스킵
      { role: undefined },    // 스킵
      { name: 'User1' },     // 유효
    ]);
    expect(result.every((r) => r.name === 'User1')).toBe(true);
  });
});

describe('버그 수정 검증 - number 타입 검증 엄격화', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData([...sampleData], { primaryKey: 'id' });
  });

  test('부분 숫자 문자열("123abc")은 타입 에러를 발생시켜야 함', () => {
    expect(() => {
      table.selectRow([{ id: '123abc', type: 'number' }]);
    }).toThrow(`Type mismatch for key 'id': expected number, got string`);
  });

  test('순수 숫자 문자열("10")은 number 타입으로 허용', () => {
    const row = table.selectRow([{ id: '10', type: 'number' }]);
    expect(row?.id).toBe(10);
  });

  test('빈 문자열에 type: number를 지정하면 타입 에러 발생', () => {
    expect(() => {
      table.selectRows(undefined, undefined, [{ id: '', type: 'number' }]);
    }).toThrow(`Type mismatch for key 'id': expected number, got string`);
  });
});

describe('버그 수정 검증 - boolean 비교', () => {
  let tableWithBool: TableData;

  beforeEach(() => {
    const data = [
      { id: 1, name: 'A', active: true },
      { id: 2, name: 'B', active: false },
      { id: 3, name: 'C', active: true },
      { id: 4, name: 'D', active: false },
    ];
    tableWithBool = new TableData([...data], { primaryKey: 'id' });
  });

  test('boolean value로 필터링 가능해야 함', () => {
    const result = tableWithBool.filteredList([{ active: true }]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.active === true)).toBe(true);
  });

  test('boolean false로 필터링 가능해야 함', () => {
    const result = tableWithBool.filteredList([{ active: false }]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.active === false)).toBe(true);
  });
});

describe('버그 수정 검증 - isConditionGroup (conditions 컬럼명 충돌)', () => {
  test('conditions 컬럼명이 문자열일 경우 ConditionItem으로 처리됨', () => {
    const data = [
      { id: 1, conditions: 'approved' },
      { id: 2, conditions: 'pending' },
      { id: 3, conditions: 'approved' },
    ];
    const table = new TableData([...data], { primaryKey: 'id' });

    // conditions 값이 문자열이므로 Array.isArray 체크에서 ConditionItem으로 분류됨
    const row = table.selectRow([{ conditions: 'approved' }]);
    expect(row?.id).toBe(1);
    expect(row?.conditions).toBe('approved');
  });
});

describe('버그 수정 검증 - dataProcessing 적용 범위', () => {
  test('meta=false일 때도 dataProcessing이 적용되어야 함', () => {
    const data = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const table = new TableData([...data], {
      primaryKey: 'id',
      dataProcessing: (rows) => rows.map((r) => ({ ...r, processed: true })),
    });

    const result = table.selectRows(10, 0, [], undefined, false);
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('processed', true);
  });

  test('meta=true일 때도 dataProcessing이 적용되어야 함', () => {
    const data = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const table = new TableData([...data], {
      primaryKey: 'id',
      dataProcessing: (rows) => rows.map((r) => ({ ...r, processed: true })),
    });

    const result = table.selectRows(10, 0, [], undefined, true);
    expect(result.result[0]).toHaveProperty('processed', true);
  });
});

describe('버그 수정 검증 - CONDITION_RESERVED_KEYS', () => {
  test('예약어 상수가 export되어 사용 가능해야 함', () => {
    expect(CONDITION_RESERVED_KEYS).toEqual(['type', 'required', 'like']);
  });
});

describe('falsy 값 포함 데이터 - 빈 문자열("") 매칭', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('name이 빈 문자열("")인 행만 조회', () => {
    // id: 3, 6, 10 → name === ''
    const result = table.filteredList([{ name: '' }]);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([3, 6, 10]);
    expect(result.every((r) => r.name === '')).toBe(true);
  });

  test('memo가 빈 문자열("")인 행만 조회', () => {
    // id: 2, 5, 8, 9 → memo === ''
    const result = table.filteredList([{ memo: '' }]);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 5, 8, 9]);
  });

  test('tag가 빈 문자열("")인 행만 조회', () => {
    // id: 4, 6, 9 → tag === '' (id:5는 tag=null이므로 제외)
    const result = table.filteredList([{ tag: '' }]);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 6, 9]);
  });

  test('grade가 빈 문자열("")인 행만 조회', () => {
    // id: 5, 9 → grade === ''
    const result = table.filteredList([{ grade: '' }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([5, 9]);
  });

  test('빈 문자열 AND 조합: name="" AND active=true', () => {
    // id: 3(name='', active=true), 10(name='', active=null) → active=true인 건 id:3만
    const result = table.filteredList([{ name: '' }, { active: true }]);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(3);
  });
});

describe('falsy 값 포함 데이터 - null 매칭', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('name이 null인 행만 조회', () => {
    // id: 4, 9 → name === null
    const result = table.filteredList([{ name: null }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 9]);
    expect(result.every((r) => r.name === null)).toBe(true);
  });

  test('score가 null인 행만 조회', () => {
    // id: 4, 10 → score === null
    const result = table.filteredList([{ score: null }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 10]);
  });

  test('memo가 null인 행만 조회', () => {
    // id: 4, 6 → memo === null
    const result = table.filteredList([{ memo: null }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 6]);
  });

  test('tag가 null인 행만 조회', () => {
    // id: 3, 5, 8 → tag === null
    const result = table.filteredList([{ tag: null }]);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([3, 5, 8]);
  });

  test('active가 null인 행만 조회', () => {
    // id: 4, 10 → active === null
    const result = table.filteredList([{ active: null }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 10]);
  });

  test('grade가 null인 행만 조회', () => {
    // id: 4, 6 → grade === null
    const result = table.filteredList([{ grade: null }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 6]);
  });

  test('null AND 조합: memo=null AND tag=""', () => {
    // memo=null → id:4,6 / tag='' → id:4,5,6,9 / 교집합 → id:4,6
    const result = table.filteredList([{ memo: null }, { tag: '' }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 6]);
  });
});

describe('falsy 값 포함 데이터 - 0 매칭', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('score가 0인 행만 조회', () => {
    // id: 2, 5, 6, 9 → score === 0
    const result = table.filteredList([{ score: 0 }]);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 5, 6, 9]);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  test('score=0 AND active=false', () => {
    // score=0 → id:2,5,6,9 / active=false → id:2,5,6,9 / 교집합 → id:2,5,6,9
    const result = table.filteredList([{ score: 0 }, { active: false }]);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 5, 6, 9]);
  });

  test('score=0 AND memo=""', () => {
    // score=0 → id:2,5,6,9 / memo='' → id:2,5,8,9 / 교집합 → id:2,5,9
    const result = table.filteredList([{ score: 0 }, { memo: '' }]);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 5, 9]);
  });

  test('score=0이 전체 조회가 되지 않음을 검증', () => {
    const result = table.filteredList([{ score: 0 }]);
    // 전체 10건이 아닌 score가 정확히 0인 4건만
    expect(result.length).not.toBe(10);
    expect(result.length).toBe(4);
  });
});

describe('falsy 값 포함 데이터 - false 매칭', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('active가 false인 행만 조회', () => {
    // id: 2, 5, 6, 9 → active === false
    const result = table.filteredList([{ active: false }]);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 5, 6, 9]);
    expect(result.every((r) => r.active === false)).toBe(true);
  });

  test('active=false가 전체 조회가 되지 않음을 검증', () => {
    const result = table.filteredList([{ active: false }]);
    expect(result.length).not.toBe(10);
    expect(result.length).toBe(4);
  });

  test('active=false AND grade=""', () => {
    // active=false → id:2,5,6,9 / grade='' → id:5,9 / 교집합 → id:5,9
    const result = table.filteredList([{ active: false }, { grade: '' }]);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([5, 9]);
  });
});

describe('falsy 값 포함 데이터 - OR 조건과 falsy 조합', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('OR: name="" OR name=null → 빈 문자열과 null 모두 조회', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [{ name: '' }, { name: null }],
    };
    // name='' → id:3,6,10 / name=null → id:4,9 / 합집합 → id:3,4,6,9,10
    const result = table.filteredList(orCondition);
    expect(result.length).toBe(5);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([3, 4, 6, 9, 10]);
  });

  test('OR: score=0 OR score=null → 0과 null 모두 조회', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [{ score: 0 }, { score: null }],
    };
    // score=0 → id:2,5,6,9 / score=null → id:4,10 / 합집합 → id:2,4,5,6,9,10
    const result = table.filteredList(orCondition);
    expect(result.length).toBe(6);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 4, 5, 6, 9, 10]);
  });

  test('OR: active=false OR active=null', () => {
    const orCondition: ConditionNode = {
      logic: 'OR',
      conditions: [{ active: false }, { active: null }],
    };
    // active=false → id:2,5,6,9 / active=null → id:4,10 / 합집합 → id:2,4,5,6,9,10
    const result = table.filteredList(orCondition);
    expect(result.length).toBe(6);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 4, 5, 6, 9, 10]);
  });
});

describe('falsy 값 포함 데이터 - 복합 조건 (AND + OR 중첩)', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('(score=0 OR score=null) AND active=false', () => {
    const condition: ConditionNode = {
      logic: 'AND',
      conditions: [
        {
          logic: 'OR',
          conditions: [{ score: 0 }, { score: null }],
        },
        { active: false },
      ],
    };
    // (score=0 OR null) → id:2,4,5,6,9,10
    // active=false → id:2,5,6,9
    // 교집합 → id:2,5,6,9
    const result = table.filteredList(condition);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 5, 6, 9]);
  });

  test('(name="" OR name=null) AND (memo="" OR memo=null)', () => {
    const condition: ConditionNode = {
      logic: 'AND',
      conditions: [
        {
          logic: 'OR',
          conditions: [{ name: '' }, { name: null }],
        },
        {
          logic: 'OR',
          conditions: [{ memo: '' }, { memo: null }],
        },
      ],
    };
    // (name='' OR null) → id:3,4,6,9,10
    // (memo='' OR null) → id:2,4,5,6,8,9
    // 교집합 → id:4,6,9
    const result = table.filteredList(condition);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.id).sort((a, b) => a - b)).toEqual([4, 6, 9]);
  });
});

describe('falsy 값 포함 데이터 - selectRow / updateRow / deleteRow', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('selectRow - score=0인 첫 번째 행 조회', () => {
    const row = table.selectRow([{ score: 0 }]);
    expect(row).toBeDefined();
    expect(row?.id).toBe(2);
    expect(row?.score).toBe(0);
  });

  test('selectRow - name=""인 첫 번째 행 조회', () => {
    const row = table.selectRow([{ name: '' }]);
    expect(row).toBeDefined();
    expect(row?.id).toBe(3);
    expect(row?.name).toBe('');
  });

  test('selectRow - name=null인 첫 번째 행 조회', () => {
    const row = table.selectRow([{ name: null }]);
    expect(row).toBeDefined();
    expect(row?.id).toBe(4);
    expect(row?.name).toBe(null);
  });

  test('selectRow - active=false인 첫 번째 행 조회', () => {
    const row = table.selectRow([{ active: false }]);
    expect(row).toBeDefined();
    expect(row?.id).toBe(2);
    expect(row?.active).toBe(false);
  });

  test('updateRow - score=0인 행 수정', () => {
    table.updateRow([{ id: 2 }, { score: 0 }], { ...sampleDataWithFalsy[1], score: 999 });
    const updated = table.selectRow([{ id: 2 }]);
    expect(updated?.score).toBe(999);
  });

  test('deleteRow - name=""인 행 삭제', () => {
    table.deleteRow([{ id: 3 }, { name: '' }]);
    const deleted = table.selectRow([{ id: 3 }]);
    expect(deleted).toBeUndefined();
    expect(table.dataSource.length).toBe(9);
  });
});

describe('falsy 값 포함 데이터 - selectRows 페이지네이션', () => {
  let table: TableData;

  beforeEach(() => {
    table = new TableData(sampleDataWithFalsy.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  test('score=0 + limit/offset 페이지네이션', () => {
    const result = table.selectRows(2, 0, [{ score: 0 }]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  test('score=0 + meta 포함 조회', () => {
    const result = table.selectRows(2, 0, [{ score: 0 }], undefined, true);
    expect(result.meta.totalCount).toBe(4); // id: 2,5,6,9
    expect(result.result.length).toBe(2);
    expect(result.result.every((r) => r.score === 0)).toBe(true);
  });

  test('active=false + 정렬 + 페이지네이션', () => {
    const result = table.selectRows(2, 0, [{ active: false }], 'id:desc');
    expect(result.length).toBe(2);
    expect(result[0].id).toBeGreaterThan(result[1].id);
    expect(result.every((r) => r.active === false)).toBe(true);
  });

  test('빈 문자열 + offset 초과 시 빈 배열', () => {
    const result = table.selectRows(10, 100, [{ name: '' }]);
    expect(result).toEqual([]);
  });
});

describe('sort - 다양한 정렬 키워드 예외처리', () => {
  let table: TableData;
  const sortData = [
    { id: 2, name: 'Bob' },
    { id: 5, name: 'Eve' },
    { id: 1, name: 'Alice' },
    { id: 4, name: 'Diana' },
    { id: 3, name: 'Charlie' },
  ];

  beforeEach(() => {
    table = new TableData(sortData.map((r) => ({ ...r })), { primaryKey: 'id' });
  });

  // desc 계열 키워드
  test.each(['desc', 'DESC', 'descend', 'DESCEND', 'Desc', 'Descend'])(
    'sort order "%s" → 내림차순 정렬',
    (keyword) => {
      const result = table.sortedList(table.dataSource, [`id:${keyword}`]);
      const ids = result.map((r) => r.id);
      expect(ids).toEqual([5, 4, 3, 2, 1]);
    },
  );

  // asc 계열 키워드
  test.each(['asc', 'ASC', 'ascend', 'ASCEND', 'Asc', 'Ascend'])(
    'sort order "%s" → 오름차순 정렬',
    (keyword) => {
      const result = table.sortedList(table.dataSource, [`id:${keyword}`]);
      const ids = result.map((r) => r.id);
      expect(ids).toEqual([1, 2, 3, 4, 5]);
    },
  );

  // order 생략 시 정렬하지 않음 (원본 순서 유지)
  test('sort order 생략 → 정렬하지 않고 원본 순서 유지', () => {
    const result = table.sortedList(table.dataSource, ['id']);
    const ids = result.map((r) => r.id);
    expect(ids).toEqual([2, 5, 1, 4, 3]); // 원본 순서 그대로
  });

  // 앞뒤 공백이 있는 경우
  test.each(['desc ', ' desc', ' desc ', ' DESC ', ' descend '])(
    'sort order "%s" (공백 포함) → 내림차순 정렬',
    (keyword) => {
      const result = table.sortedList(table.dataSource, [`id:${keyword}`]);
      const ids = result.map((r) => r.id);
      expect(ids).toEqual([5, 4, 3, 2, 1]);
    },
  );

  // 잘못된 키워드는 정렬하지 않음 (원본 순서 유지)
  test.each(['invalid', 'down', 'up', '123', 'dsc'])(
    'sort order "%s" (잘못된 키워드) → 정렬하지 않고 원본 순서 유지',
    (keyword) => {
      const result = table.sortedList(table.dataSource, [`id:${keyword}`]);
      const ids = result.map((r) => r.id);
      expect(ids).toEqual([2, 5, 1, 4, 3]); // 원본 순서 그대로
    },
  );

  // 다중 키 중 일부만 잘못된 키워드인 경우, 유효한 키만 정렬
  test('다중 sort 중 잘못된 키워드가 포함되면 해당 키는 무시하고 유효한 키만 정렬', () => {
    const multiData = [
      { id: 1, grade: 'B', score: 80 },
      { id: 2, grade: 'A', score: 90 },
      { id: 3, grade: 'A', score: 70 },
      { id: 4, grade: 'B', score: 60 },
    ];
    const t = new TableData(multiData.map((r) => ({ ...r })), { primaryKey: 'id' });
    // grade:invalid는 무시, score:desc만 적용
    const result = t.sortedList(t.dataSource, ['grade:invalid', 'score:desc']);
    const scores = result.map((r) => r.score);
    expect(scores).toEqual([90, 80, 70, 60]);
  });

  // 모든 sort 키워드가 잘못된 경우 정렬 없이 원본 반환
  test('모든 sort 키워드가 잘못된 경우 정렬하지 않고 원본 순서 유지', () => {
    const result = table.sortedList(table.dataSource, ['id:invalid', 'name:wrong']);
    const ids = result.map((r) => r.id);
    expect(ids).toEqual([2, 5, 1, 4, 3]); // 원본 순서 그대로
  });

  // selectRows에서 문자열 sort 전달
  test('selectRows에서 "id:DESCEND" 문자열로 전달 시 내림차순', () => {
    const result = table.selectRows(3, 0, [], 'id:DESCEND');
    expect(result.length).toBe(3);
    expect(result[0].id).toBe(5);
    expect(result[1].id).toBe(4);
    expect(result[2].id).toBe(3);
  });

  test('selectRows에서 배열 sort 전달 시 다중 키 정렬', () => {
    const multiData = [
      { id: 1, grade: 'B', score: 80 },
      { id: 2, grade: 'A', score: 90 },
      { id: 3, grade: 'A', score: 70 },
      { id: 4, grade: 'B', score: 60 },
    ];
    const t = new TableData(multiData.map((r) => ({ ...r })), { primaryKey: 'id' });
    const result = t.selectRows(undefined, undefined, [], ['grade:ASC', 'score:DESCEND']);
    expect(result[0]).toMatchObject({ grade: 'A', score: 90 });
    expect(result[1]).toMatchObject({ grade: 'A', score: 70 });
    expect(result[2]).toMatchObject({ grade: 'B', score: 80 });
    expect(result[3]).toMatchObject({ grade: 'B', score: 60 });
  });

  test('selectRows에서 "name:Ascend" 문자열로 전달 시 오름차순', () => {
    const result = table.selectRows(undefined, undefined, [], 'name:Ascend');
    expect(result[0].name).toBe('Alice');
    expect(result[4].name).toBe('Eve');
  });
});

