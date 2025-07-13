let socket = null;
let currentUser = null;
let commandHistory = [];
let historyIndex = -1;

// Authentication functions
async function login() {
	const username = document.getElementById('username').value;
	const password = document.getElementById('password').value;

	try {
		const response = await fetch('http://localhost:3001/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password })
		});

		const data = await response.json();

		if (response.ok) {
			currentUser = data.user;
			localStorage.setItem('webos-token', data.token);
			connectWebSocket(data.token);
		} else {
			alert('Login failed: ' + data.error);
		}
	} catch (error) {
		alert('Login error: ' + error.message);
	}
}

async function register() {
	const username = document.getElementById('username').value;
	const password = document.getElementById('password').value;

	if (!username || !password) {
		alert('Please enter username and password');
		return;
	}

	try {
		const response = await fetch('http://localhost:3001/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username,
				password,
				email: `${username}@webos.com`
			})
		});

		const data = await response.json();

		if (response.ok) {
			currentUser = data.user;
			localStorage.setItem('webos-token', data.token);
			connectWebSocket(data.token);
		} else {
			alert('Registration failed: ' + data.error);
		}
	} catch (error) {
		alert('Registration error: ' + error.message);
	}
}

async function anonymousLogin() {
	try {
		const response = await fetch('http://localhost:3001/api/auth/anonymous', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});

		const data = await response.json();

		if (response.ok) {
			currentUser = data.user;
			localStorage.setItem('webos-token', data.token);
			connectWebSocket(data.token);
		} else {
			alert('Anonymous login failed: ' + data.error);
		}
	} catch (error) {
		alert('Anonymous login error: ' + error.message);
	}
}

function connectWebSocket(token) {
	socket = io('http://localhost:3000', {
		auth: { token }
	});

	socket.on('connect', () => {
		console.log('Connected to WebSocket');
		document.getElementById('login-form').classList.add('hidden');
		document.getElementById('main-container').classList.remove('hidden');
		document.getElementById('command-input').focus();
		updatePrompt();
		socket.emit('user_connected');
	});

	socket.on('output', (data) => {
		if (data.output) {
			appendOutput(data.output);
		}
		if (data.error) {
			appendOutput(data.error, 'error');
		}
	});

	socket.on('clear', () => {
		document.getElementById('output').innerHTML = '';
	});

	socket.on('disconnect', () => {
		console.log('Disconnected from WebSocket');
		appendOutput('Connection lost. Please refresh the page.', 'error');
	});

	socket.on('connect_error', (error) => {
		console.error('Connection error:', error);
		alert('Connection failed. Please try again.');
	});
}

function appendOutput(text, className = '') {
	const outputDiv = document.getElementById('output');
	const line = document.createElement('div');
	line.className = `output ${className}`;
	line.textContent = text;
	outputDiv.appendChild(line);

	// Auto-scroll
	document.getElementById('terminal').scrollTop = document.getElementById('terminal').scrollHeight;
}

function updatePrompt() {
	const promptElement = document.getElementById('prompt');
	if (currentUser) {
		promptElement.textContent = `${currentUser.username}@webos:~$ `;
	}
}

// Command input handling
document.getElementById('command-input').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		const command = e.target.value.trim();
		if (command && socket) {
			// Add to history
			commandHistory.push(command);
			historyIndex = commandHistory.length;

			// Show command in terminal
			appendOutput(`${document.getElementById('prompt').textContent}${command}`);

			// Send command
			socket.emit('command', { command });

			// Clear input
			e.target.value = '';
		}
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		if (historyIndex > 0) {
			historyIndex--;
			e.target.value = commandHistory[historyIndex];
		}
	} else if (e.key === 'ArrowDown') {
		e.preventDefault();
		if (historyIndex < commandHistory.length - 1) {
			historyIndex++;
			e.target.value = commandHistory[historyIndex];
		} else {
			historyIndex = commandHistory.length;
			e.target.value = '';
		}
	}
});

// Check for existing token on page load
window.addEventListener('load', () => {
	const token = localStorage.getItem('webos-token');
	if (token) {
		fetch('http://localhost:3001/api/auth/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token })
		})
			.then(response => response.json())
			.then(data => {
				if (data.user) {
					currentUser = data.user;
					connectWebSocket(token);
				}
			})
			.catch(() => {
				localStorage.removeItem('webos-token');
			});
	}
});

// Chat functionality
document.getElementById('chat-send').addEventListener('click', sendChatMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		sendChatMessage();
	}
});

function sendChatMessage() {
	const input = document.getElementById('chat-input');
	const message = input.value.trim();

	if (message && socket) {
		socket.emit('chat_message', { message });
		input.value = '';
	}
}

// Mode toggle
document.getElementById('mode-toggle').addEventListener('click', () => {
	const chatPanel = document.getElementById('chat-panel');
	const terminal = document.getElementById('terminal');

	if (chatPanel.style.display === 'none') {
		chatPanel.style.display = 'flex';
		terminal.style.flex = '1';
	} else {
		chatPanel.style.display = 'none';
		terminal.style.flex = '1';
	}
});

// Chat message handling
socket.on('chat_message', (data) => {
	const chatMessages = document.getElementById('chat-messages');
	const messageDiv = document.createElement('div');
	messageDiv.className = 'chat-message';

	const time = new Date().toLocaleTimeString();
	messageDiv.innerHTML = `
      <span class="time">[${time}]</span>
      <span class="username">${data.username}:</span>
      ${data.message}
  `;

	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('system_message', (data) => {
	const chatMessages = document.getElementById('chat-messages');
	const messageDiv = document.createElement('div');
	messageDiv.className = 'chat-message system';
	messageDiv.textContent = data.message;
	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('users_update', (data) => {
	document.getElementById('users-online').textContent = `Users Online: ${data.count}`;
});

// Keep chat input and command input from interfering
document.getElementById('chat-input').addEventListener('focus', () => {
	document.getElementById('command-input').blur();
});

document.getElementById('command-input').addEventListener('focus', () => {
	document.getElementById('chat-input').blur();
});