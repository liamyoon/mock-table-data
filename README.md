# mock-table-data
mock api 내에서 table row data를 생성 및 관리하기(CRUD) 위한 라이브러리 입니다.

## Installation
```sh
$ npm install --save mock-table-data
```

## Usage
mock api 혹은 테스트용 rowdata를 활용할수 있는 모든범위에 사용할 수 있습니다.
값은 메모리에 저장되기 때문에 코드가 재실행 되는 경우 저장된 값은 자동으로 초기화 됩니다.

#### Example
```ts
import TableData from 'mock-table-data';

const testData = new TableData(
  Array.from(Array(10)).map((_, index) => ({
    id: String(index),
    title: `2020 카드 사용 패턴 분석 프로젝트_${index}`,
    lastUsedTime: moment.utc().subtract(index, 'hour').toISOString(),
    userName: 'nexr',
    memo: 'Donec facilisis tortor ut augue lacinia, at viverra est semper.',
  })),
  { primaryKey: 'id' },
);
```

## Methods
### table.selectRows
데이터 조회
```ts
export default {
  'GET /api/test-data': (req: Request, res: Response) => {
    const { title, limit, offset, sort, meta } = req.query;
    
    const result = testData.selectRows(
      limit,
      offset,
      [{ title, like: true }],
      sort,
      meta === 'on', // meta { totalCount, currentCount, limit, offset } 메타정보 반환
    );

    return res.status(200).json({
      ...result,
    });
  },
};
```
### table.selectRow, table.insertRow
단일 데이터 조회, 데이터 추가
```ts
export default {
  'POST /api/test-data': (req: Request, res: Response) => {
    const { title, memo } = req.body;

    if (testData.selectRow([{ title }]))
      return res.status(500).json({ message: '동일한 제목이 있습니다. 다시 입력해 주세요.' });

    const id = String(testData.dataSource.length);
    const newData = {
      id,
      title,
      lastUsedTime: moment.utc().toISOString(),
      userName: 'nexr',
      memo,
    };

    const result = testData.insertRow(newData);

    return res.status(200).json({
      result,
    });
  },
};
```
### table.updateRow
데이터 수정
```ts
export default {
  'UPDATE /api/test-data/:id': (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, memo } = req.body;

    const data = testData.selectRow([{ id }]);
    if (!data)
      return res.status(500).json({ message: '데이터가 존재하지 않습니다.' });

    const newData = {
      ...data,
      title,
      memo,
    };
    testData.updateRow([{ id }], newData);

    return res.status(200).json({
      result: newData,
    });
  },
};
```
### table.deleteRow
데이터 삭제
```ts
export default {
  'DELETE /api/test-data/:id': (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      testData.deleteRow([{ id }]);
    } catch(e) {
      // 조건에 해당하는 값이 없을 경우 Error 발생
      return res.status(500).json({ message: e.message });
    }

    return res.status(200).json({ success: true });
  },
};
```
### table.dataSource
현재 저장된 모든 데이터
```ts
export default {
  'GET /api/test-data/all': (req: Request, res: Response) => {
    return res.status(200).json({ result: testData.dataSource });
  },
}
```

## Options
### TableDataOptions
| **name**       | **type**                                                     | **required** | **default** | **description**                                                         |
|----------------|--------------------------------------------------------------|--------------|-------------|-------------------------------------------------------------------------|
| `primaryKey`     | string                                                       | x            | -           | row insert 시 validation 처리를 위한 primaryKey 를 설정 할 수 있습니다. |
| `dataProcessing` | (dataSource: Record<string, any>[]) => Record<string, any>[] | x            | -           | row select 시 조회된 데이터 전처리를 위해 사용 할 수 있습니다..         |

### ConditionItem
| **name**      | **type**                          | **required** | **default** | **description**                                                              |
|---------------|-----------------------------------|--------------|-------------|------------------------------------------------------------------------------|
| `[key: string]` | any                               | x            | -           | condition key value 값                                                       |
| `type`          | `'string' \| 'number' \| 'boolean'` | x            | -           | condition value type 불일치 시 throw error                                   |
| `required`      | boolean                           | x            | false       | condition value 필수 여부  !!required && !conditionValue 의 경우 throw error |
| `like`          | boolean                           | x            | false       | condition value를 like 이용하여 조회할지 여부                                |

