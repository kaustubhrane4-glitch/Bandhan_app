// db.js — Simple JSON file database (works without MongoDB for MVP)
// Swap out read/write for MongoDB calls when ready to scale

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = {
  // Read all records from a JSON file
  read(file) {
    try {
      const fp = path.join(DATA_DIR, `${file}.json`);
      if (!fs.existsSync(fp)) return [];
      return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch (e) {
      console.error(`DB read error [${file}]:`, e.message);
      return [];
    }
  },

  // Read config object (not array)
  readConfig() {
    try {
      const fp = path.join(DATA_DIR, 'config.json');
      return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch (e) { return {}; }
  },

  // Write all records to a JSON file
  write(file, data) {
    try {
      const fp = path.join(DATA_DIR, `${file}.json`);
      fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error(`DB write error [${file}]:`, e.message);
      return false;
    }
  },

  // Find one record by id
  findById(file, id) {
    return this.read(file).find(item => item.id === id) || null;
  },

  // Find one record matching a query object
  findOne(file, query) {
    const data = this.read(file);
    return data.find(item =>
      Object.keys(query).every(k => item[k] === query[k])
    ) || null;
  },

  // Find all records matching a query object
  findMany(file, query = {}) {
    const data = this.read(file);
    if (!Object.keys(query).length) return data;
    return data.filter(item =>
      Object.keys(query).every(k => item[k] === query[k])
    );
  },

  // Insert a new record
  insert(file, record) {
    const data = this.read(file);
    data.push(record);
    this.write(file, data);
    return record;
  },

  // Update a record by id
  update(file, id, updates) {
    const data = this.read(file);
    const idx = data.findIndex(item => item.id === id);
    if (idx === -1) return null;
    // Support dot notation for nested updates: 'subscription.plan'
    const updated = { ...data[idx] };
    for (const [key, val] of Object.entries(updates)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        if (!updated[parts[0]]) updated[parts[0]] = {};
        updated[parts[0]][parts[1]] = val;
      } else {
        updated[key] = val;
      }
    }
    data[idx] = updated;
    this.write(file, data);
    return data[idx];
  },

  // Delete a record by id
  delete(file, id) {
    const data = this.read(file);
    const idx = data.findIndex(item => item.id === id);
    if (idx === -1) return false;
    data.splice(idx, 1);
    this.write(file, data);
    return true;
  },

  // Generate a unique ID
  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
};

module.exports = db;
