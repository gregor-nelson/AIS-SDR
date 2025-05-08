// FullscreenPanels.js
// This module adds fullscreen capability to dashboard panels

export default class FullscreenPanels {
    constructor() {
        this.currentFullscreenPanel = null;
    }

    init() {
        // Add fullscreen buttons to all panels
        this.addFullscreenButtons();
        
        // Add escape key handler for exiting fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentFullscreenPanel) {
                this.exitFullscreen();
            }
        });
        
        return this;
    }

    addFullscreenButtons() {
        const panels = document.querySelectorAll('.panel');
        
        panels.forEach(panel => {
            // Create fullscreen button
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenBtn.className = 'fullscreen-button';
            fullscreenBtn.title = 'Expand panel to fullscreen';
            
            // Add event listener
            fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                
                if (panel.classList.contains('fullscreen')) {
                    this.exitFullscreen();
                } else {
                    this.enterFullscreen(panel);
                }
            });
            
            // Add to panel header controls
            const panelControls = panel.querySelector('.panel-controls');
            if (panelControls) {
                panelControls.insertBefore(fullscreenBtn, panelControls.firstChild);
            } else {
                // If no panel controls exist, add to panel header
                const panelHeader = panel.querySelector('.panel-header');
                if (panelHeader) {
                    const newControls = document.createElement('div');
                    newControls.className = 'panel-controls';
                    newControls.appendChild(fullscreenBtn);
                    panelHeader.appendChild(newControls);
                }
            }
        });
    }

    enterFullscreen(panel) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-overlay';
        document.body.appendChild(overlay);
        
        // Save current panel to class variable
        this.currentFullscreenPanel = panel;
        
        // Add fullscreen class to panel
        panel.classList.add('fullscreen');
        
        // Change button icon
        const fullscreenBtn = panel.querySelector('.fullscreen-button');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            fullscreenBtn.title = 'Exit fullscreen';
        }
        
        // Disable body scroll
        document.body.style.overflow = 'hidden';
        
        // Event for overlay click to exit
        overlay.addEventListener('click', () => this.exitFullscreen());
        
        // Dispatch event for other components to handle
        const event = new CustomEvent('panel:fullscreen', {
            detail: { panel: panel, state: 'enter' }
        });
        document.dispatchEvent(event);
    }

    exitFullscreen() {
        if (!this.currentFullscreenPanel) return;
        
        // Remove fullscreen class
        this.currentFullscreenPanel.classList.remove('fullscreen');
        
        // Change button icon back
        const fullscreenBtn = this.currentFullscreenPanel.querySelector('.fullscreen-button');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenBtn.title = 'Expand panel to fullscreen';
        }
        
        // Remove overlay
        const overlay = document.querySelector('.fullscreen-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
        
        // Enable body scroll
        document.body.style.overflow = '';
        
        // Dispatch event for other components to handle
        const event = new CustomEvent('panel:fullscreen', {
            detail: { panel: this.currentFullscreenPanel, state: 'exit' }
        });
        document.dispatchEvent(event);
        
        // Clear current panel reference
        this.currentFullscreenPanel = null;
    }
}