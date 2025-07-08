import { filter, get, includes, orderBy, eq } from 'lodash/fp';

export type LogicOperator = 'AND' | 'OR';

export type ConditionItem = {
  [key: string]: any;
  type?: 'string' | 'number' | 'boolean';
  required?: boolean;
  like?: boolean;
};

export type ConditionNode =
  | {
      logic?: LogicOperator;
      conditions: ConditionNode[];
    }
  | ConditionItem;

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

  static getSortOption(sort: any) {
    if (typeof sort === 'string') return [sort];
    if (Array.isArray(sort)) return sort;
    return undefined;
  }

  private static validateConditionItem(item: ConditionItem): void {
    const key = Object.keys(item).find((k) => !['type', 'required', 'like'].includes(k));
    if (!key) throw new Error('Invalid condition item: no key provided');

    const value = item[key];
    const { required, type } = item;

    if (required && (value === undefined || value === null || value === '')) {
      throw new Error(`Missing required field: ${key}`);
    }

    if (value !== undefined && value !== null && type) {
      const typeCheck = {
        string: (v: any) => typeof v === 'string',
        number: (v: any) => typeof v === 'number' || !isNaN(parseFloat(v)),
        boolean: (v: any) => typeof v === 'boolean' || v === 'true' || v === 'false',
      }[type];

      if (typeCheck && !typeCheck(value)) {
        throw new Error(`Type mismatch for key '${key}': expected ${type}, got ${typeof value}`);
      }
    }
  }

  private evaluateCondition(row: Record<string, any>, node: ConditionNode): boolean {
    if ('conditions' in node) {
      const logic = node.logic ?? 'AND';
      const results = node.conditions.map((child) => this.evaluateCondition(row, child));
      return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }

    TableData.validateConditionItem(node);

    const key = Object.keys(node).find((k) => !['type', 'required', 'like'].includes(k));
    if (!key) return false;

    const value = node[key];
    if (value === undefined || value === '') return true;
    const rowValue = get(key, row);
    const like = node.like === true;

    if (typeof value === 'string') {
      const cmp = (rowValue ?? '').toString().toUpperCase();
      const target = value.toUpperCase();
      return like ? includes(target, cmp) : cmp === target;
    }

    return eq(value, rowValue);
  }

  get dataSource() {
    return this._dataSource;
  }

  sortedList(rows: Record<string, any>[], sorts: string[]): Record<string, any>[] {
    const sortKeys: string[] = [];
    const sortOrders: ('asc' | 'desc')[] = [];

    for (const s of sorts) {
      const [key, order] = s.split(':');
      sortKeys.push(key);
      sortOrders.push(order === 'desc' ? 'desc' : 'asc');
    }

    return orderBy(sortKeys, sortOrders, rows);
  }

  filteredList(conditions: ConditionNode | ConditionItem[]): Record<string, any>[] {
    const conditionTree: ConditionNode = Array.isArray(conditions)
      ? { logic: 'AND', conditions: conditions as ConditionItem[] }
      : conditions;

    return filter((row) => this.evaluateCondition(row, conditionTree), this._dataSource);
  }

  getRows(
    limit: any,
    offset: any,
    conditions?: ConditionNode | ConditionItem[],
    sorts?: string[],
    meta?: boolean,
  ): Record<string, any>[] | TableMetaData {
    const nLimit = parseInt(limit, 10);
    const nOffset = offset ? parseInt(offset, 10) : 0;

    if (!this._dataSource || !this._dataSource.length || nLimit === 0) {
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

  selectRow(conditions: ConditionNode | ConditionItem[]): Record<string, any> | undefined {
    const tree = Array.isArray(conditions) ? { logic: 'AND', conditions: conditions as ConditionItem[] } : conditions;

    return this._dataSource.find((row) => this.evaluateCondition(row, tree));
  }

  insertRow(item: Record<string, any>): Record<string, any> {
    if (this._primaryKey && this._dataSource.find((row) => row[this._primaryKey!] === item[this._primaryKey!])) {
      throw new Error('primary key duplicate error');
    }
    this._dataSource.push(item);
    return item;
  }

  updateRow(conditions: ConditionNode | ConditionItem[], newItem?: Record<string, any>): boolean {
    const index = this._dataSource.findIndex((row) =>
      this.evaluateCondition(
        row,
        Array.isArray(conditions) ? { logic: 'AND', conditions: conditions as ConditionItem[] } : conditions,
      ),
    );

    if (index === -1) throw new Error('not found condition');

    if (newItem) this._dataSource.splice(index, 1, newItem);
    else this._dataSource.splice(index, 1);
    return true;
  }

  deleteRow(conditions: ConditionNode | ConditionItem[]): boolean {
    return this.updateRow(conditions);
  }

  selectRows(
    limit?: any,
    offset?: any,
    conditions?: ConditionNode | ConditionItem[],
    sort?: any,
    meta?: false,
  ): Record<string, any>[];

  selectRows(
    limit?: any,
    offset?: any,
    conditions?: ConditionNode | ConditionItem[],
    sort?: any,
    meta?: true,
  ): TableMetaData;

  selectRows(limit?: any, offset?: any, conditions: ConditionNode | ConditionItem[] = [], sort?: any, meta?: boolean) {
    return this.getRows(limit, offset, conditions, TableData.getSortOption(sort), meta);
  }
}
