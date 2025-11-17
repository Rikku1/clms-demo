const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const ping = require('ping');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(session({ secret: 'clms-secret-key', resave: false, saveUninitialized: false }));
app.use(express.static('public')); // Serves frontend files

const db = new sqlite3.Database('./clms.db');

// Create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS computers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    ip TEXT,
    mac TEXT,
    location TEXT,
    status TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computer_id INTEGER,
    date TEXT,
    description TEXT,
    FOREIGN KEY (computer_id) REFERENCES computers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computer_id INTEGER,
    scheduled_date TEXT,
    task TEXT,
    FOREIGN KEY (computer_id) REFERENCES computers(id)
  )`);

  // Insert default user if not exists
  db.run(`INSERT OR IGNORE INTO users (username, password) VALUES ('user', 'user')`, (err) => {
    if (err) console.error('Error inserting default user:', err);
  });
});

// Helper functions
function generateIP() {
  return `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function generateMAC() {
  const hexDigits = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 6; i++) {
    mac += hexDigits.charAt(Math.floor(Math.random() * 16)) + hexDigits.charAt(Math.floor(Math.random() * 16));
    if (i < 5) mac += ':';
  }
  return mac;
}

// Ping function to check device status
async function checkDeviceStatus(ip) {
  try {
    const res = await ping.promise.probe(ip, { timeout: 2 });
    return res.alive;
  } catch (error) {
    return false;
  }
}

// Update device statuses periodically
async function updateDeviceStatuses() {
  try {
    const computers = await new Promise((resolve, reject) => {
      db.all('SELECT id, ip, status FROM computers', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Get computers with maintenance scheduled for today
    const maintenanceComputers = await new Promise((resolve, reject) => {
      db.all('SELECT computer_id FROM maintenance_schedule WHERE scheduled_date = ?', [today], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.computer_id));
      });
    });

    for (const computer of computers) {
      let newStatus = computer.status;

      // Check if maintenance is scheduled for today
      if (maintenanceComputers.includes(computer.id)) {
        newStatus = 'under-maintenance';
      } else {
        // Otherwise, check online status
        const isOnline = await checkDeviceStatus(computer.ip);
        newStatus = isOnline ? 'online' : 'offline';
      }

      // Only update if status changed
      if (computer.status !== newStatus) {
        db.run('UPDATE computers SET status = ? WHERE id = ?', [newStatus, computer.id], (err) => {
          if (err) console.error('Error updating status:', err);
        });

        // Auto-log status changes
        const date = new Date().toISOString().split('T')[0];
        const description = `Status changed from ${computer.status} to ${newStatus}`;

        if (newStatus === 'under-maintenance') {
          // Log only once per day for under-maintenance
          db.get(
            'SELECT id FROM maintenance_logs WHERE computer_id = ? AND date = ? AND description LIKE ?',
            [computer.id, date, '%to under-maintenance%'],
            (err, row) => {
              if (err) console.error('Error checking existing maintenance log:', err);
              else if (!row) {
                db.run(
                  'INSERT INTO maintenance_logs (computer_id, date, description) VALUES (?, ?, ?)',
                  [computer.id, date, description],
                  (err) => {
                    if (err) console.error('Error auto-logging maintenance start:', err);
                  }
                );
              }
            }
          );
        } else {
          // Log every time for online/offline
          db.run(
            'INSERT INTO maintenance_logs (computer_id, date, description) VALUES (?, ?, ?)',
            [computer.id, date, description],
            (err) => {
              if (err) console.error('Error auto-logging status change:', err);
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error updating device statuses:', error);
  }
}

// Start periodic status updates every 15 seconds
setInterval(updateDeviceStatuses, 15000);

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// REST API

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (row) {
      req.session.user = row;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Check session
app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

// Get all computers with maintenance info
app.get('/api/computers', requireAuth, (req, res) => {
  const query = `
    SELECT c.*,
           (SELECT COUNT(*) FROM maintenance_logs WHERE computer_id = c.id) as log_count,
           (SELECT scheduled_date FROM maintenance_schedule WHERE computer_id = c.id ORDER BY scheduled_date ASC LIMIT 1) as next_maintenance
    FROM computers c
    ORDER BY c.name ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// Add new computer
app.post('/api/computers', requireAuth, (req, res) => {
  let { name, ip, mac, location, status } = req.body;
  if (!ip) ip = generateIP();
  if (!mac) mac = generateMAC();
  db.run(
    'INSERT INTO computers (name, ip, mac, location, status) VALUES (?, ?, ?, ?, ?)',
    [name, ip, mac, location, status],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID });
    }
  );
});

// Delete computer
app.delete('/api/computers/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM computers WHERE id = ?', [req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ deleted: this.changes });
  });
});

// Update computer
app.put('/api/computers/:id', requireAuth, (req, res) => {
  const { name, ip, mac, location, status } = req.body;
  db.run(
    'UPDATE computers SET name = ?, ip = ?, mac = ?, location = ?, status = ? WHERE id = ?',
    [name, ip, mac, location, status, req.params.id],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ updated: this.changes });
    }
  );
});

// Maintenance Logs
app.get('/api/logs', requireAuth, (req, res) => {
  const query = `
    SELECT l.id, l.computer_id, c.name as computer_name, l.date, l.description
    FROM maintenance_logs l
    JOIN computers c ON l.computer_id = c.id
    ORDER BY l.date DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/logs', requireAuth, (req, res) => {
  const { computer_id, date, description } = req.body;
  db.run(
    'INSERT INTO maintenance_logs (computer_id, date, description) VALUES (?, ?, ?)',
    [computer_id, date, description],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID });
    }
  );
});

// Maintenance Schedule
app.get('/api/schedule', requireAuth, (req, res) => {
  const query = `
    SELECT s.id, s.computer_id, c.name as computer_name, s.scheduled_date, s.task
    FROM maintenance_schedule s
    JOIN computers c ON s.computer_id = c.id
    ORDER BY s.scheduled_date ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/schedule', requireAuth, (req, res) => {
  const { computer_id, scheduled_date, task } = req.body;
  db.run(
    'INSERT INTO maintenance_schedule (computer_id, scheduled_date, task) VALUES (?, ?, ?)',
    [computer_id, scheduled_date, task],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID });
    }
  );
});

// Users
app.get('/api/users', requireAuth, (req, res) => {
  db.all('SELECT id, username FROM users', [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.post('/api/users', requireAuth, (req, res) => {
  const { username, password } = req.body;
  db.run(
    'INSERT INTO users (username, password) VALUES (?, ?)',
    [username, password],
    function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id: this.lastID });
    }
  );
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ deleted: this.changes });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
 