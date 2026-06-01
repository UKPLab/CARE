/**
 * Generic helpers for trigger dashboards (rules + logs).
 * Builds BasicTable columns/buttons and enriches rows from backend dashboard config.
 */

export function buildStatusTypeOptions(statuses) {
  const keyMapping = {};
  const classMapping = { default: 'bg-secondary' };
  const flagByValue = {};
  for (const s of statuses) {
    keyMapping[s.value] = s.label;
    classMapping[s.value] = s.badgeClass;
    flagByValue[s.value] = s.flags || [];
  }
  return { keyMapping, classMapping, flagByValue };
}

export function buildColumns(columnDefs, statusTypeOptions) {
  return columnDefs.map((col) => {
    if (col.type === 'badge' && col.badgeFrom === 'statuses') {
      return {
        ...col,
        typeOptions: {
          keyMapping: statusTypeOptions.keyMapping,
          classMapping: statusTypeOptions.classMapping,
        },
      };
    }
    return { ...col };
  });
}

export function buildManageButtons(manageActions) {
  return manageActions.map(({ handler, socketEvent, successToast, errorToast, modal, confirm, filter, ...btn }) => btn);
}

function getCatalogLabel(row, store, table, foreignKey) {
  const items = store.getters[`table/${table}/getAll`] || [];
  const item = items.find((e) => e.id === row[foreignKey]);
  if (!item) return '-';
  return (item.configuration && item.configuration.label) || item.name || '-';
}

function resolveFkLabel(row, resolver, store) {
  const parent = (store.getters[`table/${resolver.table}/getAll`] || []).find(
    (r) => r.id === row[resolver.foreignKey] && !r.deleted
  );
  if (parent && parent[resolver.labelKey]) {
    return parent[resolver.labelKey];
  }
  const fallback = resolver.fallback || '';
  return fallback.replace('{triggerId}', row[resolver.foreignKey]);
}

function hasFlags(item, flagByValue, flags, orErrorMessage) {
  const statusFlags = flagByValue[item.status] || [];
  const fromStatus = flags.some((f) => statusFlags.includes(f));
  if (orErrorMessage && flags.includes('hasError')) {
    return fromStatus || !!item.errorMessage;
  }
  return fromStatus;
}

export function enrichRow(item, config, store, statusTypeOptions) {
  const row = { ...item };
  const { flagByValue } = statusTypeOptions;

  for (const [key, resolver] of Object.entries(config.rowResolvers || {})) {
    if (resolver.type === 'fkLabel' || resolver.type === 'catalogLabel') {
      if (resolver.type === 'catalogLabel') {
        row[key] = getCatalogLabel(row, store, resolver.table, resolver.foreignKey);
      } else {
        row[key] = resolveFkLabel(row, resolver, store);
      }
    } else if (resolver.type === 'flag') {
      row[key] = hasFlags(item, flagByValue, resolver.flags, resolver.orErrorMessage);
    } else if (resolver.type === 'toggle') {
      row[key] = {
        title: resolver.title,
        value: item[resolver.valueKey],
        action: resolver.action,
      };
    }
  }
  return row;
}

export function resolveFormFieldOptions(field, store, context = {}) {
  if (field.options) return field;
  const src = field.optionsSource;
  if (!src) return field;

  let rows = store.getters[`table/${src.table}/getAll`] || [];
  rows = rows.filter((r) => !r.deleted);

  if (src.filter) {
    rows = rows.filter((r) =>
      Object.entries(src.filter).every(([k, v]) => {
        if (k === 'enabled') return r.enabled === v && !r.deleted;
        return Array.isArray(v) ? v.includes(r[k]) : r[k] === v;
      })
    );
  }

  if (src.compatibleWithEvent && context.event) {
    const provided = new Set((context.event.configuration && context.event.configuration.provides) || []);
    rows = rows.filter((a) => {
      const required = (a.configuration && a.configuration.requires) || [];
      return required.every((key) => provided.has(key));
    });
  }

  const options = rows.map((r) => {
    let name = r.name;
    if (src.labelKey === 'configuration.label') {
      name = (r.configuration && r.configuration.label) || r.name;
    } else if (src.labelKey && r[src.labelKey]) {
      name = r[src.labelKey];
    } else if (src.nameKey && r[src.nameKey]) {
      name = r[src.nameKey];
    }
    return { name, value: r[src.valueKey] };
  });

  const resolved = { ...field, options: src.emptyOption ? [src.emptyOption, ...options] : options };
  return resolved;
}

export function resolveFormSchema(schema, store, context = {}) {
  return schema.map((field) => resolveFormFieldOptions(field, store, context));
}

export function rowToViewForm(row) {
  return {
    name: row.name,
    eventLabel: row.eventLabel,
    actionLabel: row.actionLabel,
    maxRetries: String(row.maxRetries),
    parallelLimit: String(row.parallelLimit),
    timeout: String(row.timeout),
    configurationJson: JSON.stringify(row.configuration || {}, null, 2),
  };
}

export function detailsToErrorForm(details) {
  const name = details.trigger && details.trigger.name;
  return {
    summary: `${name || '-'} — ${details.statusLabel || '-'}`,
    errorMessage: (details.item && details.item.errorMessage) || 'No error message recorded.',
  };
}
