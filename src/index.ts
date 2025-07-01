import {
  filter,
  get,
  includes,
  orderBy,
  eq,
} from 'lodash/fp';

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
    const sortKeys: string[] = [];
    const sortOrders: Array<'asc' | 'desc'> = [];

    for (const s of sorts) {
      const [key, order] = s.split(':');
      sortKeys.push(key);
      sortOrders.push(order === 'desc' ? 'desc' : 'asc');
    }

    return orderBy(sortKeys, sortOrders, rows);
  }

  filteredList(conditions: Record<string, any>[]): Record<string, any>[] {
    return filter((row) => {
      return conditions.every((condition) => {
        const key = Object.keys(condition)[0];
        const value = condition[key];

        const rowValue = get(key, row);
        if (typeof value === 'string' && value.includes(':%like%')) {
          const likeValue = value.replace(':%like%', '').toUpperCase();
          return includes(likeValue, (rowValue ?? '').toString().toUpperCase());
        } else if (typeof value === 'string') {
          return (rowValue ?? '').toString().toUpperCase() === value.toUpperCase();
        } else {
          return eq(value, rowValue);
        }
      });
    }, this._dataSource);
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

    if (conditions) result = this.filteredList(conditions);
    const totalCount = result.length;

    if (sorts) result = this.sortedList(result, sorts);
    result = result.slice(nOffset, limit ? nOffset + nLimit : undefined);

    if (!meta) return result;

    if (this.dataProcessing) result = this.dataProcessing(result);

    return {
      result: [...result],
      meta: {
        totalCount,
        currentCount: result.length,
        limit: nLimit,
        offset: nOffset,
      },
    };
  }

  selectRow(conditions: ConditionItem[]): Record<string, any> | undefined {
    const conditionObject = TableData.getConditions(conditions)[0];
    const key = Object.keys(conditionObject)[0];
    const value = conditionObject[key];

    return this._dataSource.find((row) => get(key, row) === value);
  }

  insertRow(item: Record<string, any>): Record<string, any> {
    if (this._primaryKey && this._dataSource.find((row) => row[this._primaryKey!] === item[this._primaryKey!])) {
      throw new Error('primary key duplicate error');
    }
    this._dataSource.push(item);
    return item;
  }

  updateRow(conditions: ConditionItem[], item?: Record<string, any>): boolean {
    const foundIndex = this._dataSource.findIndex((row) => {
      return conditions.every((condition) => {
        const key = Object.keys(condition)[0];
        return get(key, row) === condition[key];
      });
    });

    if (foundIndex === -1) throw new Error('not found condition');

    if (item) this._dataSource.splice(foundIndex, 1, item);
    else this._dataSource.splice(foundIndex, 1);

    return true;
  }

  deleteRow(conditions: ConditionItem[]): boolean {
    return this.updateRow(conditions);
  }

  selectRows(
    limit?: any,
    offset?: any,
    conditions?: ConditionItem[],
    sort?: any,
    meta?: false,
  ): Record<string, any>[];

  selectRows(limit?: any, offset?: any, conditions?: ConditionItem[], sort?: any, meta?: true): TableMetaData;

  selectRows(limit?: any, offset?: any, conditions: ConditionItem[] = [], sort?: any, meta?: boolean) {
    return this.getRows(limit, offset, TableData.getConditions(conditions), TableData.getSortOption(sort), meta);
  }
}
