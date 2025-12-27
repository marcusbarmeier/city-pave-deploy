
// chatbot.js
// © 2025 City Pave. All Rights Reserved.

const CHAT_STYLES = `
    #cp-chat-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: 'Inter', sans-serif;
    }
    #cp-chat-fab {
        width: 60px;
        height: 60px;
        border-radius: 30px;
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
    }
    #cp-chat-fab:hover { transform: scale(1.05); }
    #cp-chat-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 20px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(20px);
        pointer-events: none;
        transition: all 0.3s ease;
    }
    #cp-chat-window.open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: all;
    }
    .chat-header {
        background: linear-gradient(135deg, #2563EB, #1D4ED8);
        padding: 20px;
        color: white;
    }
    .chat-messages {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #F8FAFC;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 14px;
        line-height: 1.4;
    }
    .message.bot {
        background: white;
        color: #1E293B;
        border-bottom-left-radius: 2px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .message.user {
        background: #2563EB;
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 2px;
    }
    .chat-input-area {
        padding: 16px;
        background: white;
        border-top: 1px solid #E2E8F0;
        display: flex;
        gap: 10px;
    }
    .chat-input {
        flex: 1;
        border: 1px solid #E2E8F0;
        border-radius: 20px;
        padding: 8px 16px;
        outline: none;
        font-size: 14px;
    }
    .chat-input:focus { border-color: #2563EB; }
    .send-btn {
        background: none;
        border: none;
        color: #2563EB;
        cursor: pointer;
        font-weight: 600;
    }
    .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 12px;
        background: white;
        border-radius: 14px;
        width: fit-content;
        border-bottom-left-radius: 2px;
    }
    .dot {
        width: 6px;
        height: 6px;
        background: #94A3B8;
        border-radius: 50%;
        animation: bounce 1.4s infinite ease-in-out both;
    }
    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
    }
`;

class CityPaveChatbot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.init();
    }

    init() {
        // Inject Styles
        const styleSheet = document.createElement("style");
        styleSheet.innerText = CHAT_STYLES;
        document.head.appendChild(styleSheet);

        // Create Widget
        const widget = document.createElement('div');
        widget.id = 'cp-chat-widget';
        widget.innerHTML = `
            <div id="cp-chat-window">
                <div class="chat-header">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg">City Pave AI</h3>
                            <p class="text-xs text-blue-100">Ask me about quotes & services</p>
                        </div>
                        <button id="close-chat" class="ml-auto text-white/80 hover:text-white">&times;</button>
                    </div>
                </div>
                <div class="chat-messages" id="chat-messages"></div>
                <form class="chat-input-area" id="chat-form">
                    <input type="text" class="chat-input" placeholder="Type a message..." id="chat-input" autocomplete="off">
                    <button type="submit" class="send-btn">Send</button>
                </form>
            </div>
            <div id="cp-chat-fab">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
        `;
        document.body.appendChild(widget);

        // Event Listeners
        document.getElementById('cp-chat-fab').addEventListener('click', () => this.toggleChat());
        document.getElementById('close-chat').addEventListener('click', () => this.toggleChat());
        document.getElementById('chat-form').addEventListener('submit', (e) => this.handleSubmit(e));

        // Initial Greeting
        setTimeout(() => this.addBotMessage("Hi there! 👋 I'm the City Pave AI Assistant. How can I help you today?"), 1000);
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const window = document.getElementById('cp-chat-window');
        if (this.isOpen) {
            window.classList.add('open');
            document.getElementById('chat-input').focus();
        } else {
            window.classList.remove('open');
        }
    }

    handleSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        this.addUserMessage(text);
        input.value = '';
        this.processResponse(text);
    }

    addUserMessage(text) {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'message user';
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    addBotMessage(text) {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'message bot';
        div.innerHTML = text; // Allow HTML for links
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    showTyping() {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'typing-indicator';
        div.id = 'typing-indicator';
        div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    hideTyping() {
        const el = document.getElementById('typing-indicator');
        if (el) el.remove();
    }

    async processResponse(text) {
        this.showTyping();

        // Simulate AI Delay
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

        this.hideTyping();
        const lower = text.toLowerCase();

        let response = "I'm not sure about that. Would you like to speak to a human agent?";

        if (lower.includes('quote') || lower.includes('estimate') || lower.includes('cost')) {
            response = "I can help with that! You can get a free instant quote using our <a href='/modules/estimator/index.html' class='text-blue-600 font-bold underline'>Online Estimator</a>. It takes less than 2 minutes!";
        } else if (lower.includes('snow') || lower.includes('plow')) {
            response = "We offer comprehensive snow removal services for commercial properties. Are you looking for a seasonal contract or per-push pricing?";
        } else if (lower.includes('paving') || lower.includes('asphalt')) {
            response = "We specialize in commercial and residential asphalt paving. From driveways to parking lots, we do it all.";
        } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('email')) {
            response = "You can reach our office at <b>(555) 123-4567</b> or email <b>info@citypave.ca</b>.";
        } else if (lower.includes('hello') || lower.includes('hi')) {
            response = "Hello! How can I assist you with your paving or snow removal needs today?";
        }

        this.addBotMessage(response);
    }
}

// Initialize
new CityPaveChatbot();
