// ccc.js: the finance math for the ElectroMart app.
// Plain functions only. Nothing here touches the page, so Node can test it.

// Split one CSV line into fields. Handles "quoted, fields" and "" escapes.
function splitCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// Turn CSV text into an array of objects keyed by the header row.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || "").trim(); });
    return row;
  });
}

// electromart.csv rows -> { before: {revenue, cogs, ...}, after: {...} }
function statementsFrom(rows) {
  const out = { before: {}, after: {} };
  rows.forEach((r) => {
    out.before[r.item] = Number(r.before);
    out.after[r.item] = Number(r.after);
  });
  return out;
}

// assumptions.csv rows -> { days_in_year: 365, bank_rate: 0.08, ... }
function assumptionsFrom(rows) {
  const out = {};
  rows.forEach((r) => { out[r.assumption] = Number(r.value); });
  return out;
}

// Days measures. Inputs are never rounded.
function dio(inventory, cogs, daysInYear) { return (inventory / cogs) * daysInYear; }
function dso(receivables, revenue, daysInYear) { return (receivables / revenue) * daysInYear; }
function dpo(payables, cogs, daysInYear) { return (payables / cogs) * daysInYear; }
function ccc(dioDays, dsoDays, dpoDays) { return dioDays + dsoDays - dpoDays; }

// Days measures for one column ("before" or "after") of the statements.
function daysFor(side, daysInYear) {
  const d1 = dio(side.inventory, side.cogs, daysInYear);
  const d2 = dso(side.accounts_receivable, side.revenue, daysInYear);
  const d3 = dpo(side.accounts_payable, side.cogs, daysInYear);
  return { dio: d1, dso: d2, dpo: d3, ccc: ccc(d1, d2, d3) };
}

// Cash freed by each lever, from the change in the balance sheet.
// An asset that falls frees cash. Accounts payable that rises frees cash.
function cashFreed(before, after) {
  const inventory = before.inventory - after.inventory;
  const receivables = before.accounts_receivable - after.accounts_receivable;
  const payables = after.accounts_payable - before.accounts_payable;
  return { inventory, receivables, payables, total: inventory + receivables + payables };
}

// ---- Levers -------------------------------------------------------------
// For the levers, revenue and COGS stay at their Before values.
// The balance a number of days implies is days x annual COGS (or revenue) / days in year.
function impliedBalances(d, before, daysInYear) {
  return {
    inventory: (d.dio * before.cogs) / daysInYear,
    receivables: (d.dso * before.revenue) / daysInYear,
    payables: (d.dpo * before.cogs) / daysInYear,
  };
}

// Everything the lever panel shows, for days d = { dio, dso, dpo }.
// before = the Before column of the statements, a = the assumptions.
function leverResults(d, before, a) {
  const n = a.days_in_year;
  const balances = impliedBalances(d, before, n);

  // Cash freed compared with Before: a lower asset or higher payables frees cash.
  const freed = {
    inventory: before.inventory - balances.inventory,
    receivables: before.accounts_receivable - balances.receivables,
    payables: balances.payables - before.accounts_payable,
  };
  freed.total = freed.inventory + freed.receivables + freed.payables;

  // Interest saved if every freed dollar pays down the bank line.
  // Only the Before bank balance can be paid off. Negative cash freed means
  // more borrowing, so the saving is negative.
  const interestSaved = Math.min(freed.total, before.notes_payable) * a.bank_rate;

  // Paying suppliers late, and the cost of skipping the discount.
  const daysPastDue = Math.max(0, d.dpo - a.net_days);
  const takesDiscount = d.dpo <= a.discount_days;
  const dsc = a.supplier_discount;
  const discountCost = takesDiscount
    ? null
    : ((dsc / (1 - dsc)) * n) / (d.dpo - a.discount_days);
  const discountGivenUp = takesDiscount ? 0 : dsc * before.cogs;

  return {
    ccc: ccc(d.dio, d.dso, d.dpo),
    balances, freed, interestSaved,
    daysPastDue, takesDiscount, discountCost, discountGivenUp,
  };
}

const CCC = {
  splitCsvLine, parseCsv, statementsFrom, assumptionsFrom,
  dio, dso, dpo, ccc, daysFor, cashFreed,
  impliedBalances, leverResults,
};

if (typeof module !== "undefined" && module.exports) module.exports = CCC;
else window.CCC = CCC;
