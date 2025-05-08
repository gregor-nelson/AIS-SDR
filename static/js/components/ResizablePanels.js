// ResizablePanels.js
// This module adds resizable functionality to dashboard panels

export default class ResizablePanels {
    constructor() {
        this.isDragging = false;
        this.currentResizer = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startGridColumnWidth = 0;
        this.startGridRowHeight = 0;
        this.savedLayout = this.loadSavedLayout();
    }

    init() {
        // Create and add resize handles
        this.createResizeHandles();
        
        // Apply saved layout if exists
        if (this.savedLayout) {
            this.applyLayout(this.savedLayout);
        }
        
        // Add event listeners for window resize
        window.addEventListener('resize', () => this.updateResponsiveState());
        
        // Add reset layout button
        this.addResetLayoutButton();
        
        return this;
    }

    createResizeHandles() {
        const grid = document.querySelector('.dashboard-grid');
        if (!grid) return;
        
        // Get all panels
        const panels = grid.querySelectorAll('.panel');
        
        // Add horizontal resize handle between left and right panels
        const horizontalResizer = document.createElement('div');
        horizontalResizer.className = 'panel-resizer horizontal-resizer';
        grid.appendChild(horizontalResizer);
        
        // Add vertical resize handle between top and bottom panels
        const verticalResizer = document.createElement('div');
        verticalResizer.className = 'panel-resizer vertical-resizer';
        grid.appendChild(verticalResizer);
        
        // Add corner resize handle for all four panels
        const cornerResizer = document.createElement('div');
        cornerResizer.className = 'panel-resizer corner-resizer';
        grid.appendChild(cornerResizer);
        
        // Add event listeners for resizers
        this.addResizerEventListeners(horizontalResizer, 'horizontal');
        this.addResizerEventListeners(verticalResizer, 'vertical');
        this.addResizerEventListeners(cornerResizer, 'corner');
        
        // Update initial positions
        this.updateResizerPositions();
    }

    addResizerEventListeners(resizer, type) {
        resizer.addEventListener('mousedown', (e) => this.startResize(e, resizer, type));
        document.addEventListener('mousemove', (e) => this.resize(e));
        document.addEventListener('mouseup', () => this.stopResize());
        
        // Touch events for mobile
        resizer.addEventListener('touchstart', (e) => this.startResize(e, resizer, type), { passive: false });
        document.addEventListener('touchmove', (e) => this.resize(e), { passive: false });
        document.addEventListener('touchend', () => this.stopResize());
    }

    startResize(e, resizer, type) {
        e.preventDefault();
        
        // Get events coords
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const grid = document.querySelector('.dashboard-grid');
        const gridComputedStyle = window.getComputedStyle(grid);
        
        this.isDragging = true;
        this.currentResizer = { element: resizer, type: type };
        this.startX = clientX;
        this.startY = clientY;
        
        // Get current grid template values
        const gridTemplateColumns = gridComputedStyle.getPropertyValue('grid-template-columns');
        const gridTemplateRows = gridComputedStyle.getPropertyValue('grid-template-rows');
        
        // Extract values
        const columnSizes = gridTemplateColumns.split(' ');
        const rowSizes = gridTemplateRows.split(' ');
        
        // Store initial sizes
        this.startGridColumnWidth = parseFloat(columnSizes[0]) / parseFloat(columnSizes[1]);
        this.startGridRowHeight = parseFloat(rowSizes[0]) / parseFloat(rowSizes[1]);
        
        // Add dragging class to grid
        grid.classList.add('grid-resizing');
        
        // Add resizing class to the specific resizer
        resizer.classList.add('resizing');
        
        // Disable text selection while resizing
        document.body.style.userSelect = 'none';
    }

    resize(e) {
        if (!this.isDragging || !this.currentResizer) return;
        
        // Get events coords
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const grid = document.querySelector('.dashboard-grid');
        const gridRect = grid.getBoundingClientRect();
        
        const deltaX = clientX - this.startX;
        const deltaY = clientY - this.startY;
        
        // Calculate new ratios (percentage of total available width/height)
        let columnRatio, rowRatio;
        
        // Update grid template based on resizer type
        switch (this.currentResizer.type) {
            case 'horizontal':
                columnRatio = (clientX - gridRect.left) / gridRect.width;
                // Clamp value to reasonable range (10% to 90%)
                columnRatio = Math.max(0.1, Math.min(0.9, columnRatio));
                grid.style.gridTemplateColumns = `${columnRatio}fr ${1 - columnRatio}fr`;
                break;
                
            case 'vertical':
                rowRatio = (clientY - gridRect.top) / gridRect.height;
                // Clamp value to reasonable range (10% to 90%)
                rowRatio = Math.max(0.1, Math.min(0.9, rowRatio));
                grid.style.gridTemplateRows = `${rowRatio}fr ${1 - rowRatio}fr`;
                break;
                
            case 'corner':
                columnRatio = (clientX - gridRect.left) / gridRect.width;
                rowRatio = (clientY - gridRect.top) / gridRect.height;
                // Clamp values
                columnRatio = Math.max(0.1, Math.min(0.9, columnRatio));
                rowRatio = Math.max(0.1, Math.min(0.9, rowRatio));
                grid.style.gridTemplateColumns = `${columnRatio}fr ${1 - columnRatio}fr`;
                grid.style.gridTemplateRows = `${rowRatio}fr ${1 - rowRatio}fr`;
                break;
        }
        
        // Update resizer positions
        this.updateResizerPositions();
    }

    stopResize() {
        if (!this.isDragging) return;
        
        const grid = document.querySelector('.dashboard-grid');
        
        this.isDragging = false;
        
        // Remove dragging class
        grid.classList.remove('grid-resizing');
        
        // Remove resizing class from resizer
        if (this.currentResizer && this.currentResizer.element) {
            this.currentResizer.element.classList.remove('resizing');
        }
        
        // Enable text selection
        document.body.style.userSelect = '';
        
        // Save the layout
        this.saveLayout();
        
        this.currentResizer = null;
    }

    updateResizerPositions() {
        const grid = document.querySelector('.dashboard-grid');
        if (!grid) return;
        
        const gridRect = grid.getBoundingClientRect();
        
        // Get computed grid template
        const gridStyle = window.getComputedStyle(grid);
        const columns = gridStyle.gridTemplateColumns.split(' ');
        const rows = gridStyle.gridTemplateRows.split(' ');
        
        // Calculate column and row positions
        const firstColWidth = columns[0];
        const firstColWidthPercent = parseFloat(firstColWidth) / 
            (parseFloat(firstColWidth) + parseFloat(columns[1] || firstColWidth));
        
        const firstRowHeight = rows[0];
        const firstRowHeightPercent = parseFloat(firstRowHeight) / 
            (parseFloat(firstRowHeight) + parseFloat(rows[1] || firstRowHeight));
        
        // Get resizers
        const horizontalResizer = document.querySelector('.horizontal-resizer');
        const verticalResizer = document.querySelector('.vertical-resizer');
        const cornerResizer = document.querySelector('.corner-resizer');
        
        if (horizontalResizer) {
            // Position horizontal resizer
            const leftPos = gridRect.width * firstColWidthPercent;
            horizontalResizer.style.left = `${leftPos}px`;
            horizontalResizer.style.height = `${gridRect.height}px`;
            horizontalResizer.style.top = '0';
        }
        
        if (verticalResizer) {
            // Position vertical resizer
            const topPos = gridRect.height * firstRowHeightPercent;
            verticalResizer.style.top = `${topPos}px`;
            verticalResizer.style.width = `${gridRect.width}px`;
            verticalResizer.style.left = '0';
        }
        
        if (cornerResizer) {
            // Position corner resizer at the intersection
            const leftPos = gridRect.width * firstColWidthPercent;
            const topPos = gridRect.height * firstRowHeightPercent;
            cornerResizer.style.left = `${leftPos}px`;
            cornerResizer.style.top = `${topPos}px`;
        }
    }

    saveLayout() {
        try {
            const grid = document.querySelector('.dashboard-grid');
            const gridStyle = window.getComputedStyle(grid);
            
            const layout = {
                gridTemplateColumns: gridStyle.gridTemplateColumns,
                gridTemplateRows: gridStyle.gridTemplateRows
            };
            
            localStorage.setItem('ais-dashboard-layout', JSON.stringify(layout));
        } catch (error) {
            console.warn('Error saving layout:', error);
        }
    }

    loadSavedLayout() {
        try {
            const savedLayoutJSON = localStorage.getItem('ais-dashboard-layout');
            if (savedLayoutJSON) {
                return JSON.parse(savedLayoutJSON);
            }
        } catch (error) {
            console.warn('Error loading saved layout:', error);
        }
        return null;
    }

    applyLayout(layout) {
        const grid = document.querySelector('.dashboard-grid');
        if (!grid || !layout) return;
        
        if (layout.gridTemplateColumns) {
            grid.style.gridTemplateColumns = layout.gridTemplateColumns;
        }
        
        if (layout.gridTemplateRows) {
            grid.style.gridTemplateRows = layout.gridTemplateRows;
        }
        
        // Update resizer positions to match new layout
        setTimeout(() => this.updateResizerPositions(), 100);
    }

    addResetLayoutButton() {
        // Create reset button for layout
        const resetBtn = document.createElement('button');
        resetBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        resetBtn.className = 'reset-layout-button';
        resetBtn.title = 'Reset panel layout';
        
        // Add event listener
        resetBtn.addEventListener('click', () => {
            this.resetLayout();
        });
        
        // Add to dashboard controls
        const controlsContainer = document.querySelector('.dashboard-controls .stats-bar');
        if (controlsContainer) {
            controlsContainer.appendChild(resetBtn);
        }
    }

    resetLayout() {
        // Remove saved layout
        localStorage.removeItem('ais-dashboard-layout');
        
        // Reset grid to default values
        const grid = document.querySelector('.dashboard-grid');
        if (grid) {
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gridTemplateRows = '1fr 1fr';
            
            // Update resizer positions
            this.updateResizerPositions();
        }
    }

    updateResponsiveState() {
        // Check if we should switch to mobile layout
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            // Hide resizers on mobile
            document.querySelectorAll('.panel-resizer').forEach(resizer => {
                resizer.style.display = 'none';
            });
        } else {
            // Show resizers and position them correctly
            document.querySelectorAll('.panel-resizer').forEach(resizer => {
                resizer.style.display = 'block';
            });
            this.updateResizerPositions();
        }
    }
}