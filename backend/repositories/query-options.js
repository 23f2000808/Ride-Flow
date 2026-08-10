const applyQueryOptions = (query, options = {}) => {
  const {
    select,
    sort,
    skip,
    limit,
    populate,
    lean,
  } = options;

  if (select) {
    query = query.select(select);
  }

  if (sort) {
    query = query.sort(sort);
  }

  if (skip !== undefined) {
    query = query.skip(skip);
  }

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  if (populate) {
    const items = Array.isArray(populate) ? populate : [populate];
    items.filter(Boolean).forEach((item) => {
      if (typeof item === "string") {
        query = query.populate(item);
        return;
      }

      if (Array.isArray(item)) {
        query = query.populate(item[0], item[1]);
        return;
      }

      query = query.populate(item);
    });
  }

  if (lean) {
    query = query.lean();
  }

  return query;
};

module.exports = {
  applyQueryOptions,
};
