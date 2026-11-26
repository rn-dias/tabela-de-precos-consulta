import {highlights, prices, search} from './catalog.js';

const byId = id => document.getElementById(id);
const money = new Intl.NumberFormat('pt-BR',{style:'currency', currency:'BRL'});
const diopters = new Intl.NumberFormat('pt-BR',{minimumIntegerDigits:2,minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:'exceptZero'});
const number = new Intl.NumberFormat('pt-BR');
const query = byId('query');
const clear = byId('clear');
const manufacturer = byId('manufacturer');
const manufacturerFilter = byId('manufacturer-filter');
const sourceTag = byId('source-tag');
const results = byId('results');
const productTable = byId('product-table');
const tableScroll = byId('table-scroll');
const empty = byId('empty');
const priceDialog = byId('price-dialog');
const openPrices = byId('open-prices');
const priceOptions = byId('price-options');
const salesTables = prices;
const visiblePrices = new Map();
let tablePrice = salesTables[0][0];
const more = byId('more');
const pageSize = 40;
let matches = [];
let visibleCount = 0;
let rows;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  if (className) node.className = className;
  return node;
}
const asDiopter = value => typeof value === 'number' ? diopters.format(value) : String(value).trim();
const gradeFields = [
  'height','sphereFrom','sphereTo','cylinderFrom','cylinderTo','additionFrom','additionTo','diameter'
];
function gradeColumn(key,value) {
  if (value == null) return [];
  if (typeof value === 'number') return [value];
  const lines = String(value).split(/\r\n?|\n/).map(line=>line.trim());
  if (key !== 'diameter') return lines;
  return lines.flatMap(line=>line.replace(/[ \t]*\/[ \t]*/g,'/').split(/[ \u00a0]{2,}|\t+/));
}
function diameterOrHeight(value) {
  return typeof value === 'number' ? number.format(value) : String(value).replace(/\s*mm\b/gi,'').trim();
}
function alignedGrades(grade) {
  const columns = gradeFields.map(key=>gradeColumn(key,grade[key]));
  const count = Math.max(1,...columns.map(values=>values.length));
  return Array.from({length:count},(_,line)=>columns.map((values,index)=>{
    const value = values.length === 1 ? values[0] : values[line];
    if (value == null || String(value).trim() === '') return '—';
    return index === 0 || index === gradeFields.length-1 ? diameterOrHeight(value) : asDiopter(value);
  }));
}
function priceText(row) {
  const value = row[tablePrice];
  return value == null ? 'Não cadastrado' : money.format(value);
}
function productRows(row) {
  const group = element('tbody',undefined,'product-group');
  const sourceGrades = row.grades?.length ? row.grades : [row.grade ?? {}];
  const grades = sourceGrades.flatMap(alignedGrades);
  const description = element('th',undefined,'product-description');
  const title = element('div',undefined,'product-name');
  description.scope = 'rowgroup';
  description.rowSpan = grades.length;
  for (const part of highlights(row.name,query.value)) {
    title.append(part.hit ? element('mark',part.text) : document.createTextNode(part.text));
  }
  description.append(title);
  if (row.manufacturer) description.append(element('span',row.manufacturer,'product-maker'));

  const code = element('td',row.code,'product-code');
  const price = element('td',priceText(row),'product-price');
  code.rowSpan = price.rowSpan = grades.length;
  visiblePrices.set(price,row);
  grades.forEach((grade,index)=>{
    const line = element('tr');
    if (index === 0) line.append(description);
    for (const value of grade) line.append(element('td',value,'grade-cell'));
    if (index === 0) line.append(code,price);
    group.append(line);
  });
  return group;
}
function appendPage() {
  const end = Math.min(visibleCount + pageSize,matches.length);
  productTable.append(...matches.slice(visibleCount,end).map(productRows));
  visibleCount = end;
  more.hidden = visibleCount >= matches.length;
}
function selectPrice(key,label) {
  tablePrice = key;
  byId('price-table-value').textContent = label;
  byId('price-column').textContent = label;
  for (const [cell,row] of visiblePrices) cell.textContent = priceText(row);
  for (const option of priceOptions.children) option.setAttribute('aria-pressed',String(option.value === key));
}
for (const [key,label] of salesTables) {
  const option = element('button',label,'price-option');
  option.type = 'button';
  option.value = key;
  option.addEventListener('click',()=>{
    selectPrice(key,label);
    priceDialog.close();
  });
  priceOptions.append(option);
}
selectPrice(...salesTables[0]);
openPrices.addEventListener('click',()=>{
  priceDialog.showModal();
  priceOptions.querySelector('[aria-pressed=true]')?.focus();
});
priceDialog.addEventListener('close',()=>openPrices.focus());

function refreshManufacturers() {
  const names = [...new Set((rows ?? []).map(row=>row.manufacturer).filter(Boolean))];
  names.sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const all = element('option','Todos os fabricantes');
  all.value = '';
  const options = names.map(name=>{
    const option = element('option',name);
    option.value = name;
    return option;
  });
  manufacturer.replaceChildren(all,...options);
  manufacturer.value = '';
  manufacturerFilter.hidden = !options.length;
}
function update(value = query.value) {
  query.value = value;
  const selectedManufacturer = manufacturer.value;
  results.hidden = !value.trim() && !selectedManufacturer;
  clear.hidden = !value && !selectedManufacturer;
  for (const group of Array.from(productTable.tBodies)) group.remove();
  visiblePrices.clear();
  tableScroll.hidden = true;
  empty.hidden = true;
  more.hidden = true;
  byId('count').textContent = '';
  if (results.hidden) return;
  const scope = selectedManufacturer ? (rows ?? []).filter(row=>row.manufacturer === selectedManufacturer) : rows ?? [];
  matches = search(scope,value);
  visibleCount = 0;
  byId('count').textContent = matches.length === 1 ? '1 resultado' : matches.length+' resultados';
  if (matches.length) {
    tableScroll.hidden = false;
    appendPage();
  } else {
    empty.textContent = rows ? 'Nenhuma lente encontrada. Revise a busca ou o fabricante.' :
      'Não foi possível carregar os produtos. Recarregue a página para tentar novamente.';
    empty.hidden = false;
  }
}
byId('search').addEventListener('submit',event => {event.preventDefault(); update();});
query.addEventListener('input',() => update());
manufacturer.addEventListener('change',() => update());
clear.addEventListener('click',() => {manufacturer.value = ''; update(''); query.focus();});
more.addEventListener('click',appendPage);
query.disabled = true;
try {
  const response = await fetch('./catalog-data.json');
  if (!response.ok) throw new Error('Catálogo indisponível.');
  rows = await response.json();
} catch {
  sourceTag.textContent = 'Não foi possível carregar os produtos.';
  sourceTag.hidden = false;
}
query.disabled = false;
refreshManufacturers();
update();
