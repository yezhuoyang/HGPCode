/**
 * Main Application Entry Point
 * Coordinates all modules and handles UI interactions
 */

(function() {
    // State
    let matrix1 = null;
    let matrix2 = null;
    let currentHGPCode = null;
    let currentErrorType = 'X';

    // DOM Elements
    const elements = {
        preset1: null,
        preset2: null,
        matrix1Text: null,
        matrix2Text: null,
        matrix1Grid: null,
        matrix2Grid: null,
        params1: null,
        params2: null,
        rows1: null,
        cols1: null,
        rows2: null,
        cols2: null,
        resize1Btn: null,
        resize2Btn: null,
        generateBtn: null,
        hgpParams: null,
        errorType: null,
        clearErrorsBtn: null,
        canvas: null,
        tanner1Canvas: null,
        tanner2Canvas: null
    };

    /**
     * Initialize the application
     */
    function init() {
        // Get DOM elements
        elements.preset1 = document.getElementById('preset1');
        elements.preset2 = document.getElementById('preset2');
        elements.matrix1Text = document.getElementById('matrix1-text');
        elements.matrix2Text = document.getElementById('matrix2-text');
        elements.matrix1Grid = document.getElementById('matrix1-grid');
        elements.matrix2Grid = document.getElementById('matrix2-grid');
        elements.params1 = document.getElementById('params1');
        elements.params2 = document.getElementById('params2');
        elements.rows1 = document.getElementById('rows1');
        elements.cols1 = document.getElementById('cols1');
        elements.rows2 = document.getElementById('rows2');
        elements.cols2 = document.getElementById('cols2');
        elements.resize1Btn = document.getElementById('resize1-btn');
        elements.resize2Btn = document.getElementById('resize2-btn');
        elements.generateBtn = document.getElementById('generate-btn');
        elements.hgpParams = document.getElementById('hgp-params');
        elements.errorType = document.getElementById('error-type');
        elements.clearErrorsBtn = document.getElementById('clear-errors-btn');
        elements.canvas = document.getElementById('hgp-canvas');
        elements.tanner1Canvas = document.getElementById('tanner1-canvas');
        elements.tanner2Canvas = document.getElementById('tanner2-canvas');

        // Initialize visualization module
        VizModule.init('hgp-canvas');

        // Set up event listeners
        setupEventListeners();

        // Initialize with preset values
        loadPreset(1, 'rep3');
        loadPreset(2, 'rep3');

        // Auto-generate on load
        generateHGPCode();
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Preset selectors
        elements.preset1.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                loadPreset(1, e.target.value);
            }
        });

        elements.preset2.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                loadPreset(2, e.target.value);
            }
        });

        // Text input changes
        elements.matrix1Text.addEventListener('input', () => {
            elements.preset1.value = 'custom';
            updateMatrixFromText(1);
        });

        elements.matrix2Text.addEventListener('input', () => {
            elements.preset2.value = 'custom';
            updateMatrixFromText(2);
        });

        // Resize buttons
        elements.resize1Btn.addEventListener('click', () => resizeMatrix(1));
        elements.resize2Btn.addEventListener('click', () => resizeMatrix(2));

        // Generate button
        elements.generateBtn.addEventListener('click', generateHGPCode);

        // Error type selector
        elements.errorType.addEventListener('change', (e) => {
            currentErrorType = e.target.value;
        });

        // Clear errors button
        elements.clearErrorsBtn.addEventListener('click', () => {
            VizModule.clearErrors();
        });

        // Canvas click handler
        elements.canvas.addEventListener('click', handleCanvasClick);
    }

    /**
     * Resize matrix to new dimensions
     */
    function resizeMatrix(matrixNum) {
        const rowsEl = matrixNum === 1 ? elements.rows1 : elements.rows2;
        const colsEl = matrixNum === 1 ? elements.cols1 : elements.cols2;
        const presetEl = matrixNum === 1 ? elements.preset1 : elements.preset2;

        const newRows = parseInt(rowsEl.value, 10) || 2;
        const newCols = parseInt(colsEl.value, 10) || 3;

        // Clamp values
        const rows = Math.max(1, Math.min(10, newRows));
        const cols = Math.max(1, Math.min(10, newCols));

        rowsEl.value = rows;
        colsEl.value = cols;

        // Set preset to custom
        presetEl.value = 'custom';

        // Resize the matrix
        const currentMatrix = matrixNum === 1 ? matrix1 : matrix2;
        const newMatrix = MatrixModule.resizeMatrix(currentMatrix, rows, cols);

        if (matrixNum === 1) {
            matrix1 = newMatrix;
            elements.matrix1Text.value = MatrixModule.matrixToText(newMatrix);
            MatrixModule.renderGrid('matrix1-grid', matrix1, (m) => {
                matrix1 = m;
                elements.matrix1Text.value = MatrixModule.matrixToText(m);
                updateParams(1);
                drawTannerGraph(1);
            });
        } else {
            matrix2 = newMatrix;
            elements.matrix2Text.value = MatrixModule.matrixToText(newMatrix);
            MatrixModule.renderGrid('matrix2-grid', matrix2, (m) => {
                matrix2 = m;
                elements.matrix2Text.value = MatrixModule.matrixToText(m);
                updateParams(2);
                drawTannerGraph(2);
            });
        }

        updateParams(matrixNum);
        drawTannerGraph(matrixNum);
    }

    /**
     * Load a preset matrix
     */
    function loadPreset(matrixNum, presetKey) {
        const preset = MatrixModule.getPreset(presetKey);
        if (!preset) return;

        // Update size inputs
        const rows = preset.length;
        const cols = preset[0].length;

        if (matrixNum === 1) {
            elements.rows1.value = rows;
            elements.cols1.value = cols;
            matrix1 = preset;
            elements.matrix1Text.value = MatrixModule.matrixToText(preset);
            MatrixModule.renderGrid('matrix1-grid', matrix1, (m) => {
                matrix1 = m;
                elements.matrix1Text.value = MatrixModule.matrixToText(m);
                elements.preset1.value = 'custom';
                updateParams(1);
                drawTannerGraph(1);
            });
        } else {
            elements.rows2.value = rows;
            elements.cols2.value = cols;
            matrix2 = preset;
            elements.matrix2Text.value = MatrixModule.matrixToText(preset);
            MatrixModule.renderGrid('matrix2-grid', matrix2, (m) => {
                matrix2 = m;
                elements.matrix2Text.value = MatrixModule.matrixToText(m);
                elements.preset2.value = 'custom';
                updateParams(2);
                drawTannerGraph(2);
            });
        }

        updateParams(matrixNum);
        drawTannerGraph(matrixNum);
    }

    /**
     * Update matrix from text input
     */
    function updateMatrixFromText(matrixNum) {
        const textEl = matrixNum === 1 ? elements.matrix1Text : elements.matrix2Text;
        const parsed = MatrixModule.parseMatrix(textEl.value);

        if (parsed) {
            // Update size inputs
            const rows = parsed.length;
            const cols = parsed[0].length;

            if (matrixNum === 1) {
                elements.rows1.value = rows;
                elements.cols1.value = cols;
                matrix1 = parsed;
                MatrixModule.renderGrid('matrix1-grid', matrix1, (m) => {
                    matrix1 = m;
                    elements.matrix1Text.value = MatrixModule.matrixToText(m);
                    updateParams(1);
                    drawTannerGraph(1);
                });
            } else {
                elements.rows2.value = rows;
                elements.cols2.value = cols;
                matrix2 = parsed;
                MatrixModule.renderGrid('matrix2-grid', matrix2, (m) => {
                    matrix2 = m;
                    elements.matrix2Text.value = MatrixModule.matrixToText(m);
                    updateParams(2);
                    drawTannerGraph(2);
                });
            }
            updateParams(matrixNum);
            drawTannerGraph(matrixNum);
        }
    }

    /**
     * Update code parameters display
     */
    function updateParams(matrixNum) {
        const matrix = matrixNum === 1 ? matrix1 : matrix2;
        const paramsEl = matrixNum === 1 ? elements.params1 : elements.params2;

        if (!matrix) {
            paramsEl.textContent = '';
            return;
        }

        const params = MatrixModule.getCodeParams(matrix);
        if (params) {
            paramsEl.innerHTML = `
                <strong>Code C<sub>${matrixNum}</sub>:</strong>
                n = ${params.n}, r = ${params.r}, k = ${params.k}
            `;
        }
    }

    /**
     * Draw Tanner graph for a classical code
     */
    function drawTannerGraph(matrixNum) {
        const matrix = matrixNum === 1 ? matrix1 : matrix2;
        const canvasId = matrixNum === 1 ? 'tanner1-canvas' : 'tanner2-canvas';

        if (matrix) {
            TannerVizModule.drawTannerGraph(canvasId, matrix);
        }
    }

    /**
     * Generate HGP code from current matrices
     */
    function generateHGPCode() {
        if (!matrix1 || !matrix2) {
            alert('Please enter valid parity check matrices for both codes.');
            return;
        }

        try {
            currentHGPCode = HGPModule.constructHGP(matrix1, matrix2);

            // Update HGP parameters display
            elements.hgpParams.innerHTML = `
                <strong>HGP Code [[${currentHGPCode.N}, ${currentHGPCode.K}]]:</strong><br>
                Physical qubits: N = ${currentHGPCode.n1}&times;${currentHGPCode.n2} + ${currentHGPCode.r1}&times;${currentHGPCode.r2} = ${currentHGPCode.N}<br>
                Logical qubits: K = ${currentHGPCode.k1}&times;${currentHGPCode.k2} = ${currentHGPCode.K}<br>
                X-checks: ${currentHGPCode.numXChecks} | Z-checks: ${currentHGPCode.numZChecks}
            `;

            // Initialize visualization
            VizModule.setCode(currentHGPCode);

            // Draw Tanner graphs
            drawTannerGraph(1);
            drawTannerGraph(2);

        } catch (e) {
            console.error('Error generating HGP code:', e);
            alert('Error generating HGP code: ' + e.message);
        }
    }

    /**
     * Handle canvas click for error placement
     */
    function handleCanvasClick(event) {
        const result = VizModule.handleClick(event);

        if (result && result.type === 'qubit') {
            VizModule.toggleError(result.qubitIdx, currentErrorType);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
