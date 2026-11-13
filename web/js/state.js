// web/js/state.js
// cache صغير للبيانات المشتركة بين الـ views

const cache = {
  clients: [],
  cases: [],
  lawyers: [],
};

export function setClients(list) { cache.clients = list; }
export function setCases(list)   { cache.cases = list; }
export function setLawyers(list) { cache.lawyers = list; }

export function getClients() { return cache.clients; }
export function getCases()   { return cache.cases; }
export function getLawyers() { return cache.lawyers; }

export function clearState() {
  cache.clients = [];
  cache.cases = [];
  cache.lawyers = [];
}