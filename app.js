// app.js: loads the CSV files and shows the results. The math lives in ccc.js.

const days = (n) => n.toFixed(2);
const dollars = (n) => {
  const rounded = Math.round(n);
  const text = "$" + Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? "−" + text : text;
};
const signedDays = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2);

function row(label, cells, className) {
  const tr = document.createElement("tr");
  if (className) tr.className = className;
  [label, ...cells].forEach((text) => {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  });
  return tr;
}

async function loadText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Could not load " + path);
  return response.text();
}

async function start() {
  const status = document.getElementById("status");
  try {
    const [statementText, assumptionText] = await Promise.all([
      loadText("data/electromart.csv"),
      loadText("data/assumptions.csv"),
    ]);

    const statements = CCC.statementsFrom(CCC.parseCsv(statementText));
    const assumptions = CCC.assumptionsFrom(CCC.parseCsv(assumptionText));
    const daysInYear = assumptions.days_in_year;

    const before = CCC.daysFor(statements.before, daysInYear);
    const after = CCC.daysFor(statements.after, daysInYear);
    const freed = CCC.cashFreed(statements.before, statements.after);

    const daysBody = document.getElementById("days-body");
    [
      ["DIO (inventory days)", "dio"],
      ["DSO (receivable days)", "dso"],
      ["DPO (payable days)", "dpo"],
    ].forEach(([label, key]) => {
      daysBody.appendChild(row(label, [
        days(before[key]), days(after[key]), signedDays(after[key] - before[key]),
      ]));
    });
    daysBody.appendChild(row("Cash conversion cycle", [
      days(before.ccc), days(after.ccc), signedDays(after.ccc - before.ccc),
    ], "total"));

    const cashBody = document.getElementById("cash-body");
    cashBody.appendChild(row("By inventory", [dollars(freed.inventory)]));
    cashBody.appendChild(row("By receivables", [dollars(freed.receivables)]));
    cashBody.appendChild(row("By payables", [dollars(freed.payables)]));
    cashBody.appendChild(row("Total", [dollars(freed.total)], "total"));

    document.getElementById("days-section").hidden = false;
    document.getElementById("cash-section").hidden = false;
    status.hidden = true;
  } catch (err) {
    status.textContent = "Something went wrong: " + err.message;
    status.className = "error";
  }
}

start();
