import { endOfDay, startOfDay } from './dates';

class QueryBuilder<T> {
  public modelQuery: any;
  public query: Record<string, unknown>;

  constructor(modelQuery: any, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  // Search across specified fields
  search(searchableFields: string[]) {
    const searchTerm = this.query?.searchTerm as string;
    if (searchTerm) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          (field) =>
            ({
              [field]: { $regex: searchTerm, $options: 'i' },
            }) as Record<string, unknown>,
        ),
      });
    }
    return this;
  }

  // Apply filters (exclude meta fields)
  filter() {
    const queryObj = { ...this.query };
    const excludeFields = [
      'searchTerm',
      'sort',
      'limit',
      'page',
      'fields',
    ];
    excludeFields.forEach((el) => delete queryObj[el]);

    // Handle date range filters
    if (queryObj.fromDate || queryObj.toDate) {
      const dateFilter: Record<string, unknown> = {};
      const dateField = queryObj.dateField === 'invoiceDate' ? 'invoiceDate' : 'createdAt';
      delete queryObj.dateField;
      if (queryObj.fromDate) {
        dateFilter['$gte'] = startOfDay(String(queryObj.fromDate));
        delete queryObj.fromDate;
      }
      if (queryObj.toDate) {
        dateFilter['$lte'] = endOfDay(String(queryObj.toDate));
        delete queryObj.toDate;
      }
      if (Object.keys(dateFilter).length > 0) {
        queryObj[dateField] = dateFilter;
      }
    } else {
      delete queryObj.dateField;
    }

    this.modelQuery = this.modelQuery.find(queryObj);
    return this;
  }

  // Sort results
  sort() {
    const sort =
      (this.query?.sort as string)?.split(',')?.join(' ') || '-createdAt';
    this.modelQuery = this.modelQuery.sort(sort);
    return this;
  }

  // Paginate results
  paginate() {
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 50;
    const skip = (page - 1) * limit;
    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  // Select specific fields
  fields() {
    const fields =
      (this.query?.fields as string)?.split(',')?.join(' ') || '-__v';
    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }

  // Count total documents (for pagination meta)
  async countTotal() {
    const totalQueries = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(totalQueries);
    const page = Number(this.query?.page) || 1;
    const limit = Number(this.query?.limit) || 50;
    const totalPage = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPage,
    };
  }
}

export default QueryBuilder;
