import { icon } from './icons.js';
import {
  CATEGORY_ICONS, COLORS, METHODS, balance, debtPaid, debtRemaining, fmt, fmtDate, fmtMonth, fmtPlain, goalMoves, goalSaved,
  pct, potAmount, today,
} from './logic.js';
import { avatar, bar, colorVar, esc } from './views.js';

const head = (title, extra = '') => `<div class="sheet-head"><h2>${esc(title)}</h2><div style="display:flex;gap:2px">${extra}<button type="button" class="icon-btn flat" data-action="close" aria-label="Fechar">${icon('x')}</button></div></div>`;
const del = (action, id, label) => `<button type="button" class="icon-btn flat danger" data-action="${action}" data-id="${esc(id)}" aria-label="${label}">${icon('trash', 20)}</button>`;
const error = '<p class="form-error" role="alert" hidden></p>';
const money = (name, label, value, attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${value != null ? fmtPlain(value) : ''}" ${attrs}></label>`;
const radioSeg = (name, value, options) => `<div class="seg">${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
const iconPicker = (value) => `<fieldset class="field"><legend>Ícone</legend><div class="pick-grid">${CATEGORY_ICONS.map((n) => `<label class="pick"><input type="radio" name="icon" value="${n}" aria-label="Ícone ${n}" ${n === value ? 'checked' : ''}><span>${icon(n, 21)}</span></label>`).join('')}</div></fieldset>`;
const COLOR_NAMES = { blue: 'Azul', orange: 'Laranja', aqua: 'Água', yellow: 'Amarelo', magenta: 'Magenta', green: 'Verde', violet: 'Violeta', red: 'Vermelho' };
const colorPicker = (value) => `<fieldset class="field"><legend>Cor</legend><div class="pick-grid">${COLORS.map((c) => `<label class="pick color"><input type="radio" name="color" value="${c}" aria-label="${COLOR_NAMES[c]}" ${c === value ? 'checked' : ''}><span style="background:${colorVar(c)}">${icon('check', 19)}</span></label>`).join('')}</div></fieldset>`;
const catSelect = (s, value, kind = 'expense') => `<label class="field"><span>Categoria</span><select name="categoryId"><option value="">Sem categoria</option>${s.categories.filter((c) => c.kind === kind).map((c) => `<option value="${esc(c.id)}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
const methodSelect = (value) => `<label class="field"><span>Método de pagamento</span><select name="method">${METHODS.map((m) => `<option ${m === value ? 'selected' : ''}>${m}</option>`).join('')}</select></label>`;

export function txSheet(s, { tx, type = 'expense', method = METHODS[0] }) {
  const current = tx?.type || type;
  const linkedBill = tx?.link?.kind === 'bill';
  return `<form class="sheet-in" data-form="tx" novalidate>
    ${head(tx ? 'Editar movimento' : 'Novo movimento', tx ? del('delete-tx', tx.id, 'Apagar movimento') : '')}
    <input type="hidden" name="id" value="${esc(tx?.id || '')}">
    ${linkedBill ? `<input type="hidden" name="type" value="expense"><p class="note">Pagamento mensal. Se o apagares, a conta volta a ficar por pagar.</p>`
    : radioSeg('type', current, [['expense', 'Despesa'], ['income', 'Receita']])}
    <label class="field"><span>Valor (€)</span><input class="amount-input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${tx ? fmtPlain(tx.amount) : ''}" ${tx ? '' : 'autofocus'}></label>
    <label class="field"><span>Em quê?</span><input name="description" maxlength="120" placeholder="Ex.: Supermercado" value="${esc(tx?.description || '')}" autocomplete="off"></label>
    <fieldset class="field"><legend>Categoria</legend><div class="chips" id="tx-cats">
      <label class="chip plain"><input type="radio" name="categoryId" value="" ${!tx?.categoryId ? 'checked' : ''}><span>Sem categoria</span></label>
      ${s.categories.map((c) => `<label class="chip" data-kind="${c.kind}" ${c.kind !== current ? 'hidden' : ''}><input type="radio" name="categoryId" value="${esc(c.id)}" ${tx?.categoryId === c.id ? 'checked' : ''}><span><span class="dot" style="background:${colorVar(c.color)}">${icon(c.icon, 14)}</span>${esc(c.name)}</span></label>`).join('')}
    </div></fieldset>
    <div class="grid2">
      <label class="field"><span>Data</span><input type="date" name="date" value="${tx?.date || today()}"></label>
      ${methodSelect(tx?.method || method)}
    </div>
    ${error}
    <button class="btn primary">${tx ? 'Guardar alterações' : 'Registar'}</button>
  </form>`;
}

export function linkedTxSheet(s, tx) {
  const isGoal = tx.link?.kind === 'goal';
  return `<div class="sheet-in">${head('Movimento associado')}
    <div class="card"><p class="muted small">${esc(tx.description)}</p><p class="big">${tx.flow === 'in' ? '+' : '−'}${fmt(tx.amount)}</p><p class="muted small">${fmtDate(tx.date)}</p></div>
    ${tx.link ? `<p class="note">Este movimento é gerido na secção ${isGoal ? 'Poupança' : 'Dívidas'}, para manter os valores certos.</p>
    <button class="btn primary" data-action="${isGoal ? 'open-goal' : 'open-debt'}" data-id="${esc(tx.link.id)}" data-replace="1">Abrir ${isGoal ? 'cofre' : 'dívida'}</button>`
    : `<button class="btn danger block" data-action="delete-tx" data-id="${esc(tx.id)}">${icon('trash', 18)} Apagar movimento</button>`}
  </div>`;
}

export function settingsSheet(s) {
  const last = s.settings.lastBackup;
  return `<div class="sheet-in">${head('Definições')}
    <div class="field"><span>Tema</span>
      <div class="seg">${[['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<button data-action="theme" data-value="${v}" aria-pressed="${s.settings.theme === v}">${l}</button>`).join('')}</div>
    </div>
    <div class="card menu">
      <button data-action="opening-balance">${icon('wallet')}<span class="grow">Saldo inicial<small>${fmt(s.settings.openingBalance)}</small></span>${icon('chevR', 18)}</button>
      <button data-action="categories">${icon('tag')}<span class="grow">Categorias<small>${s.categories.length} categorias</small></span>${icon('chevR', 18)}</button>
    </div>
    <h3 class="section">Os teus dados</h3>
    <p class="note">Os dados ficam apenas neste dispositivo. ${last ? `Último backup: ${fmtDate(last)}.` : 'Ainda não fizeste nenhum backup.'}</p>
    <div class="card menu">
      <button data-action="export-json">${icon('download')}<span class="grow">Backup completo (JSON)<small>Para restaurar mais tarde</small></span></button>
      <button data-action="export-xlsx">${icon('download')}<span class="grow">Exportar para Excel (.xlsx)<small>Todos os dados, por folhas</small></span></button>
      <button data-action="export-csv">${icon('download')}<span class="grow">Exportar movimentos (CSV)<small>Compatível com Excel em Portugal</small></span></button>
      <label>${icon('upload')}<span class="grow">Restaurar backup<small>Substitui os dados atuais</small></span><input id="import-file" type="file" accept="application/json,.json" hidden></label>
      <button class="danger" data-action="wipe">${icon('trash')}<span class="grow">Apagar todos os dados</span></button>
    </div>
  </div>`;
}

export const openingSheet = (s) => `<form class="sheet-in" data-form="opening" novalidate>${head('Saldo inicial')}
  <p class="note">Quanto tens hoje nas tuas contas e em numerário. Serve de ponto de partida e não conta como receita.</p>
  <label class="field"><span>Valor (€)</span><input class="amount-input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${s.settings.openingBalance ? (s.settings.openingBalance < 0 ? '-' : '') + fmtPlain(Math.abs(s.settings.openingBalance)) : ''}" autofocus></label>
  ${error}<button class="btn primary">Guardar</button></form>`;

export const categoriesSheet = (s) => {
  const group = (kind, title) => `<h3 class="section">${title}</h3><div class="card" style="padding:4px 14px"><div class="rows">${s.categories.filter((c) => c.kind === kind).map((c) => `<button class="row" data-action="edit-category" data-id="${esc(c.id)}">${avatar(c.icon, c.color)}<span class="tx-text"><b>${esc(c.name)}</b></span>${icon('edit', 18)}</button>`).join('') || '<p class="muted small" style="padding:12px 0">Sem categorias.</p>'}</div></div>`;
  return `<div class="sheet-in">${head('Categorias')}${group('expense', 'Despesas')}${group('income', 'Receitas')}
    <button class="btn primary" data-action="new-category">${icon('plus', 18)} Nova categoria</button></div>`;
};

export const categorySheet = (s, c) => `<form class="sheet-in" data-form="category" novalidate>
  ${head(c ? 'Editar categoria' : 'Nova categoria', c ? del('delete-category', c.id, 'Apagar categoria') : '')}
  <input type="hidden" name="id" value="${esc(c?.id || '')}">
  <label class="field"><span>Nome</span><input name="name" maxlength="40" value="${esc(c?.name || '')}" placeholder="Ex.: Animais" autocomplete="off"></label>
  <div class="field"><span>Tipo</span>${radioSeg('kind', c?.kind || 'expense', [['expense', 'Despesa'], ['income', 'Receita']])}</div>
  ${iconPicker(c?.icon || 'wallet')}${colorPicker(c?.color || 'blue')}
  ${error}<button class="btn primary">Guardar</button></form>`;

export const incomeSheet = (s) => `<form class="sheet-in" data-form="income" novalidate>${head('Rendimento mensal')}
  <label class="field"><span>Valor (€)</span><input class="amount-input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${s.budget.income ? fmtPlain(s.budget.income) : ''}" autofocus></label>
  ${error}<button class="btn primary">Guardar</button></form>`;

export function potSheet(s, pot) {
  const mode = pot?.mode || 'percent';
  const value = pot ? (mode === 'percent' ? String(pot.value).replace('.', ',') : fmtPlain(pot.value)) : '';
  const owner = (id) => s.budget.pots.find((p) => p.id !== pot?.id && p.categoryIds.includes(id));
  return `<form class="sheet-in" data-form="pot" novalidate>
    ${head(pot ? 'Editar pote' : 'Novo pote', pot ? del('delete-pot', pot.id, 'Apagar pote') : '')}
    <input type="hidden" name="id" value="${esc(pot?.id || '')}">
    <label class="field"><span>Nome</span><input name="name" maxlength="40" value="${esc(pot?.name || '')}" placeholder="Ex.: Férias" autocomplete="off"></label>
    <div class="field"><span>Distribuição</span>${radioSeg('mode', mode, [['percent', 'Percentagem'], ['fixed', 'Valor fixo']])}</div>
    <label class="field"><span id="pot-value-label">${mode === 'percent' ? 'Percentagem (%)' : 'Valor (€)'}</span><input name="value" inputmode="decimal" autocomplete="off" value="${value}" placeholder="0"></label>
    ${pot ? `<p class="muted small">Corresponde a ${fmt(potAmount(s.budget, pot))} por mês.</p>` : ''}
    <label class="check"><input type="checkbox" name="isSavings" ${pot?.isSavings ? 'checked' : ''}><span>Contar depósitos nos cofres de poupança</span></label>
    <fieldset class="field"><legend>Categorias deste pote</legend><div class="chips">
      ${s.categories.filter((c) => c.kind === 'expense').map((c) => `<label class="chip"><input type="checkbox" name="categoryIds" value="${esc(c.id)}" ${pot?.categoryIds.includes(c.id) ? 'checked' : ''}><span><span class="dot" style="background:${colorVar(c.color)}">${icon(c.icon, 14)}</span>${esc(c.name)}${owner(c.id) ? ` <small class="muted">(${esc(owner(c.id).name)})</small>` : ''}</span></label>`).join('')}
    </div></fieldset>
    ${colorPicker(pot?.color || 'blue')}
    ${error}<button class="btn primary">Guardar</button></form>`;
}

export const billSheet = (s, b) => `<form class="sheet-in" data-form="bill" novalidate>
  ${head(b ? 'Editar pagamento' : 'Novo pagamento mensal', b ? del('delete-bill', b.id, 'Apagar pagamento') : '')}
  <input type="hidden" name="id" value="${esc(b?.id || '')}">
  <label class="field"><span>Nome</span><input name="name" maxlength="60" value="${esc(b?.name || '')}" placeholder="Ex.: Renda, Luz, Netflix" autocomplete="off"></label>
  <div class="grid2">${money('amount', 'Valor (€)', b?.amount)}
    <label class="field"><span>Dia de vencimento</span><input name="dueDay" type="number" inputmode="numeric" min="1" max="31" value="${b?.dueDay || ''}" placeholder="1 a 31"></label></div>
  <div class="grid2">${catSelect(s, b?.categoryId)}${methodSelect(b?.method || 'Débito direto')}</div>
  ${error}<button class="btn primary">Guardar</button></form>`;

export const debtFormSheet = (s, { debt, direction }) => {
  const dir = debt?.direction || direction;
  return `<form class="sheet-in" data-form="debt" novalidate>
  ${head(debt ? 'Editar dívida' : 'Nova dívida')}
  <input type="hidden" name="id" value="${esc(debt?.id || '')}">
  ${debt ? `<input type="hidden" name="direction" value="${dir}">` : radioSeg('direction', dir, [['owed', 'Devem-me'], ['owe', 'Devo']])}
  <label class="field"><span>Nome da pessoa</span><input name="person" maxlength="60" value="${esc(debt?.person || '')}" autocomplete="off"></label>
  <div class="grid2">${money('total', 'Valor total (€)', debt?.total)}
    <label class="field"><span>Data</span><input type="date" name="date" value="${debt?.date || today()}"></label></div>
  <label class="field"><span>Motivo</span><input name="reason" maxlength="120" value="${esc(debt?.reason || '')}" placeholder="Ex.: Jantar, empréstimo" autocomplete="off"></label>
  <label class="check"><input type="checkbox" name="affectsBalance" ${debt ? (debt.affectsBalance ? 'checked' : '') : 'checked'}><span>Este dinheiro passou pelo meu saldo</span></label>
  <p class="note">Desmarca se a dívida é antiga e o saldo inicial já a reflete.</p>
  ${error}<button class="btn primary">Guardar</button></form>`;
};

export function debtSheet(s, d) {
  const left = debtRemaining(d);
  const owed = d.direction === 'owed';
  const payments = [...d.payments].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="sheet-in">
    ${head(d.person, `<button class="icon-btn flat" data-action="edit-debt" data-id="${esc(d.id)}" aria-label="Editar dívida">${icon('edit', 20)}</button>${del('delete-debt', d.id, 'Apagar dívida')}`)}
    <div class="card pot">
      <span class="muted small">${owed ? 'Falta receber' : 'Falta pagar'}${d.reason ? ` · ${esc(d.reason)}` : ''}</span>
      <span class="big ${left ? (owed ? 'good' : 'bad') : 'good'}">${fmt(left)}</span>
      ${bar(pct(debtPaid(d), d.total), !owed && left ? 'warn' : '', 'Dívida amortizada')}
      <span class="split"><span>${owed ? 'Recebido' : 'Pago'} ${fmt(debtPaid(d))}</span><span>Total ${fmt(d.total)} · ${fmtDate(d.date)}</span></span>
    </div>
    ${left ? `<form class="card" data-form="payment" novalidate style="display:flex;flex-direction:column;gap:10px">
      <input type="hidden" name="id" value="${esc(d.id)}">
      <h3 class="section">${owed ? 'Registar recebimento' : 'Registar pagamento'}</h3>
      <div class="grid2">${money('amount', 'Valor (€)')}<label class="field"><span>Data</span><input type="date" name="date" value="${today()}"></label></div>
      <button type="button" class="link" data-action="fill-amount" data-value="${fmtPlain(left)}" style="align-self:flex-start">Liquidar tudo (${fmt(left)})</button>
      ${error}<button class="btn primary">${owed ? 'Registar recebimento' : 'Registar pagamento'}</button>
    </form>` : `<p class="note">${icon('check', 16).replace('class="ico"', 'class="ico" style="display:inline;vertical-align:-3px"')} Dívida liquidada.</p>`}
    ${payments.length ? `<h3 class="section">Histórico</h3><div class="card" style="padding:4px 14px"><div class="rows">${payments.map((p) => `<div class="row"><span class="tx-text"><b class="num">${fmt(p.amount)}</b><span>${fmtDate(p.date)}</span></span><button class="icon-btn flat danger" data-action="delete-payment" data-debt="${esc(d.id)}" data-id="${esc(p.id)}" aria-label="Apagar pagamento de ${esc(fmt(p.amount))}">${icon('trash', 18)}</button></div>`).join('')}</div></div>` : ''}
  </div>`;
}

export const goalFormSheet = (s, g) => `<form class="sheet-in" data-form="goal" novalidate>
  ${head(g ? 'Editar cofre' : 'Novo cofre')}
  <input type="hidden" name="id" value="${esc(g?.id || '')}">
  <label class="field"><span>Nome</span><input name="name" maxlength="40" value="${esc(g?.name || '')}" placeholder="Ex.: Fundo de Emergência" autocomplete="off"></label>
  <div class="grid2">${money('target', 'Valor alvo (€)', g?.target)}${money('initial', 'Já poupado (€)', g ? g.initial : null)}</div>
  <p class="note">"Já poupado" é dinheiro guardado fora do saldo e não o altera.</p>
  ${iconPicker(g?.icon || 'safe')}${colorPicker(g?.color || 'green')}
  ${error}<button class="btn primary">Guardar</button></form>`;

export function goalSheet(s, g) {
  const saved = goalSaved(s, g);
  const moves = goalMoves(s, g.id);
  return `<div class="sheet-in">
    ${head(g.name, `<button class="icon-btn flat" data-action="edit-goal" data-id="${esc(g.id)}" aria-label="Editar cofre">${icon('edit', 20)}</button>${del('delete-goal', g.id, 'Apagar cofre')}`)}
    <div class="card pot"><span class="big good">${fmt(saved)}</span>${bar(pct(saved, g.target), '', g.name)}
      <span class="split"><span>${Math.floor(pct(saved, g.target))}% do objetivo</span><span>Alvo ${fmt(g.target)}</span></span></div>
    <div class="goal-actions">
      <button class="btn good-btn" data-action="goal-move" data-id="${esc(g.id)}" data-dir="in">${icon('plus', 17)} Adicionar</button>
      <button class="btn warn-btn" data-action="goal-move" data-id="${esc(g.id)}" data-dir="out" ${saved <= 0 ? 'disabled style="opacity:.45"' : ''}>${icon('minus', 17)} Retirar</button>
    </div>
    ${moves.length ? `<h3 class="section">Histórico</h3><div class="card" style="padding:4px 14px"><div class="rows">${moves.map((t) => `<div class="row"><span class="tx-text"><b class="num ${t.flow === 'out' ? 'good' : 'warn'}">${t.flow === 'out' ? '+' : '−'}${fmt(t.amount)}</b><span>${fmtDate(t.date)}</span></span><button class="icon-btn flat danger" data-action="delete-goal-move" data-id="${esc(t.id)}" aria-label="Apagar movimento de ${esc(fmt(t.amount))}">${icon('trash', 18)}</button></div>`).join('')}</div></div>` : ''}
  </div>`;
}

export function goalMoveSheet(s, g, dir) {
  const saved = goalSaved(s, g);
  const isIn = dir === 'in';
  return `<form class="sheet-in" data-form="goal-move" novalidate>
    ${head(`${isIn ? 'Adicionar a' : 'Retirar de'} ${g.name}`)}
    <input type="hidden" name="id" value="${esc(g.id)}"><input type="hidden" name="dir" value="${dir}">
    <p class="note">${isIn ? `Saldo disponível: ${fmt(balance(s))}` : `No cofre: ${fmt(saved)}. O valor volta ao saldo principal.`}</p>
    <label class="field"><span>Valor (€)</span><input class="amount-input" name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" autofocus></label>
    <div class="quick">${[10, 25, 50, 100].map((v) => `<button type="button" data-action="add-amount" data-value="${v}">+${v} €</button>`).join('')}</div>
    ${error}<button class="btn primary">${isIn ? 'Adicionar ao cofre' : 'Retirar para o saldo'}</button></form>`;
}

export const confirmSheet = ({ title, text, confirm = 'Apagar' }) => `<div class="sheet-in">${head(title)}
  <p>${esc(text)}</p>
  <div class="btn-row"><button class="btn" data-action="close">Cancelar</button><button class="btn danger" data-action="confirm-yes">${esc(confirm)}</button></div>
</div>`;

export { fmtMonth };
