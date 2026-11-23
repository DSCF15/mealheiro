import { icon } from './icons.js';
import {
  balance, billsForMonth, debtPaid, debtRemaining, debtTotals, fmt, fmtDate, fmtMonth, goalSaved, monthOf, monthTotals,
  pct, potAmount, potSpent, signed, sortTx, spendByCategory, today, totalSaved, unassignedSpend, upcomingBills,
} from './logic.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
export const colorVar = (c) => `var(--c-${c || 'none'})`;
export const avatar = (name, color) => `<span class="avatar" style="background:${colorVar(color)}">${icon(name, 20)}</span>`;
export const bar = (value, tone = '', label = 'Progresso') => {
  const width = Math.min(100, Math.max(0, value));
  return `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(width)}"><i class="${tone}" style="width:${width}%"></i></div>`;
};
const monthNav = (target, month) => `<div class="month">
  <button class="icon-btn flat" data-action="month" data-target="${target}" data-delta="-1" aria-label="Mês anterior">${icon('chevL')}</button>
  <b>${fmtMonth(month)}</b>
  <button class="icon-btn flat" data-action="month" data-target="${target}" data-delta="1" aria-label="Mês seguinte">${icon('chevR')}</button>
</div>`;
const seg = (action, current, options) => `<div class="seg">${options.map(([v, l]) => `<button data-action="${action}" data-value="${v}" aria-pressed="${v === current}">${l}</button>`).join('')}</div>`;
const empty = (ic, title, text, btn = '') => `<div class="empty">${icon(ic, 30)}<b>${title}</b><span class="small">${text}</span>${btn}</div>`;

export function txRow(s, t) {
  const cat = s.categories.find((c) => c.id === t.categoryId);
  let ic = cat?.icon || 'tag';
  let color = cat?.color || 'none';
  let sub = cat?.name || 'Sem categoria';
  let tone = t.type === 'income' ? 'good' : 'bad';
  if (t.type === 'transfer') {
    const isGoal = t.link?.kind === 'goal';
    ic = isGoal ? 'safe' : 'users';
    color = isGoal ? 'green' : 'orange';
    sub = isGoal ? 'Poupança' : 'Dívida';
    tone = isGoal || t.flow === 'in' ? 'good' : 'warn';
  }
  const value = signed(t);
  const title = t.description || sub;
  return `<button class="row" data-action="open-tx" data-id="${esc(t.id)}">
    ${avatar(ic, color)}
    <span class="tx-text"><b>${esc(title)}</b><span>${esc(sub)}${t.method ? ` · ${esc(t.method)}` : ''}</span></span>
    <span class="tx-amount num ${tone}">${value > 0 ? '+' : '−'}${fmt(t.amount)}</span>
  </button>`;
}

const STATUS = { paid: 'Pago', overdue: 'Em atraso', soon: 'Em breve', pending: 'Por pagar' };
const dueText = (st) => {
  if (st.state === 'paid') return `Pago a ${fmtDate(st.payment.date, { day: 'numeric', month: 'short' })}`;
  if (st.state === 'overdue') return `Atrasado ${-st.diff} ${st.diff === -1 ? 'dia' : 'dias'}`;
  if (st.diff === 0) return 'Vence hoje';
  if (st.diff === 1) return 'Vence amanhã';
  if (st.diff > 0 && st.diff <= 7) return `Vence em ${st.diff} dias`;
  return `Vence a ${fmtDate(st.due, { day: 'numeric', month: 'short' })}`;
};
export function billRow(s, item) {
  const { bill, period, state } = item;
  const cat = s.categories.find((c) => c.id === bill.categoryId);
  const label = STATUS[state];
  const paid = state === 'paid';
  return `<div class="row">
    <button class="row-main" data-action="edit-bill" data-id="${esc(bill.id)}">
      ${avatar(cat?.icon || 'repeat', cat?.color || 'none')}
      <span class="tx-text"><b>${esc(bill.name)}</b><span class="${state === 'overdue' ? 'bad' : ''}">${fmt(paid ? item.payment.amount : bill.amount)} · ${dueText(item)}</span></span>
    </button>
    <button class="toggle-pay" data-action="toggle-bill" data-id="${esc(bill.id)}" data-period="${period}" aria-pressed="${paid}" aria-label="${esc(bill.name)}: ${label}. ${paid ? 'Marcar como não pago' : 'Marcar como pago'}">
      ${paid ? `${icon('check', 15)} Pago` : 'Não pago'}
    </button>
  </div>`;
}

export function donut(rows) {
  const total = rows.reduce((n, r) => n + r.value, 0);
  const r = 70;
  const C = 2 * Math.PI * r;
  const gap = rows.length > 1 ? 2.5 : 0;
  let offset = 0;
  const arcs = rows.map((row, i) => {
    const len = (row.value / total) * C;
    const dash = Math.max(len - gap, 1.2);
    const el = `<circle class="arc" data-action="donut" data-i="${i}" cx="90" cy="90" r="${r}" stroke="${colorVar(row.color)}" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${esc(row.name)}: ${fmt(row.value)}</title></circle>`;
    offset += len;
    return el;
  }).join('');
  const legend = rows.map((row, i) => `<button data-action="donut" data-i="${i}" data-name="${esc(row.name)}" data-value="${esc(fmt(row.value))}" aria-pressed="false">
    <span class="swatch" style="background:${colorVar(row.color)}"></span>
    <span class="name">${esc(row.name)}</span><span class="num">${fmt(row.value)}</span><span class="p num">${Math.round(pct(row.value, total))}%</span>
  </button>`).join('');
  return `<div class="donut-wrap" data-total="${esc(fmt(total))}">
    <div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="Distribuição de gastos por categoria, total ${esc(fmt(total))}">${arcs}</svg>
      <div class="donut-center" aria-live="polite"><span class="n">Total gasto</span><span class="a num">${fmt(total)}</span></div>
    </div>
    <div class="legend">${legend}</div>
  </div>`;
}

function home(s) {
  const month = monthOf(today());
  const totals = monthTotals(s, month);
  const alerts = upcomingBills(s);
  const rows = spendByCategory(s, month);
  const recent = sortTx(s.transactions).slice(0, 5);
  const saved = totalSaved(s);
  const owed = debtTotals(s, 'owed');
  const owe = debtTotals(s, 'owe');
  const balanceValue = balance(s);
  return `<header class="top"><div><p class="muted small">${fmtMonth(month)}</p><h1>Início</h1></div>
    <button class="icon-btn" data-action="settings" aria-label="Definições">${icon('gear')}</button></header>
  <section class="hero">
    <p class="label">Saldo Total Disponível</p>
    <p class="amount">${fmt(balanceValue)}</p>
    ${!s.settings.onboarded ? '<div class="hero-actions"><button data-action="opening-balance">Definir saldo inicial</button></div>' : ''}
  </section>
  <section class="stats" aria-label="Resumo do mês">
    <div class="stat"><div class="k"><span class="badge good good">${icon('down', 14)}</span>Entradas</div><div class="v good">${fmt(totals.income)}</div></div>
    <div class="stat"><div class="k"><span class="badge bad bad">${icon('up', 14)}</span>Saídas</div><div class="v bad">${fmt(totals.expense)}</div></div>
    <button class="stat" data-action="tab" data-value="savings" style="text-align:left"><div class="k"><span class="badge good good">${icon('safe', 14)}</span>Poupado</div><div class="v">${fmt(saved)}</div></button>
    <button class="stat" data-action="tab" data-value="debts" style="text-align:left"><div class="k"><span class="badge warn warn">${icon('users', 14)}</span>Dívidas</div><div class="v small" style="font-size:13px;font-weight:600"><span class="good num">+${fmt(owed)}</span><br><span class="bad num">−${fmt(owe)}</span></div></button>
  </section>
  <section class="card">
    <div class="card-head"><h2>Próximos pagamentos</h2><button class="link" data-action="go-bills">Ver todos</button></div>
    ${alerts.length ? `<div class="rows">${alerts.slice(0, 5).map((a) => billRow(s, a)).join('')}</div>`
    : s.bills.length ? empty('check', 'Tudo em dia', 'Sem pagamentos nos próximos 7 dias.')
      : empty('repeat', 'Sem pagamentos mensais', 'Adiciona a renda, a luz ou as subscrições.', '<button class="btn" data-action="new-bill">Adicionar pagamento</button>')}
  </section>
  <section class="card">
    <div class="card-head"><h2>Gastos por categoria</h2></div>
    ${rows.length ? donut(rows) : empty('pie', 'Ainda sem gastos este mês', 'Regista uma despesa com o botão +.')}
  </section>
  <section class="card">
    <div class="card-head"><h2>Últimos movimentos</h2><button class="link" data-action="tab" data-value="transactions">Ver todos</button></div>
    ${recent.length ? `<div class="rows">${recent.map((t) => txRow(s, t)).join('')}</div>` : empty('list', 'Sem movimentos', 'O teu histórico aparece aqui.')}
  </section>`;
}

const fold = (v) => String(v || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function filteredTx(s, ui) {
  const q = fold(ui.q).trim();
  return sortTx(s.transactions).filter((t) => {
    if (ui.txMonth !== 'all' && monthOf(t.date) !== ui.txMonth) return false;
    if (ui.txType !== 'all' && t.type !== ui.txType) return false;
    if (ui.txCat === 'none' && t.categoryId) return false;
    if (ui.txCat !== 'all' && ui.txCat !== 'none' && t.categoryId !== ui.txCat) return false;
    if (!q) return true;
    const cat = s.categories.find((c) => c.id === t.categoryId)?.name;
    return fold(`${t.description} ${cat || ''} ${t.method}`).includes(q);
  });
}

export function txResults(s, ui) {
  const list = filteredTx(s, ui);
  if (!list.length) {
    return s.transactions.length
      ? `<div class="card">${empty('search', 'Nada encontrado', 'Experimenta alterar os filtros ou a pesquisa.')}</div>`
      : `<div class="card">${empty('list', 'Ainda sem movimentos', 'Toca em + para registar o primeiro.')}</div>`;
  }
  const income = list.filter((t) => t.type === 'income').reduce((n, t) => n + t.amount, 0);
  const expense = list.filter((t) => t.type === 'expense').reduce((n, t) => n + t.amount, 0);
  const groups = new Map();
  for (const t of list) groups.set(t.date, [...(groups.get(t.date) || []), t]);
  return `<div class="stats">
    <div class="stat"><div class="k">Entradas</div><div class="v good">${fmt(income)}</div></div>
    <div class="stat"><div class="k">Saídas</div><div class="v bad">${fmt(expense)}</div></div>
  </div>
  ${[...groups].map(([date, items]) => `<div class="day"><span>${esc(fmtDate(date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }))}</span></div>
    <div class="card" style="padding:4px 14px"><div class="rows">${items.map((t) => txRow(s, t)).join('')}</div></div>`).join('')}`;
}

function transactions(s, ui) {
  const opts = s.categories.map((c) => `<option value="${esc(c.id)}" ${ui.txCat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  return `<header class="top"><h1>Movimentos</h1>
    <button class="icon-btn" data-action="categories" aria-label="Gerir categorias">${icon('tag')}</button></header>
  <label class="search">${icon('search', 19)}<input id="tx-search" type="search" placeholder="Pesquisar movimentos" aria-label="Pesquisar movimentos" value="${esc(ui.q)}" autocomplete="off"></label>
  ${ui.txMonth === 'all' ? '' : monthNav('tx', ui.txMonth)}
  <div class="filters">
    <button class="chip-btn" data-action="tx-all-months" aria-pressed="${ui.txMonth === 'all'}">Todos os meses</button>
    <select id="tx-cat" aria-label="Filtrar por categoria">
      <option value="all">Todas as categorias</option><option value="none" ${ui.txCat === 'none' ? 'selected' : ''}>Sem categoria</option>${opts}
    </select>
  </div>
  <div class="filters">
    ${[['all', 'Tudo'], ['expense', 'Despesas'], ['income', 'Receitas'], ['transfer', 'Transferências']].map(([v, l]) => `<button class="chip-btn" data-action="tx-type" data-value="${v}" aria-pressed="${ui.txType === v}">${l}</button>`).join('')}
  </div>
  <div id="tx-results" style="display:flex;flex-direction:column;gap:14px">${txResults(s, ui)}</div>`;
}

function potCard(s, pot, month) {
  const target = potAmount(s.budget, pot);
  const spent = potSpent(s, pot, month);
  const left = target - spent;
  const p = pct(spent, target);
  let tone = '';
  let status;
  if (pot.isSavings) {
    status = left > 0 ? `<span class="muted">Faltam ${fmt(left)}</span>` : `<span class="good">${icon('check', 13).replace('class="ico"', 'class="ico" style="display:inline;vertical-align:-2px"')} Meta atingida</span>`;
  } else if (left < 0) {
    tone = 'bad';
    status = `<span class="bad"><b>Ultrapassado em ${fmt(-left)}</b></span>`;
  } else {
    tone = p >= 80 ? 'warn' : '';
    status = `<span class="${tone === 'warn' ? 'warn' : 'good'}">Faltam ${fmt(left)}</span>`;
  }
  const rule = pot.mode === 'percent' ? `${String(pot.value).replace('.', ',')}% do rendimento` : 'Valor fixo';
  return `<button class="card pot" data-action="edit-pot" data-id="${esc(pot.id)}">
    <span class="pot-head"><span class="swatch" style="background:${colorVar(pot.color)};width:14px;height:14px"></span>
      <span class="grow"><b>${esc(pot.name)}</b><span class="muted small">${rule}</span></span>
      <span class="num" style="font-weight:700">${fmt(target)}</span></span>
    ${bar(p, tone, pot.name)}
    <span class="split"><span>${pot.isSavings ? 'Poupado' : 'Gasto'} ${fmt(spent)}</span>${status}</span>
  </button>`;
}

function budgetPots(s, ui) {
  const month = ui.budgetMonth;
  const allocated = s.budget.pots.reduce((n, p) => n + potAmount(s.budget, p), 0);
  const free = s.budget.income - allocated;
  const unassigned = unassignedSpend(s, month);
  return `<button class="card pot" data-action="edit-income">
      <span class="split"><span>Rendimento mensal</span><span style="color:var(--accent);font-weight:650">Editar</span></span>
      <span class="big">${fmt(s.budget.income)}</span>
      ${s.budget.income ? `${bar(pct(allocated, s.budget.income), free < 0 ? 'bad' : '', 'Rendimento distribuído')}
      <span class="split"><span>Distribuído ${fmt(allocated)}</span>${free < 0 ? `<span class="bad"><b>Excede em ${fmt(-free)}</b></span>` : free > 0 ? `<span class="warn">Por distribuir ${fmt(free)}</span>` : '<span class="good">Tudo distribuído</span>'}</span>`
    : '<span class="muted small">Define o teu rendimento para calcular os potes.</span>'}
    </button>
    ${s.budget.pots.map((p) => potCard(s, p, month)).join('')}
    ${unassigned ? `<div class="note">${fmt(unassigned)} em despesas sem pote este mês. Associa as categorias a um pote para as contabilizar.</div>` : ''}
    <div class="btn-row"><button class="btn" data-action="new-pot">${icon('plus', 18)} Novo pote</button><button class="btn" data-action="categories">${icon('tag', 18)} Categorias</button></div>`;
}

function budgetBills(s, ui) {
  const items = billsForMonth(s, ui.budgetMonth);
  const total = items.reduce((n, i) => n + (i.payment?.amount ?? i.bill.amount), 0);
  const paid = items.filter((i) => i.payment).reduce((n, i) => n + i.payment.amount, 0);
  return `${items.length ? `<div class="card pot">
      <span class="split"><span>Pago este mês</span><span>${items.filter((i) => i.payment).length} de ${items.length}</span></span>
      <span class="big">${fmt(paid)} <span class="muted" style="font-size:15px;font-weight:500">de ${fmt(total)}</span></span>
      ${bar(pct(paid, total), '', 'Pagamentos mensais pagos')}
    </div>
    <div class="card" style="padding:4px 14px"><div class="rows">${items.map((i) => billRow(s, i)).join('')}</div></div>`
    : `<div class="card">${empty('repeat', 'Sem pagamentos neste mês', 'Adiciona contas como renda, luz, ginásio ou Netflix.')}</div>`}
    <button class="btn block" data-action="new-bill">${icon('plus', 18)} Novo pagamento mensal</button>`;
}

function budget(s, ui) {
  return `<header class="top"><h1>Orçamento</h1></header>
  ${seg('budget-tab', ui.budgetTab, [['pots', 'Potes'], ['bills', 'Pagamentos']])}
  ${monthNav('budget', ui.budgetMonth)}
  ${ui.budgetTab === 'pots' ? budgetPots(s, ui) : budgetBills(s, ui)}`;
}

function debtCard(d) {
  const paid = debtPaid(d);
  const left = debtRemaining(d);
  const settled = left === 0;
  return `<button class="card debt" data-action="open-debt" data-id="${esc(d.id)}">
    <span class="pot-head"><span class="avatar" style="background:${d.direction === 'owed' ? 'var(--c-aqua)' : 'var(--c-orange)'}">${esc(d.person[0].toUpperCase())}</span>
      <span class="grow"><b>${esc(d.person)}</b><span class="muted small">${esc(d.reason || fmtDate(d.date))}</span></span>
      ${settled ? `<span class="pill good">${icon('check', 12)}Liquidada</span>` : `<span class="num" style="font-weight:720">${fmt(left)}</span>`}</span>
    ${bar(pct(paid, d.total), d.direction === 'owe' && !settled ? 'warn' : '', `Dívida de ${d.person}`)}
    <span class="split"><span>${d.direction === 'owed' ? 'Recebido' : 'Pago'} ${fmt(paid)}</span><span>Total ${fmt(d.total)}</span></span>
  </button>`;
}

function debts(s, ui) {
  const dir = ui.debtTab;
  const list = s.debts.filter((d) => d.direction === dir).sort((a, b) => b.date.localeCompare(a.date));
  const open = list.filter((d) => debtRemaining(d) > 0);
  const closed = list.filter((d) => debtRemaining(d) === 0);
  const total = debtTotals(s, dir);
  return `<header class="top"><h1>Dívidas</h1>
    <button class="icon-btn" data-action="new-debt" aria-label="Nova dívida">${icon('plus')}</button></header>
  ${seg('debt-tab', dir, [['owed', 'Devem-me'], ['owe', 'Devo']])}
  <div class="card"><p class="muted small">${dir === 'owed' ? 'Total a receber' : 'Total a pagar'}</p><p class="big ${dir === 'owed' ? 'good' : 'bad'}">${fmt(total)}</p></div>
  ${open.map(debtCard).join('')}
  ${!list.length ? `<div class="card">${empty('users', dir === 'owed' ? 'Ninguém te deve dinheiro' : 'Não tens dívidas', 'Regista um empréstimo para acompanhares os pagamentos.', '<button class="btn" data-action="new-debt">Registar dívida</button>')}</div>` : ''}
  ${closed.length ? `<h2 class="section">Liquidadas</h2>${closed.map(debtCard).join('')}` : ''}`;
}

function goalCard(s, g) {
  const saved = goalSaved(s, g);
  const p = pct(saved, g.target);
  const done = saved >= g.target;
  return `<div class="card goal">
    <button class="pot-head" data-action="open-goal" data-id="${esc(g.id)}" style="text-align:left">
      ${avatar(g.icon, g.color)}
      <span class="grow"><b>${esc(g.name)}</b><span class="muted small">${done ? 'Objetivo atingido' : `Faltam ${fmt(g.target - saved)}`}</span></span>
      <span class="num" style="font-weight:720">${Math.floor(p)}%</span>
    </button>
    ${bar(p, '', g.name)}
    <span class="split"><span class="good"><b>${fmt(saved)}</b></span><span>de ${fmt(g.target)}</span></span>
    <div class="goal-actions">
      <button class="btn good-btn" data-action="goal-move" data-id="${esc(g.id)}" data-dir="in">${icon('plus', 17)} Adicionar</button>
      <button class="btn warn-btn" data-action="goal-move" data-id="${esc(g.id)}" data-dir="out" ${saved <= 0 ? 'disabled style="opacity:.45"' : ''}>${icon('minus', 17)} Retirar</button>
    </div>
  </div>`;
}

function savings(s) {
  return `<header class="top"><h1>Poupança</h1>
    <button class="icon-btn" data-action="new-goal" aria-label="Novo cofre">${icon('plus')}</button></header>
  <div class="stats">
    <div class="stat"><div class="k">Total poupado</div><div class="v good">${fmt(totalSaved(s))}</div></div>
    <div class="stat"><div class="k">Saldo disponível</div><div class="v">${fmt(balance(s))}</div></div>
  </div>
  ${s.goals.length ? s.goals.map((g) => goalCard(s, g)).join('') : `<div class="card">${empty('safe', 'Cria o teu primeiro cofre', 'Fundo de emergência, férias, carro: define uma meta e acompanha o progresso.', '<button class="btn" data-action="new-goal">Criar cofre</button>')}</div>`}`;
}

export const TABS = [
  ['home', 'Início', 'home'], ['transactions', 'Movimentos', 'list'], ['budget', 'Orçamento', 'pie'],
  ['debts', 'Dívidas', 'users'], ['savings', 'Poupança', 'safe'],
];
export const renderNav = (tab) => `<div class="nav-in">${TABS.map(([id, label, ic]) => `<button data-action="tab" data-value="${id}" ${tab === id ? 'aria-current="page"' : ''}>${icon(ic, 23)}<span>${label}</span></button>`).join('')}</div>`;
export const renderView = (s, ui) => ({
  home: () => home(s), transactions: () => transactions(s, ui), budget: () => budget(s, ui), debts: () => debts(s, ui), savings: () => savings(s),
}[ui.tab]());
