import * as Utils from './Utils.js';

export default class UIController {
    constructor(options = {}) {
        this.msgRateElement = options.msgRateElement;
        this.uptimeElement = options.uptimeElement;
        this.serverTimeElement = options.serverTimeElement;
        this.messageRateCount = 0;
        this.lastRateCheck = Date.now();
        this.startTime = options.startTime || Date.now();
    }

    init() {
        // Set up periodic updates
        setInterval(() => {
            this.updateMessageRate();
            this.updateTime();
            this.updateAllTimes();
        }, 1000);
        
        // Initialize toggle buttons
        this.initToggles();
        
        return this;
    }

    initToggles() {
        // Find all toggle buttons and add highlight effect
        document.querySelectorAll('.toggle-button').forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.05)';
            });
            
            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('active')) {
                    button.style.transform = '';
                }
            });
        });
    }

    updateMessageRate() {
        if (!this.msgRateElement) return;
        
        const now = Date.now();
        const elapsed = (now - this.lastRateCheck) / 1000;
        
        if (elapsed >= 1) {
            const rate = this.messageRateCount / elapsed;
            const prevRate = parseFloat(this.msgRateElement.textContent);
            
            this.msgRateElement.textContent = `${rate.toFixed(1)}/s`;
            
            // Add highlight effect for rate changes
            if (Math.abs(prevRate - rate) > 0.5) {
                this.msgRateElement.classList.add('highlight');
                setTimeout(() => this.msgRateElement.classList.remove('highlight'), 800);
            }
            
            this.messageRateCount = 0;
            this.lastRateCheck = now;
        }
    }

    updateTime() {
        // Update server time display
        if (this.serverTimeElement) {
            const now = new Date();
            this.serverTimeElement.textContent = now.toLocaleTimeString();
        }
        
        // Update uptime
        if (this.uptimeElement) {
            const uptimeMs = Date.now() - this.startTime;
            const hours = Math.floor(uptimeMs / 3600000);
            const minutes = Math.floor((uptimeMs % 3600000) / 60000);
            const seconds = Math.floor((uptimeMs % 60000) / 1000);
            this.uptimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    updateAllTimes() {
        // Update all time-ago elements
        document.querySelectorAll('.time-ago').forEach(el => {
            const timeValue = el.getAttribute('data-time');
            if (timeValue) {
                el.textContent = Utils.formatTimeSince(parseFloat(timeValue));
            }
        });
    }

    incrementMessageCount() {
        this.messageRateCount++;
    }
    
    setStartTime(time) {
        this.startTime = time;
    }
    
    applyStatHighlight(element) {
        if (!element) return;
        
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 800);
    }
}