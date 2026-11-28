// In-memory store for arena XP pickups. Replaces per-poll MongoDB reads of
// 1,000 documents and emits incremental changes for WebSocket item diffs.
const items = new Map();
let onChange = null;

function toRow(item) {
  return {
    _id: String(item.id ?? item._id),
    x: Number(item.pos?.x ?? item.x) || 0,
    y: Number(item.pos?.y ?? item.y) || 0,
    color: item.color,
    xp: Number(item.xp) || 1,
    r: Number(item.r) || 5,
  };
}

function setOnChange(fn) {
  onChange = typeof fn === 'function' ? fn : null;
}

function list() {
  return [...items.values()];
}

function get(id) {
  if (id == null) return null;
  return items.get(String(id)) || null;
}

function addSync(item, { notify = false } = {}) {
  const row = toRow(item);
  items.set(row._id, row);
  if (notify && onChange) onChange(row);
  return row;
}

function updateSync(item, { notify = true } = {}) {
  const id = String(item.id ?? item._id);
  const existing = items.get(id);
  const row = {
    _id: id,
    x: Number(item.pos?.x ?? item.x) || 0,
    y: Number(item.pos?.y ?? item.y) || 0,
    color: item.color ?? existing?.color ?? '#FFFFFF',
    xp: Number(item.xp) || existing?.xp || 1,
    r: Number(item.r) || existing?.r || 5,
  };
  items.set(id, row);
  if (notify && onChange) onChange(row);
  return row;
}

function removeSync(id) {
  if (id == null) return false;
  return items.delete(String(id));
}

function clear() {
  items.clear();
}

function seed(count, factory) {
  items.clear();
  let guard = 0;
  while (items.size < count && guard < count * 5) {
    guard += 1;
    addSync(factory(), { notify: false });
  }
  return list();
}

// Legacy callback wrappers kept for REST routes.
function getAll(callback) {
  if (callback) callback(list());
}

function add(item, callback) {
  const row = addSync(item, { notify: true });
  if (callback) callback(row);
}

function update(item, callback) {
  const row = updateSync(item, { notify: true });
  if (callback) callback(row);
}

function remove(id, callback) {
  removeSync(id);
  if (callback) callback();
}

function removeAll(callback) {
  clear();
  if (callback) callback();
}

function getOne(id, callback) {
  if (callback) callback(get(id));
}

module.exports = {
  setOnChange,
  list,
  get,
  addSync,
  updateSync,
  removeSync,
  clear,
  seed,
  getAll,
  add,
  remove,
  update,
  removeAll,
  getOne,
};
