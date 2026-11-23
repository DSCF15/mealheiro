import { icon } from './icons.js';
import {
  METHODS, addMonths, balance, billPayment, debtPaid, debtRemaining, defaultState, dueDate, fmt, goalSaved, isValidDate,
  monthOf, normalize, parseMoney, today, uid,
} from './logic.js';
import { commit, configureStore, getState, loadState, replaceState } from './store.js';
import { csvBlob, fileName, saveFile, toJSONBlob, toXLSX } from './export.js';
import { TABS, renderNav, renderView, txResults } from './views.js';
import * as S from './sheets.js';

const $view = document.getElementById('view');
const $nav = document.getElementById('nav');
const $sheet = document.getElementById('sheet');
document.getElementById('fab').innerHTML = icon('plus', 28);

const initialTab = location.hash.slice(1);
const ui = {
  tab: TABS.some(([id]) => id === initialTab) ? initialTab : 'home',
  txMonth: monthOf(today()), txCat: 'all', txType: 'all', q: '',
  budgetTab: 'pots', budgetMonth: monthOf(today()), debtTab: 'owed',
};

function render() {
  const s = getState();
  $view.innerHTML = renderView(s, ui);
  $nav.innerHTML = renderNav(ui.tab);
  const top = stack[stack.length - 1];
  if (top?.live) {
    if (top.exists && !top.exists()) popSheet();
    else paintSheet();
  }
}

/* ---------- Painéis, integrados com o botão "voltar" do Android ---------- */
const stack = [];
let ignorePop = 0;

function paintSheet() {
  const top = stack[stack.length - 1];
  if (!top) {
    if ($sheet.open) $sheet.close();
    $sheet.innerHTML = '';
    return;
  }
  const scroll = $sheet.scrollTop;
  $sheet.innerHTML = top.render();
  if (!$sheet.open) $sheet.showModal();
  $sheet.scrollTop = top.live ? scroll : 0;
  ($sheet.querySelector('[autofocus]'))?.focus();
}
function openSheet(renderFn, opts = {}) {
  if (!stack.length && !ignorePop) history.pushState({ sheet: true }, '');
  stack.push({ render: renderFn, ...opts });
  paintSheet();
}
function popSheet() {
  stack.pop();
  if (!stack.length) {
    ignorePop += 1;
    history.back();
  }
  paintSheet();
}
const closeAll = () => {
  if (!stack.length) return;
  stack.length = 0;
  ignorePop += 1;
  history.back();
  paintSheet();
};
window.addEventListener('popstate', () => {
  if (ignorePop) {
    ignorePop -= 1;
    if (stack.length) history.pushState({ sheet: true }, '');
    return;
  }
  if (stack.length) {
    stack.pop();
    if (stack.length) history.pushState({ sheet: true }, '');
    paintSheet();
  }
});
$sheet.addEventListener('cancel', (e) => { e.preventDefault(); popSheet(); });
$sheet.addEventListener('click', (e) => { if (e.target === $sheet) popSheet(); });

let pendingConfirm = null;
function ask(opts, onYes) {
  pendingConfirm = onYes;
  openSheet(() => S.confirmSheet(opts));
}

/* ---------- Avisos ---------- */
let toastTimer;
function toast(message, undo) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.append(Object.assign(document.createElement('span'), { textContent: message }));
  if (undo) {
    const b = Object.assign(document.createElement('button'), { textContent: 'Anular', type: 'button' });
    b.addEventListener('click', () => { undo(); el.remove(); });
    el.append(b);
  }
  ($sheet.open ? $sheet : document.body).append(el);
  toastTimer = setTimeout(() => el.remove(), undo ? 6000 : 3200);
}
function fail(form, message) {
  const el = form.querySelector('.form-error');
  el.textContent = message;
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest' });
}

const find = {
  tx: (id) => getState().transactions.find((t) => t.id === id),
  bill: (id) => getState().bills.find((b) => b.id === id),
  debt: (id) => getState().debts.find((d) => d.id === id),
  goal: (id) => getState().goals.find((g) => g.id === id),
  cat: (id) => getState().categories.find((c) => c.id === id),
  pot: (id) => getState().budget.pots.find((p) => p.id === id),
};
const newTx = (fields) => ({
  id: uid(), description: '', categoryId: null, method: '', link: null, createdAt: Date.now(), ...fields,
});
const lastMethod = () => {
  const list = getState().transactions.filter((t) => t.method && !t.link);
  return list.length ? list.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)).method : METHODS[0];
};

function syncDebtPrincipal(s, debt) {
  const idx = s.transactions.findIndex((t) => t.link?.kind === 'debt' && t.link.id === debt.id && t.link.role === 'principal');
  if (!debt.affectsBalance) {
    if (idx >= 0) s.transactions.splice(idx, 1);
    return;
  }
  const fields = {
    type: 'transfer', flow: debt.direction === 'owed' ? 'out' : 'in', amount: debt.total, date: debt.date,
    description: debt.direction === 'owed' ? `Emprestado a ${debt.person}` : `Emprestado por ${debt.person}`,
  };
  if (idx >= 0) Object.assign(s.transactions[idx], fields);
  else s.transactions.push(newTx({ ...fields, link: { kind: 'debt', id: debt.id, role: 'principal' } }));
}

function toggleBill(id, period) {
  const bill = find.bill(id);
  const payment = billPayment(getState(), id, period);
  if (payment) {
    const undo = commit((s) => { s.transactions = s.transactions.filter((t) => t.id !== payment.id); });
    toast(`${bill.name} marcado como não pago`, undo);
    return;
  }
  const date = period === monthOf(today()) ? today() : dueDate(period, bill.dueDay);
  const undo = commit((s) => {
    s.transactions.push(newTx({
      type: 'expense', amount: bill.amount, date, description: bill.name, categoryId: bill.categoryId, method: bill.method,
      link: { kind: 'bill', id: bill.id, period },
    }));
  });
  toast(`${bill.name} pago: −${fmt(bill.amount)}`, undo);
}

const applyTheme = () => {
  const { theme } = getState().settings;
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#0d0d0d' : '#f5f5f2';
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

async function exportFile(blob, ext, isBackup) {
  try {
    const saved = await saveFile(blob, fileName(ext));
    if (!saved) return;
    if (isBackup) commit((s) => { s.settings.lastBackup = today(); });
    toast('Ficheiro exportado');
  } catch {
    toast('Não foi possível exportar o ficheiro');
  }
}

const sheetFor = {
  debt: (id) => openSheet(() => S.debtSheet(getState(), find.debt(id)), { live: true, exists: () => Boolean(find.debt(id)) }),
  goal: (id) => openSheet(() => S.goalSheet(getState(), find.goal(id)), { live: true, exists: () => Boolean(find.goal(id)) }),
  categories: () => openSheet(() => S.categoriesSheet(getState()), { live: true }),
  settings: () => openSheet(() => S.settingsSheet(getState()), { live: true }),
};

/* ---------- Ações ---------- */
const actions = {
  tab(el) {
    ui.tab = el.dataset.value;
    history.replaceState(history.state, '', `#${ui.tab}`);
    render();
    scrollTo(0, 0);
  },
  'go-bills': () => {
    ui.tab = 'budget'; ui.budgetTab = 'bills'; ui.budgetMonth = monthOf(today());
    history.replaceState(history.state, '', '#budget');
    render();
    scrollTo(0, 0);
  },
  close: () => popSheet(),
  'confirm-yes': () => {
    const fn = pendingConfirm;
    pendingConfirm = null;
    popSheet();
    fn?.();
  },
  month(el) {
    const key = el.dataset.target === 'tx' ? 'txMonth' : 'budgetMonth';
    ui[key] = addMonths(ui[key], Number(el.dataset.delta));
    render();
  },
  'tx-all-months': () => { ui.txMonth = ui.txMonth === 'all' ? monthOf(today()) : 'all'; render(); },
  'tx-type': (el) => { ui.txType = el.dataset.value; render(); },
  'budget-tab': (el) => { ui.budgetTab = el.dataset.value; render(); },
  'debt-tab': (el) => { ui.debtTab = el.dataset.value; render(); },
  donut(el) {
    const wrap = el.closest('.donut-wrap');
    const i = el.dataset.i;
    const row = wrap.querySelector(`.legend button[data-i="${i}"]`);
    const wasActive = row.classList.contains('active');
    wrap.querySelectorAll('.active').forEach((n) => n.classList.remove('active'));
    wrap.querySelectorAll('.legend button').forEach((n) => n.setAttribute('aria-pressed', 'false'));
    const ring = wrap.querySelector('.donut');
    ring.classList.toggle('has-active', !wasActive);
    if (wasActive) {
      wrap.querySelector('.donut-center .n').textContent = 'Total gasto';
      wrap.querySelector('.donut-center .a').textContent = wrap.dataset.total;
      return;
    }
    row.classList.add('active');
    row.setAttribute('aria-pressed', 'true');
    wrap.querySelector(`circle[data-i="${i}"]`).classList.add('active');
    wrap.querySelector('.donut-center .n').textContent = row.dataset.name;
    wrap.querySelector('.donut-center .a').textContent = row.dataset.value;
  },

  'new-tx': () => openSheet(() => S.txSheet(getState(), { method: lastMethod() })),
  'open-tx': (el) => {
    const tx = find.tx(el.dataset.id);
    if (!tx) return;
    if (tx.type === 'transfer') openSheet(() => S.linkedTxSheet(getState(), tx));
    else openSheet(() => S.txSheet(getState(), { tx }));
  },
  'delete-tx': (el) => {
    const { id } = el.dataset;
    popSheet();
    const undo = commit((s) => { s.transactions = s.transactions.filter((t) => t.id !== id); });
    toast('Movimento apagado', undo);
  },

  settings: () => sheetFor.settings(),
  'opening-balance': () => openSheet(() => S.openingSheet(getState())),
  theme: (el) => { commit((s) => { s.settings.theme = el.dataset.value; }); applyTheme(); },
  'export-json': () => exportFile(toJSONBlob({ ...getState(), settings: { ...getState().settings, lastBackup: today() } }), 'json', true),
  'export-csv': () => exportFile(csvBlob(getState()), 'csv'),
  'export-xlsx': () => exportFile(toXLSX(getState()), 'xlsx'),
  wipe: () => ask({
    title: 'Apagar todos os dados?',
    text: 'Todos os movimentos, dívidas, cofres e definições serão removidos deste dispositivo. Faz um backup antes, se quiseres guardá-los.',
    confirm: 'Apagar tudo',
  }, () => {
    const undo = replaceState(defaultState());
    applyTheme();
    closeAll();
    toast('Dados apagados', () => { undo(); applyTheme(); });
  }),

  categories: () => sheetFor.categories(),
  'new-category': () => openSheet(() => S.categorySheet(getState())),
  'edit-category': (el) => { const c = find.cat(el.dataset.id); openSheet(() => S.categorySheet(getState(), c)); },
  'delete-category': (el) => {
    const { id } = el.dataset;
    const c = find.cat(id);
    const n = getState().transactions.filter((t) => t.categoryId === id).length;
    ask({ title: `Apagar "${c.name}"?`, text: n ? `${n} movimento(s) ficam sem categoria. Os valores não mudam.` : 'Esta categoria não tem movimentos.' }, () => {
      popSheet();
      const undo = commit((s) => {
        s.categories = s.categories.filter((x) => x.id !== id);
        s.transactions.forEach((t) => { if (t.categoryId === id) t.categoryId = null; });
        s.bills.forEach((b) => { if (b.categoryId === id) b.categoryId = null; });
        s.budget.pots.forEach((p) => { p.categoryIds = p.categoryIds.filter((x) => x !== id); });
      });
      toast('Categoria apagada', undo);
    });
  },

  'edit-income': () => openSheet(() => S.incomeSheet(getState())),
  'new-pot': () => openSheet(() => S.potSheet(getState())),
  'edit-pot': (el) => { const p = find.pot(el.dataset.id); openSheet(() => S.potSheet(getState(), p)); },
  'delete-pot': (el) => {
    const { id } = el.dataset;
    ask({ title: `Apagar "${find.pot(id).name}"?`, text: 'As categorias deixam de estar associadas a este pote. Os movimentos não mudam.' }, () => {
      popSheet();
      const undo = commit((s) => { s.budget.pots = s.budget.pots.filter((p) => p.id !== id); });
      toast('Pote apagado', undo);
    });
  },

  'new-bill': () => openSheet(() => S.billSheet(getState())),
  'edit-bill': (el) => { const b = find.bill(el.dataset.id); openSheet(() => S.billSheet(getState(), b)); },
  'toggle-bill': (el) => toggleBill(el.dataset.id, el.dataset.period),
  'delete-bill': (el) => {
    const { id } = el.dataset;
    ask({ title: `Apagar "${find.bill(id).name}"?`, text: 'Deixa de aparecer nos próximos meses. Os pagamentos já registados mantêm-se nos movimentos.' }, () => {
      popSheet();
      const undo = commit((s) => {
        s.bills = s.bills.filter((b) => b.id !== id);
        s.transactions.forEach((t) => { if (t.link?.kind === 'bill' && t.link.id === id) t.link = null; });
      });
      toast('Pagamento apagado', undo);
    });
  },

  'new-debt': () => openSheet(() => S.debtFormSheet(getState(), { direction: ui.debtTab })),
  'open-debt': (el) => {
    sheetFor.debt(el.dataset.id);
    if (el.dataset.replace) stack.splice(stack.length - 2, 1);
  },
  'edit-debt': (el) => { const debt = find.debt(el.dataset.id); openSheet(() => S.debtFormSheet(getState(), { debt })); },
  'delete-debt': (el) => {
    const { id } = el.dataset;
    const d = find.debt(id);
    ask({ title: `Apagar dívida de ${d.person}?`, text: 'A dívida e os movimentos associados são removidos, e o saldo é recalculado.' }, () => {
      const undo = commit((s) => {
        s.debts = s.debts.filter((x) => x.id !== id);
        s.transactions = s.transactions.filter((t) => !(t.link?.kind === 'debt' && t.link.id === id));
      });
      toast('Dívida apagada', undo);
    });
  },
  'delete-payment': (el) => {
    const { debt: debtId, id } = el.dataset;
    const undo = commit((s) => {
      const d = s.debts.find((x) => x.id === debtId);
      d.payments = d.payments.filter((p) => p.id !== id);
      s.transactions = s.transactions.filter((t) => t.link?.paymentId !== id);
    });
    toast('Pagamento removido', undo);
  },
  'fill-amount': (el) => { el.closest('form').elements.amount.value = el.dataset.value; },
  'add-amount': (el) => {
    const input = el.closest('form').elements.amount;
    const now = parseMoney(input.value, { allowZero: true }) || 0;
    input.value = ((now + Number(el.dataset.value) * 100) / 100).toFixed(2).replace('.', ',');
  },

  'new-goal': () => openSheet(() => S.goalFormSheet(getState())),
  'open-goal': (el) => {
    sheetFor.goal(el.dataset.id);
    if (el.dataset.replace) stack.splice(stack.length - 2, 1);
  },
  'edit-goal': (el) => { const g = find.goal(el.dataset.id); openSheet(() => S.goalFormSheet(getState(), g)); },
  'goal-move': (el) => {
    const { id, dir } = el.dataset;
    openSheet(() => S.goalMoveSheet(getState(), find.goal(id), dir));
  },
  'delete-goal': (el) => {
    const { id } = el.dataset;
    const g = find.goal(id);
    const moved = goalSaved(getState(), g) - g.initial;
    ask({
      title: `Apagar "${g.name}"?`,
      text: moved > 0 ? `${fmt(moved)} depositados neste cofre voltam ao saldo principal.` : 'O cofre e o respetivo histórico são removidos.',
    }, () => {
      const undo = commit((s) => {
        s.goals = s.goals.filter((x) => x.id !== id);
        s.transactions = s.transactions.filter((t) => !(t.link?.kind === 'goal' && t.link.id === id));
      });
      toast('Cofre apagado', undo);
    });
  },
  'delete-goal-move': (el) => {
    const t = find.tx(el.dataset.id);
    const g = find.goal(t.link.id);
    if (t.flow === 'out' && goalSaved(getState(), g) < t.amount) {
      toast('Não é possível: o cofre ficaria negativo');
      return;
    }
    const undo = commit((s) => { s.transactions = s.transactions.filter((x) => x.id !== t.id); });
    toast('Movimento removido', undo);
  },
};

/* ---------- Formulários ---------- */
const forms = {
  tx(data, form) {
    const amount = parseMoney(data.get('amount'));
    const date = data.get('date');
    if (amount == null) return fail(form, 'Indica um valor válido, por exemplo 12,50.');
    if (!isValidDate(date)) return fail(form, 'Indica uma data válida.');
    const id = data.get('id');
    const fields = {
      type: data.get('type'), amount, date, description: data.get('description').trim(),
      categoryId: data.get('categoryId') || null, method: data.get('method'),
    };
    popSheet();
    if (id) commit((s) => { Object.assign(s.transactions.find((t) => t.id === id), fields); });
    const undo = id ? null : commit((s) => { s.transactions.push(newTx(fields)); });
    toast(id ? 'Movimento atualizado' : `${fields.type === 'income' ? 'Receita' : 'Despesa'} de ${fmt(amount)} registada`, undo);
    return undefined;
  },
  opening(data, form) {
    const raw = String(data.get('amount')).trim();
    const value = raw ? parseMoney(raw, { allowNegative: true, allowZero: true }) : 0;
    if (value == null) return fail(form, 'Indica um valor válido.');
    popSheet();
    commit((s) => { s.settings.openingBalance = value; s.settings.onboarded = true; });
    toast('Saldo inicial guardado');
    return undefined;
  },
  category(data, form) {
    const name = data.get('name').trim();
    const id = data.get('id');
    const kind = data.get('kind');
    if (!name) return fail(form, 'Dá um nome à categoria.');
    const clash = getState().categories.some((c) => c.id !== id && c.kind === kind && c.name.toLowerCase() === name.toLowerCase());
    if (clash) return fail(form, 'Já existe uma categoria com esse nome.');
    const fields = { name, kind, icon: data.get('icon'), color: data.get('color') };
    popSheet();
    commit((s) => {
      if (id) {
        Object.assign(s.categories.find((c) => c.id === id), fields);
        if (kind === 'income') s.budget.pots.forEach((p) => { p.categoryIds = p.categoryIds.filter((x) => x !== id); });
      } else s.categories.push({ id: uid(), ...fields });
    });
    toast('Categoria guardada');
    return undefined;
  },
  income(data, form) {
    const raw = String(data.get('amount')).trim();
    const value = raw ? parseMoney(raw, { allowZero: true }) : 0;
    if (value == null) return fail(form, 'Indica um valor válido.');
    popSheet();
    commit((s) => { s.budget.income = value; });
    toast('Rendimento atualizado');
    return undefined;
  },
  pot(data, form) {
    const name = data.get('name').trim();
    const mode = data.get('mode');
    if (!name) return fail(form, 'Dá um nome ao pote.');
    const parsed = parseMoney(data.get('value'), { allowZero: true });
    if (parsed == null) return fail(form, mode === 'percent' ? 'Indica uma percentagem entre 0 e 100.' : 'Indica um valor válido.');
    const value = mode === 'percent' ? parsed / 100 : parsed;
    if (mode === 'percent' && value > 100) return fail(form, 'A percentagem não pode passar de 100.');
    const id = data.get('id') || uid();
    const categoryIds = data.getAll('categoryIds');
    const fields = { name, mode, value, color: data.get('color'), isSavings: data.get('isSavings') === 'on', categoryIds };
    popSheet();
    commit((s) => {
      s.budget.pots.forEach((p) => { if (p.id !== id) p.categoryIds = p.categoryIds.filter((c) => !categoryIds.includes(c)); });
      const pot = s.budget.pots.find((p) => p.id === id);
      if (pot) Object.assign(pot, fields);
      else s.budget.pots.push({ id, ...fields });
    });
    toast('Pote guardado');
    return undefined;
  },
  bill(data, form) {
    const name = data.get('name').trim();
    const amount = parseMoney(data.get('amount'));
    const dueDay = Number(data.get('dueDay'));
    if (!name) return fail(form, 'Dá um nome ao pagamento.');
    if (amount == null) return fail(form, 'Indica um valor válido.');
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return fail(form, 'O dia de vencimento deve estar entre 1 e 31.');
    const id = data.get('id');
    const fields = { name, amount, dueDay, categoryId: data.get('categoryId') || null, method: data.get('method') };
    popSheet();
    commit((s) => {
      if (id) Object.assign(s.bills.find((b) => b.id === id), fields);
      else s.bills.push({ id: uid(), ...fields, startMonth: monthOf(today()), createdOn: today() });
    });
    toast('Pagamento guardado');
    return undefined;
  },
  debt(data, form) {
    const person = data.get('person').trim();
    const total = parseMoney(data.get('total'));
    const date = data.get('date');
    if (!person) return fail(form, 'Indica o nome da pessoa.');
    if (total == null) return fail(form, 'Indica um valor válido.');
    if (!isValidDate(date)) return fail(form, 'Indica uma data válida.');
    const id = data.get('id');
    const existing = id ? find.debt(id) : null;
    if (existing && total < debtPaid(existing)) return fail(form, `O total não pode ser inferior ao já pago (${fmt(debtPaid(existing))}).`);
    const fields = {
      person, total, date, reason: data.get('reason').trim(), direction: data.get('direction'),
      affectsBalance: data.get('affectsBalance') === 'on',
    };
    popSheet();
    commit((s) => {
      let debt = s.debts.find((d) => d.id === id);
      if (debt) Object.assign(debt, fields);
      else {
        debt = { id: uid(), ...fields, payments: [] };
        s.debts.push(debt);
      }
      syncDebtPrincipal(s, debt);
    });
    if (id) toast('Dívida atualizada');
    else { ui.debtTab = fields.direction; render(); toast('Dívida registada'); }
    return undefined;
  },
  payment(data, form) {
    const id = data.get('id');
    const debt = find.debt(id);
    const amount = parseMoney(data.get('amount'));
    const date = data.get('date');
    if (amount == null) return fail(form, 'Indica um valor válido.');
    if (!isValidDate(date)) return fail(form, 'Indica uma data válida.');
    const left = debtRemaining(debt);
    if (amount > left) return fail(form, `O valor não pode ser superior ao que falta (${fmt(left)}).`);
    const undo = commit((s) => {
      const d = s.debts.find((x) => x.id === id);
      const paymentId = uid();
      d.payments.push({ id: paymentId, amount, date, note: '' });
      s.transactions.push(newTx({
        type: 'transfer', flow: d.direction === 'owed' ? 'in' : 'out', amount, date,
        description: d.direction === 'owed' ? `Recebido de ${d.person}` : `Pago a ${d.person}`,
        link: { kind: 'debt', id, paymentId },
      }));
    });
    toast(amount === left ? 'Dívida liquidada' : 'Pagamento registado', undo);
    return undefined;
  },
  goal(data, form) {
    const name = data.get('name').trim();
    const target = parseMoney(data.get('target'));
    const rawInitial = String(data.get('initial')).trim();
    const initial = rawInitial ? parseMoney(rawInitial, { allowZero: true }) : 0;
    if (!name) return fail(form, 'Dá um nome ao cofre.');
    if (target == null) return fail(form, 'Indica um valor alvo válido.');
    if (initial == null) return fail(form, 'Indica um valor válido em "Já poupado".');
    const id = data.get('id');
    const existing = id ? find.goal(id) : null;
    if (existing && goalSaved(getState(), existing) - existing.initial + initial < 0) {
      return fail(form, 'Esse valor deixaria o cofre negativo.');
    }
    const fields = { name, target, initial, icon: data.get('icon'), color: data.get('color') };
    popSheet();
    commit((s) => {
      if (id) Object.assign(s.goals.find((g) => g.id === id), fields);
      else s.goals.push({ id: uid(), ...fields });
    });
    toast('Cofre guardado');
    return undefined;
  },
  'goal-move': (data, form) => {
    const id = data.get('id');
    const dir = data.get('dir');
    const goal = find.goal(id);
    const amount = parseMoney(data.get('amount'));
    if (amount == null) return fail(form, 'Indica um valor válido.');
    if (dir === 'in' && amount > balance(getState())) return fail(form, `Saldo insuficiente. Tens ${fmt(balance(getState()))} disponíveis.`);
    if (dir === 'out' && amount > goalSaved(getState(), goal)) return fail(form, `O cofre só tem ${fmt(goalSaved(getState(), goal))}.`);
    popSheet();
    const undo = commit((s) => {
      s.transactions.push(newTx({
        type: 'transfer', flow: dir === 'in' ? 'out' : 'in', amount, date: today(),
        description: dir === 'in' ? `Depósito em ${goal.name}` : `Retirada de ${goal.name}`,
        link: { kind: 'goal', id },
      }));
    });
    toast(dir === 'in' ? `${fmt(amount)} guardados em ${goal.name}` : `${fmt(amount)} devolvidos ao saldo`, undo);
    return undefined;
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) actions[el.dataset.action]?.(el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form](new FormData(form), form);
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'tx-search') return;
  ui.q = e.target.value;
  document.getElementById('tx-results').innerHTML = txResults(getState(), ui);
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'tx-cat') {
    ui.txCat = t.value;
    document.getElementById('tx-results').innerHTML = txResults(getState(), ui);
  }
  if (t.name === 'type' && t.form?.dataset.form === 'tx') {
    t.form.querySelectorAll('#tx-cats [data-kind]').forEach((chip) => {
      chip.hidden = chip.dataset.kind !== t.value;
      if (chip.hidden && chip.querySelector('input').checked) {
        t.form.querySelector('#tx-cats input[value=""]').checked = true;
      }
    });
  }
  if (t.name === 'mode' && t.form?.dataset.form === 'pot') {
    t.form.querySelector('#pot-value-label').textContent = t.value === 'percent' ? 'Percentagem (%)' : 'Valor (€)';
  }
  if (t.id === 'import-file' && t.files[0]) {
    const file = t.files[0];
    t.value = '';
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('too large');
      const parsed = normalize(JSON.parse(await file.text()));
      ask({
        title: 'Restaurar backup?',
        text: `Os dados atuais serão substituídos por ${parsed.transactions.length} movimentos, ${parsed.debts.length} dívidas e ${parsed.goals.length} cofres.`,
        confirm: 'Restaurar',
      }, () => {
        const undo = replaceState(parsed);
        applyTheme();
        closeAll();
        toast('Backup restaurado', () => { undo(); applyTheme(); });
      });
    } catch {
      toast('Ficheiro de backup inválido');
    }
  }
});

/* ---------- Arranque ---------- */
configureStore({ onChange: render, onError: (m) => toast(m) });
loadState();
applyTheme();
render();
if (new URLSearchParams(location.search).has('novo')) {
  history.replaceState(null, '', location.pathname);
  actions['new-tx']();
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      navigator.storage?.persist?.();
      const offerUpdate = (worker) => toastUpdate(worker);
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !updateAccepted) return;
        reloading = true;
        location.reload();
      });
    } catch { /* a app continua a funcionar sem cache offline */ }
  });
}
let updateAccepted = false;
function toastUpdate(worker) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.append(Object.assign(document.createElement('span'), { textContent: 'Nova versão disponível' }));
  const b = Object.assign(document.createElement('button'), { textContent: 'Atualizar', type: 'button' });
  b.addEventListener('click', () => { updateAccepted = true; worker.postMessage('skipWaiting'); el.remove(); });
  el.append(b);
  document.body.append(el);
}
