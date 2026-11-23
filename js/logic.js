// Regras de negócio puras. Todos os valores monetários são inteiros em cêntimos.

export const METHODS = ['Cartão de débito', 'Cartão de crédito', 'MB WAY', 'Numerário', 'Transferência', 'Débito direto'];
export const COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
export const CATEGORY_ICONS = [
  'cart', 'house', 'car', 'heart', 'film', 'bag', 'book', 'repeat', 'wallet', 'gift', 'plane', 'coffee',
  'bolt', 'phone', 'dumbbell', 'paw', 'briefcase', 'star', 'umbrella', 'target', 'shield', 'safe',
  'pizza', 'hammer', 'laptop',
];
const INCOME_SOURCES = [
  { id: 'cat-pizzeria', name: 'Pizzaria', icon: 'pizza', color: 'orange', kind: 'income' },
  { id: 'cat-works', name: 'Obras', icon: 'hammer', color: 'yellow', kind: 'income' },
  { id: 'cat-digital', name: 'Produtos digitais', icon: 'laptop', color: 'violet', kind: 'income' },
];
export const MAX_CENTS = 99999999999;

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const pad = (n) => String(n).padStart(2, '0');

// Datas locais: nunca usar toISOString, que converte para UTC e pode mudar o dia.
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISO(new Date());
export const monthOf = (iso) => iso.slice(0, 7);
export const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const dueDate = (month, day) => `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
const utc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 86400000);
export const isValidDate = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d);
  return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d;
};

const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export const fmt = (cents) => euro.format((cents || 0) / 100);
export const fmtPlain = (cents) => ((cents || 0) / 100).toFixed(2).replace('.', ',');
export const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-PT', opts).format(new Date(y, m - 1, d));
};
export const fmtMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  const s = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return s[0].toUpperCase() + s.slice(1);
};

/** Aceita "12,50", "1.234,56", "1 234,56", "12.50" e "1.234". Devolve cêntimos ou null. */
export function parseMoney(input, { allowNegative = false, allowZero = false } = {}) {
  let s = String(input ?? '').trim().replace(/[€\s ]/g, '');
  if (!s) return null;
  let sign = 1;
  if (s[0] === '-' || s[0] === '−') {
    if (!allowNegative) return null;
    sign = -1;
    s = s.slice(1);
  }
  if (s.includes(',')) {
    if (!/^(\d+|\d{1,3}(\.\d{3})+),\d{0,2}$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (!/^\d+(\.\d{0,2})?$/.test(s)) {
    return null;
  }
  const [whole, dec = ''] = s.split('.');
  const cents = Number(whole) * 100 + Number(dec.padEnd(2, '0') || 0);
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  if (cents === 0 && !allowZero) return null;
  return cents === 0 ? 0 : sign * cents;
}

export const signed = (tx) => {
  if (tx.type === 'income') return tx.amount;
  if (tx.type === 'expense') return -tx.amount;
  return tx.flow === 'in' ? tx.amount : -tx.amount;
};
export const balance = (s) => s.transactions.reduce((sum, t) => sum + signed(t), s.settings.openingBalance);
export const sortTx = (list) => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

export function monthTotals(s, month) {
  let income = 0;
  let expense = 0;
  for (const t of s.transactions) {
    if (monthOf(t.date) !== month) continue;
    if (t.type === 'income') income += t.amount;
    if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/** Distribuição de gastos: no máximo 6 fatias, as restantes juntam-se em "Outras". */
export function spendByCategory(s, month) {
  const totals = new Map();
  for (const t of s.transactions) {
    if (t.type !== 'expense' || monthOf(t.date) !== month) continue;
    const key = t.categoryId || 'none';
    totals.set(key, (totals.get(key) || 0) + t.amount);
  }
  const rows = [...totals].map(([id, value]) => {
    const c = s.categories.find((x) => x.id === id);
    return { id, value, name: c?.name || 'Sem categoria', color: c?.color || 'none', icon: c?.icon || 'tag' };
  }).sort((a, b) => b.value - a.value);
  if (rows.length <= 6) return rows;
  const rest = rows.slice(5);
  return [...rows.slice(0, 5), {
    id: 'other', name: `Outras (${rest.length})`, color: 'none', icon: 'tag',
    value: rest.reduce((sum, r) => sum + r.value, 0),
  }];
}

export const billPayment = (s, billId, period) => s.transactions.find(
  (t) => t.link?.kind === 'bill' && t.link.id === billId && t.link.period === period,
);

export function billStatus(s, bill, period, now = today()) {
  const payment = billPayment(s, bill.id, period);
  const due = dueDate(period, bill.dueDay);
  const diff = daysBetween(now, due);
  if (payment) return { state: 'paid', due, diff, payment };
  if (diff < 0 && due >= bill.createdOn) return { state: 'overdue', due, diff };
  if (diff >= 0 && diff <= 7) return { state: 'soon', due, diff };
  return { state: 'pending', due, diff };
}

export function upcomingBills(s, now = today(), days = 7) {
  const current = monthOf(now);
  const out = [];
  for (const bill of s.bills) {
    for (let offset = -2; offset <= 1; offset += 1) {
      const period = addMonths(current, offset);
      if (period < bill.startMonth) continue;
      const st = billStatus(s, bill, period, now);
      if (st.state === 'overdue' || (st.state === 'soon' && st.diff <= days)) out.push({ bill, period, ...st });
    }
  }
  return out.sort((a, b) => a.diff - b.diff);
}

export const billsForMonth = (s, month) => s.bills
  .filter((b) => month >= b.startMonth)
  .map((bill) => ({ bill, period: month, ...billStatus(s, bill, month) }))
  .sort((a, b) => a.bill.dueDay - b.bill.dueDay);

/** Valor a distribuir: o que entrou no mês (variável) ou o rendimento definido (fixo). */
export const budgetBase = (s, month) => (s.budget.incomeMode === 'fixed' ? s.budget.income : monthTotals(s, month).income);
export const potAmount = (base, pot) => (pot.mode === 'percent' ? Math.round((base * pot.value) / 100) : pot.value);

export function incomeBySource(s, month) {
  const totals = new Map();
  for (const t of s.transactions) {
    if (t.type !== 'income' || monthOf(t.date) !== month) continue;
    const key = t.categoryId || 'none';
    totals.set(key, (totals.get(key) || 0) + t.amount);
  }
  return [...totals].map(([id, value]) => {
    const c = s.categories.find((x) => x.id === id);
    return { id, value, name: c?.name || 'Sem categoria', color: c?.color || 'none' };
  }).sort((a, b) => b.value - a.value);
}

export function potSpent(s, pot, month) {
  const cats = new Set(pot.categoryIds);
  let total = 0;
  for (const t of s.transactions) {
    if (monthOf(t.date) !== month) continue;
    if (t.type === 'expense' && cats.has(t.categoryId)) total += t.amount;
    if (pot.isSavings && t.type === 'transfer' && t.link?.kind === 'goal') total += t.flow === 'out' ? t.amount : -t.amount;
  }
  return Math.max(0, total);
}

export const unassignedSpend = (s, month) => {
  const assigned = new Set(s.budget.pots.flatMap((p) => p.categoryIds));
  return s.transactions
    .filter((t) => t.type === 'expense' && monthOf(t.date) === month && !assigned.has(t.categoryId))
    .reduce((sum, t) => sum + t.amount, 0);
};

export const goalMoves = (s, id) => sortTx(s.transactions.filter((t) => t.link?.kind === 'goal' && t.link.id === id));
export const goalSaved = (s, goal) => goalMoves(s, goal.id)
  .reduce((sum, t) => sum + (t.flow === 'out' ? t.amount : -t.amount), goal.initial);
export const totalSaved = (s) => s.goals.reduce((sum, g) => sum + goalSaved(s, g), 0);

export const debtPaid = (d) => d.payments.reduce((sum, p) => sum + p.amount, 0);
export const debtRemaining = (d) => Math.max(0, d.total - debtPaid(d));
export const debtTotals = (s, direction) => s.debts
  .filter((d) => d.direction === direction)
  .reduce((sum, d) => sum + debtRemaining(d), 0);

export const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

export function defaultState() {
  const cat = (id, name, icon, color, kind = 'expense') => ({ id, name, icon, color, kind });
  return {
    version: 1,
    settings: { theme: 'system', openingBalance: 0, lastBackup: null, onboarded: false, incomeSourcesAdded: true },
    categories: [
      cat('cat-food', 'Alimentação', 'cart', 'orange'),
      cat('cat-home', 'Casa', 'house', 'blue'),
      cat('cat-transport', 'Transporte', 'car', 'aqua'),
      cat('cat-health', 'Saúde', 'heart', 'red'),
      cat('cat-fun', 'Lazer', 'film', 'violet'),
      cat('cat-shopping', 'Compras', 'bag', 'magenta'),
      cat('cat-education', 'Educação', 'book', 'yellow'),
      cat('cat-subs', 'Subscrições', 'repeat', 'green'),
      ...INCOME_SOURCES.map((c) => ({ ...c })),
      cat('cat-salary', 'Salário', 'briefcase', 'green', 'income'),
      cat('cat-extra', 'Rendimentos extra', 'wallet', 'aqua', 'income'),
    ],
    transactions: [],
    budget: {
      income: 0,
      incomeMode: 'variable',
      pots: [
        { id: 'pot-needs', name: 'Necessidades', color: 'blue', mode: 'percent', value: 50, isSavings: false, categoryIds: ['cat-food', 'cat-home', 'cat-transport', 'cat-health', 'cat-education'] },
        { id: 'pot-wants', name: 'Desejos', color: 'violet', mode: 'percent', value: 30, isSavings: false, categoryIds: ['cat-fun', 'cat-shopping', 'cat-subs'] },
        { id: 'pot-savings', name: 'Poupança', color: 'green', mode: 'percent', value: 20, isSavings: true, categoryIds: [] },
      ],
    },
    bills: [],
    debts: [],
    goals: [],
  };
}

const isCents = (v) => Number.isSafeInteger(v) && v >= 0 && v <= MAX_CENTS;
const text = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 80 ? v : uid());
const color = (v) => (COLORS.includes(v) ? v : 'blue');
const icon = (v) => (CATEGORY_ICONS.includes(v) ? v : 'wallet');
const unique = (list) => {
  const seen = new Set();
  return list.filter((x) => (seen.has(x.id) ? false : seen.add(x.id)));
};

/** Valida dados vindos do armazenamento ou de um backup, descartando o que for inválido. */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1
    || !['categories', 'transactions', 'bills', 'debts', 'goals'].every((k) => Array.isArray(raw[k]))
    || !raw.budget || !Array.isArray(raw.budget.pots)) {
    throw new Error('Ficheiro de backup inválido.');
  }
  const categories = unique(raw.categories.filter((c) => c && text(c.name)).map((c) => ({
    id: id(c.id), name: text(c.name, 40), icon: icon(c.icon), color: color(c.color), kind: c.kind === 'income' ? 'income' : 'expense',
  })));
  // Migração única: acrescenta as fontes de rendimento sem repor as que forem apagadas depois.
  if (!raw.settings?.incomeSourcesAdded) {
    for (const source of INCOME_SOURCES) {
      const exists = categories.some((c) => c.id === source.id
        || (c.kind === 'income' && c.name.toLowerCase() === source.name.toLowerCase()));
      if (!exists) categories.push({ ...source });
    }
  }
  const catIds = new Set(categories.map((c) => c.id));
  const catRef = (v) => (catIds.has(v) ? v : null);

  const bills = unique(raw.bills.filter((b) => b && text(b.name) && isCents(b.amount) && b.amount > 0).map((b) => ({
    id: id(b.id), name: text(b.name, 60), amount: b.amount,
    dueDay: Math.min(31, Math.max(1, Number.parseInt(b.dueDay, 10) || 1)),
    categoryId: catRef(b.categoryId), method: METHODS.includes(b.method) ? b.method : METHODS[5],
    startMonth: /^\d{4}-\d{2}$/.test(b.startMonth) ? b.startMonth : monthOf(today()),
    createdOn: isValidDate(b.createdOn) ? b.createdOn : today(),
  })));

  const debts = unique(raw.debts.filter((d) => d && text(d.person) && isCents(d.total) && d.total > 0 && isValidDate(d.date)).map((d) => ({
    id: id(d.id), direction: d.direction === 'owe' ? 'owe' : 'owed', person: text(d.person, 60), total: d.total,
    reason: text(d.reason, 120), date: d.date, affectsBalance: Boolean(d.affectsBalance),
    payments: unique((Array.isArray(d.payments) ? d.payments : []).filter((p) => p && isCents(p.amount) && p.amount > 0 && isValidDate(p.date)).map((p) => ({
      id: id(p.id), amount: p.amount, date: p.date, note: text(p.note, 80),
    }))),
  })));

  const goals = unique(raw.goals.filter((g) => g && text(g.name) && isCents(g.target) && g.target > 0).map((g) => ({
    id: id(g.id), name: text(g.name, 40), target: g.target, initial: isCents(g.initial) ? g.initial : 0, icon: icon(g.icon), color: color(g.color),
  })));

  const links = {
    bill: new Set(bills.map((b) => b.id)), debt: new Set(debts.map((d) => d.id)), goal: new Set(goals.map((g) => g.id)),
  };
  const transactions = unique(raw.transactions
    .filter((t) => t && ['income', 'expense', 'transfer'].includes(t.type) && isCents(t.amount) && t.amount > 0 && isValidDate(t.date))
    .map((t) => {
      const link = t.link && links[t.link.kind]?.has(t.link.id)
        ? { kind: t.link.kind, id: t.link.id, ...(t.link.period ? { period: String(t.link.period) } : {}), ...(t.link.role ? { role: String(t.link.role) } : {}), ...(t.link.paymentId ? { paymentId: String(t.link.paymentId) } : {}) }
        : null;
      return {
        id: id(t.id), type: t.type, ...(t.type === 'transfer' ? { flow: t.flow === 'in' ? 'in' : 'out' } : {}),
        amount: t.amount, date: t.date, description: text(t.description), categoryId: catRef(t.categoryId),
        method: METHODS.includes(t.method) ? t.method : '', link, createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now(),
      };
    }));

  const pots = unique(raw.budget.pots.filter((p) => p && text(p.name)).map((p) => {
    const mode = p.mode === 'fixed' ? 'fixed' : 'percent';
    const value = mode === 'percent'
      ? Math.min(100, Math.max(0, Number(p.value) || 0))
      : (isCents(p.value) ? p.value : 0);
    return {
      id: id(p.id), name: text(p.name, 40), color: color(p.color), mode, value, isSavings: Boolean(p.isSavings),
      categoryIds: (Array.isArray(p.categoryIds) ? p.categoryIds : []).filter((c) => catIds.has(c)),
    };
  }));

  const st = raw.settings || {};
  return {
    version: 1,
    settings: {
      theme: ['light', 'dark'].includes(st.theme) ? st.theme : 'system',
      openingBalance: Number.isSafeInteger(st.openingBalance) ? st.openingBalance : 0,
      lastBackup: typeof st.lastBackup === 'string' ? st.lastBackup : null,
      onboarded: Boolean(st.onboarded),
      incomeSourcesAdded: true,
    },
    categories,
    transactions,
    budget: {
      income: isCents(raw.budget.income) ? raw.budget.income : 0,
      // Quem já definiu um rendimento fixo mantém esse modo.
      incomeMode: ['fixed', 'variable'].includes(raw.budget.incomeMode)
        ? raw.budget.incomeMode
        : (raw.budget.income > 0 ? 'fixed' : 'variable'),
      pots,
    },
    bills,
    debts,
    goals,
  };
}
