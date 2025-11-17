// Login logic
document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const result = await response.json();
  if (result.success) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    updateStats();
    fetchComputers();
  } else {
    document.getElementById('login-error').textContent = 'Invalid credentials';
  }
});

// Logout logic
document.getElementById('logout-tab').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('main-app').style.display = 'none';
});

// Sidebar navigation logic
const tabs = [
  { tab: 'dashboard-tab', section: 'dashboard-section' },
  { tab: 'computers-tab', section: 'computers-section' },
  { tab: 'logs-tab', section: 'logs-section' },
  { tab: 'schedule-tab', section: 'schedule-section' },
  { tab: 'users-tab', section: 'users-section' }
];
tabs.forEach(({tab, section}) => {
  document.getElementById(tab).addEventListener('click', function() {
    tabs.forEach(({tab, section}) => {
      document.getElementById(tab).classList.remove('active');
      document.getElementById(section).style.display = 'none';
    });
    this.classList.add('active');
    document.getElementById(section).style.display = 'block';
    if(section === 'computers-section') fetchComputers();
    if(section === 'logs-section') fetchLogs();
    if(section === 'schedule-section') fetchSchedule();
    if(section === 'users-section') fetchUsers();
    if(section === 'dashboard-section') updateStats();
  });
});

// Computer management logic
function fetchComputers() {
  fetch('/api/computers')
    .then(res => res.json())
    .then(renderComputers);
  updateStats();
}

// Real-time status updates
setInterval(fetchComputers, 15000); // Refresh every 15 seconds
function renderComputers(list) {
  const tbody = document.getElementById('computers-tbody');
  tbody.innerHTML = '';
  list.forEach(c => {
    const nextMaint = c.next_maintenance ? new Date(c.next_maintenance).toLocaleDateString() : 'None';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${c.name}</td>
      <td>${c.ip}</td>
      <td>${c.mac}</td>
      <td>${c.location}</td>
      <td><span class="status ${c.status}">${c.status.replace(/-/g, ' ').charAt(0).toUpperCase() + c.status.replace(/-/g, ' ').slice(1)}</span></td>
      <td>${c.log_count || 0}</td>
      <td>${nextMaint}</td>
      <td>
        <button onclick="viewLogs(${c.id})">Logs</button>
        <button onclick="viewSchedule(${c.id})">Schedule</button>
        <button onclick="deleteComputer(${c.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}
// Add computer show/hide form
document.getElementById('showAddForm').onclick = () => {
  document.getElementById('addForm').style.display = 'block';
};
document.getElementById('cancelAdd').onclick = () => {
  document.getElementById('addForm').style.display = 'none';
};
// Add a computer
document.getElementById('addBtn').onclick = function() {
  const body = {
    name: document.getElementById('name').value,
    ip: document.getElementById('ip').value,
    mac: document.getElementById('mac').value,
    location: document.getElementById('location').value,
    status: document.getElementById('status').value
  };
  fetch('/api/computers', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(() => {
      fetchComputers();
      document.getElementById('addForm').style.display = 'none';
      document.getElementById('name').value = '';
      document.getElementById('ip').value = '';
      document.getElementById('mac').value = '';
      document.getElementById('location').value = '';
      document.getElementById('status').value = 'online';
    });
};
// Global deleteComputer function for the table
window.deleteComputer = function(id) {
  if(!confirm('Delete this computer?')) return;
  fetch('/api/computers/' + id, {method: 'DELETE'})
    .then(res => res.json())
    .then(fetchComputers);
};

// View logs for a specific computer
window.viewLogs = function(id) {
  document.getElementById('computers-tab').classList.remove('active');
  document.getElementById('computers-section').style.display = 'none';
  document.getElementById('logs-tab').classList.add('active');
  document.getElementById('logs-section').style.display = 'block';
  fetchLogs();
};

// View schedule for a specific computer
window.viewSchedule = function(id) {
  document.getElementById('computers-tab').classList.remove('active');
  document.getElementById('computers-section').style.display = 'none';
  document.getElementById('schedule-tab').classList.add('active');
  document.getElementById('schedule-section').style.display = 'block';
  fetchSchedule();
};
// Update dashboard stats
function updateStats() {
  fetch('/api/computers').then(res => res.json()).then(list => {
    document.getElementById('stat-total').innerText = list.length;
    document.getElementById('stat-online').innerText = list.filter(c=>c.status=='online').length;
    document.getElementById('stat-offline').innerText = list.filter(c=>c.status=='offline').length;
    document.getElementById('stat-maintain').innerText = list.filter(c=>c.status=='under-maintenance').length;
  });
}
// Maintenance Logs logic
function fetchLogs() {
  fetch('/api/logs')
    .then(res => res.json())
    .then(renderLogs);
}
function renderLogs(list) {
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = '';
  list.forEach(l => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.computer_name}</td>
      <td>${l.date}</td>
      <td>${l.description}</td>
    `;
    tbody.appendChild(row);
  });
}
// Add log show/hide form
document.getElementById('showAddLogForm').onclick = () => {
  fetch('/api/computers').then(res => res.json()).then(computers => {
    const select = document.getElementById('log-computer-id');
    select.innerHTML = '';
    computers.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name;
      select.appendChild(option);
    });
  });
  document.getElementById('addLogForm').style.display = 'block';
};
document.getElementById('cancelAddLog').onclick = () => {
  document.getElementById('addLogForm').style.display = 'none';
};
// Add a log
document.getElementById('addLogBtn').onclick = function() {
  const body = {
    computer_id: document.getElementById('log-computer-id').value,
    date: document.getElementById('log-date').value,
    description: document.getElementById('log-description').value
  };
  fetch('/api/logs', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(() => {
      fetchLogs();
      fetchComputers(); // Update log counts in computers table
      document.getElementById('addLogForm').style.display = 'none';
      document.getElementById('log-date').value = '';
      document.getElementById('log-description').value = '';
    });
};

// Maintenance Schedule logic
function fetchSchedule() {
  fetch('/api/schedule')
    .then(res => res.json())
    .then(renderSchedule);
}
function renderSchedule(list) {
  const tbody = document.getElementById('schedule-tbody');
  tbody.innerHTML = '';
  list.forEach(s => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${s.computer_name}</td>
      <td>${s.scheduled_date}</td>
      <td>${s.task}</td>
    `;
    tbody.appendChild(row);
  });
}
// Add schedule show/hide form
document.getElementById('showAddScheduleForm').onclick = () => {
  fetch('/api/computers').then(res => res.json()).then(computers => {
    const select = document.getElementById('schedule-computer-id');
    select.innerHTML = '';
    computers.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name;
      select.appendChild(option);
    });
  });
  document.getElementById('addScheduleForm').style.display = 'block';
};
document.getElementById('cancelAddSchedule').onclick = () => {
  document.getElementById('addScheduleForm').style.display = 'none';
};
// Add a schedule
document.getElementById('addScheduleBtn').onclick = function() {
  const body = {
    computer_id: document.getElementById('schedule-computer-id').value,
    scheduled_date: document.getElementById('schedule-date').value,
    task: document.getElementById('schedule-task').value
  };
  fetch('/api/schedule', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(() => {
      fetchSchedule();
      fetchComputers(); // Update next maintenance in computers table
      document.getElementById('addScheduleForm').style.display = 'none';
      document.getElementById('schedule-date').value = '';
      document.getElementById('schedule-task').value = '';
    });
};

// Users logic
function fetchUsers() {
  fetch('/api/users')
    .then(res => res.json())
    .then(renderUsers);
}
function renderUsers(list) {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';
  list.forEach(u => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${u.username}</td>
      <td><button onclick="deleteUser(${u.id})">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}
// Add user show/hide form
document.getElementById('showAddUserForm').onclick = () => {
  document.getElementById('addUserForm').style.display = 'block';
};
document.getElementById('cancelAddUser').onclick = () => {
  document.getElementById('addUserForm').style.display = 'none';
};
// Add a user
document.getElementById('addUserBtn').onclick = function() {
  const body = {
    username: document.getElementById('user-username').value,
    password: document.getElementById('user-password').value
  };
  fetch('/api/users', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(() => {
      fetchUsers();
      document.getElementById('addUserForm').style.display = 'none';
      document.getElementById('user-username').value = '';
      document.getElementById('user-password').value = '';
    });
};
// Global deleteUser function for the table
window.deleteUser = function(id) {
  if(!confirm('Delete this user?')) return;
  fetch('/api/users/' + id, {method: 'DELETE'})
    .then(res => res.json())
    .then(fetchUsers);
};

// On initial load, check session
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/session').then(res => res.json()).then(session => {
    if (session.user) {
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('main-app').style.display = 'flex';
      updateStats();
      fetchComputers();
    }
  });
});
