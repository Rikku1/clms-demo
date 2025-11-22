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
    const row = document.createElement('tr');
    row.classList.add('computer-row');
    row.innerHTML = `
      <td>${c.name}</td>
      <td><span class="status ${c.status}">${c.status.replace(/-/g, ' ').charAt(0).toUpperCase() + c.status.replace(/-/g, ' ').slice(1)}</span></td>
    `;
    row.addEventListener('click', () => toggleComputerDetails(c));
    tbody.appendChild(row);
  });
}

function toggleComputerDetails(computer) {
  const tbody = document.getElementById('computers-tbody');
  let detailsRow = tbody.querySelector(`.computer-details[data-computer-id="${computer.id}"]`);

  if (detailsRow) {
    // If details are already shown, hide them
    detailsRow.remove();
  } else {
    // Hide any other open details
    tbody.querySelectorAll('.computer-details').forEach(row => row.remove());

    // Create and show details row
    detailsRow = document.createElement('tr');
    detailsRow.classList.add('computer-details');
    detailsRow.setAttribute('data-computer-id', computer.id);

    const nextMaint = computer.next_maintenance ? new Date(computer.next_maintenance).toLocaleDateString() : 'None';

    detailsRow.innerHTML = `
      <td colspan="2">
        <div class="computer-details-content">
          <div class="computer-info">
            <h3>Computer Details</h3>
            <p><strong>IP:</strong> ${computer.ip}</p>
            <p><strong>MAC:</strong> ${computer.mac}</p>
            <p><strong>Location:</strong> ${computer.location}</p>
            <p><strong>Logs Count:</strong> ${computer.log_count || 0}</p>
            <p><strong>Next Maintenance:</strong> ${nextMaint}</p>
            <div class="computer-actions">
              <button onclick="viewLogs(${computer.id})">View Logs</button>
              <button onclick="viewSchedule(${computer.id})">View Schedule</button>
              <button onclick="deleteComputer(${computer.id})">Delete Computer</button>
            </div>
          </div>
          <div class="peripherals-section">
            <h3>Connected Peripherals</h3>
            <div id="peripherals-${computer.id}" class="peripherals-list">
              <p>Loading peripherals...</p>
            </div>
          </div>
        </div>
      </td>
    `;

    // Insert after the computer row
    const computerRow = tbody.querySelector(`.computer-row`);
    computerRow.insertAdjacentElement('afterend', detailsRow);

    // Fetch and display peripherals
    fetch(`/api/peripherals?computer_id=${computer.id}`)
      .then(res => res.json())
      .then(peripherals => {
        const peripheralsDiv = document.getElementById(`peripherals-${computer.id}`);
        if (peripherals.length === 0) {
          peripheralsDiv.innerHTML = '<p>No peripherals connected.</p>';
        } else {
          peripheralsDiv.innerHTML = peripherals.map(p => `
            <div class="peripheral-item">
              <span class="peripheral-name">${p.name}</span>
              <span class="peripheral-type">${p.type}</span>
              <span class="peripheral-status ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
              <span class="peripheral-last-seen">Last seen: ${p.last_seen ? new Date(p.last_seen).toLocaleString() : 'Never'}</span>
            </div>
          `).join('');
        }
      })
      .catch(err => {
        console.error('Error fetching peripherals:', err);
        const peripheralsDiv = document.getElementById(`peripherals-${computer.id}`);
        peripheralsDiv.innerHTML = '<p>Error loading peripherals.</p>';
      });
  }
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

// Peripherals logic
function fetchPeripherals() {
  fetch('/api/peripherals')
    .then(res => res.json())
    .then(renderPeripherals);
}
function renderPeripherals(list) {
  const tbody = document.getElementById('peripherals-tbody');
  tbody.innerHTML = '';
  list.forEach(p => {
    const lastSeen = p.last_seen ? new Date(p.last_seen).toLocaleString() : 'Never';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${p.computer_name}</td>
      <td>${p.name}</td>
      <td>${p.type}</td>
      <td><span class="status ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></td>
      <td>${lastSeen}</td>
      <td>
        <button onclick="deletePeripheral(${p.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}
// Add peripheral show/hide form
document.getElementById('showAddPeripheralForm').onclick = () => {
  fetch('/api/computers').then(res => res.json()).then(computers => {
    const select = document.getElementById('peripheral-computer-id');
    select.innerHTML = '';
    computers.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name;
      select.appendChild(option);
    });
  });
  document.getElementById('addPeripheralForm').style.display = 'block';
};
document.getElementById('cancelAddPeripheral').onclick = () => {
  document.getElementById('addPeripheralForm').style.display = 'none';
};
// Add a peripheral
document.getElementById('addPeripheralBtn').onclick = function() {
  const body = {
    computer_id: document.getElementById('peripheral-computer-id').value,
    name: document.getElementById('peripheral-name').value,
    type: document.getElementById('peripheral-type').value,
    status: document.getElementById('peripheral-status').value,
    last_seen: new Date().toISOString()
  };
  fetch('/api/peripherals', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(() => {
      fetchPeripherals();
      document.getElementById('addPeripheralForm').style.display = 'none';
      document.getElementById('peripheral-name').value = '';
      document.getElementById('peripheral-type').value = 'USB';
      document.getElementById('peripheral-status').value = 'connected';
    });
};
// Global deletePeripheral function for the table
window.deletePeripheral = function(id) {
  if(!confirm('Delete this peripheral?')) return;
  fetch('/api/peripherals/' + id, {method: 'DELETE'})
    .then(res => res.json())
    .then(fetchPeripherals);
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
