import * as R from 'ramda';

export type ConditionItem = {
  [key: string]: any;
  type?: 'string' | 'number' | 'boolean';
  required?: boolean;
  like?: boolean;
};

export type TableDataOptions = {
  primaryKey?: string;
  dataProcessing?: (dataSource: Record<string, any>[]) => Record<string, any>[];
};

export interface TableMetaData {
  result: Record<string, any>[];
  meta: {
    totalCount: number;
    currentCount: number;
    limit: number;
    offset: number;
  };
}

export default class TableData {
  private readonly _dataSource: Record<string, any>[];
  private readonly _primaryKey?: string;
  private readonly dataProcessing?: (dataSource: Record<string, any>[]) => Record<string, any>[];

  constructor(dataSource: Record<string, any>[], tableOptions: TableDataOptions = {}) {
    this._dataSource = dataSource;
    this._primaryKey = tableOptions.primaryKey;
    this.dataProcessing = tableOptions.dataProcessing;
  }

  private static convertValue(value: any, item: ConditionItem): any {
    switch (item.type) {
      case 'number':
        return parseInt(value, 10);
      case 'boolean':
        return value === 'true';
      case 'string':
      default:
        return item.like ? `${value}:%like%` : value;
    }
  }

  static getConditions(items: ConditionItem[]): Record<string, any>[] {
    const conditions: Record<string, any>[] = [];
    for (const item of items) {
      const itemKey = Object.keys(item).find((key) => key !== 'type' && key !== 'required');
      if (!itemKey) throw new Error('invalid item key');
      const isExist = item[itemKey] && (typeof item[itemKey] === 'string' || typeof item[itemKey] === 'number');
      if (item.required && !isExist) throw new Error(`${itemKey} is required`);
      if (isExist) conditions.push({ [itemKey]: TableData.convertValue(item[itemKey], item) });
    }
    return conditions;
  }

  static getSortOption(sort: any) {
    if (typeof sort === 'string') return [sort];
    if (Array.isArray(sort)) return sort;
    return undefined;
  }

  get dataSource() {
    return this._dataSource;
  }

  sortedList(rows: Record<string, any>[], sorts: string[]): Record<string, any>[] {
    return R.sortWith(
      sorts.map((sortItem) => {
        const [column, order] = sortItem.split(':');
        const orderFC = order === 'desc' ? R.descend : R.ascend;
        return orderFC(R.prop(column));
      }),
      rows,
    );
  }

  filteredList(conditions: Record<string, any>[]): Record<string, any>[] {
    const obj = {};
    for (const condition of conditions) {
      const key = Object.keys(condition)[0];
      const value = condition[key];
      if (typeof value === 'string' && value.indexOf(':%like%') > -1) {
        const likeValue = value.replace(':%like%', '');
        obj[key] = R.pipe(R.toUpper, R.includes(likeValue.toUpperCase()));
      } else if (typeof value === 'string') {
        obj[key] = R.pipe(R.toUpper, R.equals(value.toUpperCase()));
      } else {
        obj[key] = R.equals(value);
      }
    }

    return R.filter(R.where(obj), this._dataSource);
  }

  getRows(limit, offset, conditions?: Record<string, any>[], sorts?: string[], meta?: boolean) {
    const nLimit = parseInt(limit, 10);
    const nOffset = offset ? parseInt(offset, 10) : 0;

    if (!this._dataSource || !this._dataSource.length) {
      if (!meta) return [];
      return {
        result: [],
        meta: {
          totalCount: 0,
          currentCount: 0,
          limit: nLimit,
          offset: nOffset,
        },
      };
    }

    let result = this._dataSource;

    // 조건절 filter
    if (conditions) result = this.filteredList(conditions);
    const totalCount = result.length;

    // 정렬
    if (sorts) result = this.sortedList(result, sorts);

    // 페이징 처리
    result = result.slice(nOffset, limit ? nOffset + nLimit : undefined);

    if (!meta) return result;

    if (this.dataProcessing) result = this.dataProcessing(result);

    // meta값이 on인 경우 meta정보를 추가하여 전체 obj생성
    return {
      result: R.clone(result),
      meta: {
        totalCount,
        currentCount: result.length,
        limit: nLimit,
        offset: nOffset,
      },
    };
  }

  selectRow(conditions: Record<string, any>[]): Record<string, any> | undefined {
    return R.clone(
      R.find(
        R.allPass(
          conditions.map((condition) => {
            const key = Object.keys(condition)[0];
            return R.propEq(key, condition[key]);
          }),
        ),
      )(this._dataSource),
    );
  }

  insertRow(item): Record<string, any> {
    if (this._primaryKey && this._dataSource.find((row) => row[this._primaryKey!] === item[this._primaryKey!])) {
      throw new Error('primary key duplicate error');
    }
    this._dataSource.push(item);
    return item;
  }

  updateRow(conditions: Record<string, any>[], item?: Record<string, any>): boolean {
    const itemIndex = R.findIndex(
      R.allPass(
        conditions.map((condition) => {
          const key = Object.keys(condition)[0];
          return R.propEq(key, condition[key]);
        }),
      ),
    )(this._dataSource);

    if (itemIndex === -1) throw new Error('not found condition');

    if (item) this._dataSource.splice(itemIndex, 1, item);
    else this._dataSource.splice(itemIndex, 1);

    return true;
  }

  deleteRow(conditions: Record<string, any>[]): boolean {
    return this.updateRow(conditions);
  }

  selectRows(
    limit?: any,
    offset?: any,
    conditions?: Record<string, any>[],
    sort?: any,
    meta?: false,
  ): Record<string, any>[];

  selectRows(
    limit?: any,
    offset?: any,
    conditions?: Record<string, any>[],
    sort?: any,
    meta?: true,
  ): TableMetaData;

  selectRows(
    limit?: any,
    offset?: any,
    conditions: Record<string, any>[] = [],
    sort?: any,
    meta?: boolean,
  ) {
    return this.getRows(limit, offset, TableData.getConditions(conditions), TableData.getSortOption(sort), meta);
  }
}
