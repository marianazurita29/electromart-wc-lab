// app.js: loads the CSV files and shows the results. The math lives in ccc.js.

const days = (n) => n.toFixed(2);
const dollars = (n) => {
  const rounded = Math.round(n);
  const text = "$" + Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? "−" + text : text;
};
const signedDays = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2);
const percent = (rate) => (rate * 100).toFixed(2) + "%";

// Set up the three sliders and the two buttons, and redraw the results
// whenever a slider moves. All math is done in ccc.js.
function setupLevers(statements, assumptions, beforeDays, afterDays) {
  const keys = ["dio", "dso", "dpo"];
  const sliders = {};
  const outputs = {};

  keys.forEach((key) => {
    const slider = document.getElementById(key + "-slider");
    // The slider reaches 50% past the larger of Before and After, in steps of 10.
    const biggest = Math.max(beforeDays[key], afterDays[key]);
    slider.max = String(Math.ceil((biggest * 1.5) / 10) * 10);
    slider.step = "any";
    slider.addEventListener("input", render);
    sliders[key] = slider;
    outputs[key] = document.getElementById(key + "-out");
  });

  function currentDays() {
    return {
      dio: Number(sliders.dio.value),
      dso: Number(sliders.dso.value),
      dpo: Number(sliders.dpo.value),
    };
  }

  function setTo(target) {
    keys.forEach((key) => { sliders[key].value = String(target[key]); });
    render();
  }

  function render() {
    const d = currentDays();
    keys.forEach((key) => { outputs[key].textContent = days(d[key]); });

    const r = CCC.leverResults(d, statements.before, assumptions);

    document.getElementById("lever-ccc").textContent = days(r.ccc);
    document.getElementById("lever-ccc-change").textContent =
      "(" + signedDays(r.ccc - beforeDays.ccc) + " vs Before)";

    const balances = document.getElementById("lever-balances");
    balances.replaceChildren(
      row("Inventory", [dollars(r.balances.inventory), dollars(r.freed.inventory)]),
      row("Receivables", [dollars(r.balances.receivables), dollars(r.freed.receivables)]),
      row("Payables", [dollars(r.balances.payables), dollars(r.freed.payables)]),
      row("Total cash freed", ["", dollars(r.freed.total)], "total")
    );

    const terms = document.getElementById("lever-terms");
    const rows = [
      row("Interest saved per year at " + percent(assumptions.bank_rate) +
        " (assumes every freed dollar pays down the bank line)", [dollars(r.interestSaved)]),
      row("Days paid past the " + assumptions.net_days + "-day due date",
        [days(r.daysPastDue) + " days"]),
    ];
    if (r.takesDiscount) {
      rows.push(row("Cost of skipping the " + percent(assumptions.supplier_discount) +
        " discount", ["None: takes the discount"]));
    } else {
      rows.push(row("Annual cost of skipping the " + percent(assumptions.supplier_discount) +
        " discount", [percent(r.discountCost)]));
      rows.push(row("Discount given up each year", [dollars(r.discountGivenUp)]));
    }
    terms.replaceChildren(...rows);
  }

  document.getElementById("set-before").addEventListener("click", () => setTo(beforeDays));
  document.getElementById("set-after").addEventListener("click", () => setTo(afterDays));

  setTo(beforeDays);
  document.getElementById("levers-section").hidden = false;
}

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

    setupLevers(statements, assumptions, before, after);

    document.getElementById("days-section").hidden = false;
    document.getElementById("cash-section").hidden = false;
    status.hidden = true;
  } catch (err) {
    status.textContent = "Something went wrong: " + err.message;
    status.className = "error";
  }
}

start();
