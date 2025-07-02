
# mock-table-data

`mock-table-data`는 JavaScript/TypeScript 환경에서 테이블 형태의 데이터를 조건, 정렬, 페이징 기반으로 필터링하거나 가공할 수 있는 유틸리티 클래스입니다. 테스트용 또는 실제 클라이언트 필터링 용도로 사용할 수 있습니다.

---

## 설치

```bash
npm install mock-table-data
```

또는

```bash
yarn add mock-table-data
```

---

## 사용법

```ts
import TableData from 'mock-table-data';

const table = new TableData(dataSource, {
  primaryKey: 'id', // 선택사항
  dataProcessing: (data) => data.map(row => ({ ...row })) // 선택사항
});

const filtered = table.filteredList([
  { name: 'John', type: 'string', like: true },
  { age: 30, type: 'number' }
]);

const sorted = table.sortedList(filtered, ['name:asc']);
const paged = table.selectRows(10, 0, filtered, ['age:desc'], true);
```

---

## API 설명

### `constructor(dataSource, options?)`
- `dataSource`: 객체 배열 (원본 데이터)
- `options.primaryKey`: 고유 키로 사용할 컬럼명 (중복 삽입 방지)
- `options.dataProcessing`: 최종 데이터 처리 콜백

---

### `filteredList(conditions)`
- 조건에 맞는 row 리스트 반환
- AND/OR 트리 구조도 지원

### `sortedList(rows, sorts)`
- `sorts`: `['key:asc', 'key2:desc']` 형식

### `selectRows(limit?, offset?, conditions?, sort?, meta?)`
- 페이징 + 필터링 + 정렬을 결합한 메서드
- `meta = true`일 경우 `{ result, meta }` 반환

---

### `insertRow(item)`
- `primaryKey` 중복 검사 후 삽입

### `updateRow(conditions, newItem?)`
- 조건을 만족하는 첫 row 수정 (또는 제거)

### `deleteRow(conditions)`
- 조건을 만족하는 첫 row 제거

### `selectRow(conditions)`
- 조건을 만족하는 첫 row 반환

---

### ConditionItem 구조

```ts
type ConditionItem = {
  [key: string]: any;
  type?: 'string' | 'number' | 'boolean';
  required?: boolean;
  like?: boolean;
};
```

- `like`: 부분일치 (`includes`) 검색
- `required`: 필수값 여부
- `type`: 타입 검사 수행 여부

---

### ConditionNode 구조

```ts
type ConditionNode =
  | { logic?: 'AND' | 'OR'; conditions: ConditionNode[] }
  | ConditionItem;
```

복합 조건을 `AND` 또는 `OR` 로 구성할 수 있습니다.

---

## 예시

```ts
const table = new TableData([
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 30 }
]);

const result = table.selectRows(10, 0, [
  { name: 'ali', type: 'string', like: true }
]);

console.log(result);
```

```ts
const table = new TableData([
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' },
  { id: 3, name: 'Charlie', role: 'guest' }
]);

const result = table.selectRows(10, 0, {
  logic: 'OR',
  conditions: [
    { role: 'admin' },
    { role: 'guest' }
  ]
});

console.log(result);
// 결과: Alice 와 Charlie의 데이터가 반환됩니다.
```

---

## License

ISC
