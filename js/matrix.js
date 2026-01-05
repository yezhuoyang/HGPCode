/**
 * Matrix Input Module
 * Handles parsing, validation, and grid rendering for parity check matrices
 */

const MatrixModule = (function() {
    // Preset matrices for common codes
    const PRESETS = {
        'rep3': {
            name: 'Repetition [3,1,3]',
            matrix: [[1, 1, 0], [0, 1, 1]],
            n: 3,
            k: 1,
            d: 3
        },
        'hamming74': {
            name: 'Hamming [7,4,3]',
            matrix: [
                [1, 0, 1, 0, 1, 0, 1],
                [0, 1, 1, 0, 0, 1, 1],
                [0, 0, 0, 1, 1, 1, 1]
            ],
            n: 7,
            k: 4,
            d: 3
        },
        'simple42': {
            name: 'Simple [4,2,2]',
            matrix: [
                [1, 1, 0, 0],
                [0, 0, 1, 1]
            ],
            n: 4,
            k: 2,
            d: 2
        }
    };

    /**
     * Parse text input to matrix
     * Format: rows separated by semicolons, values by commas
     * e.g., "1,1,0;0,1,1" -> [[1,1,0],[0,1,1]]
     */
    function parseMatrix(text) {
        text = text.trim();
        if (!text) return null;

        try {
            const rows = text.split(';').map(row => row.trim()).filter(row => row);
            if (rows.length === 0) return null;

            const matrix = rows.map(row => {
                return row.split(',').map(val => {
                    const num = parseInt(val.trim(), 10);
                    if (isNaN(num) || (num !== 0 && num !== 1)) {
                        throw new Error('Matrix must contain only 0 and 1');
                    }
                    return num;
                });
            });

            // Validate all rows have same length
            const cols = matrix[0].length;
            if (!matrix.every(row => row.length === cols)) {
                throw new Error('All rows must have the same length');
            }

            return matrix;
        } catch (e) {
            console.error('Matrix parse error:', e.message);
            return null;
        }
    }

    /**
     * Convert matrix to text format
     */
    function matrixToText(matrix) {
        return matrix.map(row => row.join(',')).join(';');
    }

    /**
     * Render interactive grid for matrix
     */
    function renderGrid(containerId, matrix, onChange) {
        const container = document.getElementById(containerId);
        if (!container || !matrix) return;

        const rows = matrix.length;
        const cols = matrix[0].length;

        container.style.gridTemplateColumns = `repeat(${cols}, 36px)`;
        container.innerHTML = '';

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell' + (matrix[i][j] === 1 ? ' active' : '');
                cell.textContent = matrix[i][j];
                cell.dataset.row = i;
                cell.dataset.col = j;

                cell.addEventListener('click', () => {
                    matrix[i][j] = matrix[i][j] === 1 ? 0 : 1;
                    cell.textContent = matrix[i][j];
                    cell.classList.toggle('active', matrix[i][j] === 1);
                    if (onChange) onChange(matrix);
                });

                container.appendChild(cell);
            }
        }
    }

    /**
     * Get code parameters from parity check matrix
     */
    function getCodeParams(matrix) {
        if (!matrix || matrix.length === 0) return null;

        const r = matrix.length;      // number of parity checks
        const n = matrix[0].length;   // code length
        const k = n - r;              // dimension (assuming full rank)

        // Distance calculation is NP-hard, so we estimate for small codes
        // For now, just return n, k, r
        return { n, k, r };
    }

    /**
     * Create deep copy of matrix
     */
    function copyMatrix(matrix) {
        return matrix.map(row => [...row]);
    }

    /**
     * Get preset matrix by key
     */
    function getPreset(key) {
        return PRESETS[key] ? copyMatrix(PRESETS[key].matrix) : null;
    }

    /**
     * Get preset info
     */
    function getPresetInfo(key) {
        return PRESETS[key] || null;
    }

    /**
     * Create a new matrix with specified dimensions, initialized to zeros
     */
    function createMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix.push(new Array(cols).fill(0));
        }
        return matrix;
    }

    /**
     * Resize an existing matrix to new dimensions
     * Preserves existing values where possible
     */
    function resizeMatrix(matrix, newRows, newCols) {
        const newMatrix = createMatrix(newRows, newCols);
        if (matrix) {
            const oldRows = matrix.length;
            const oldCols = matrix[0] ? matrix[0].length : 0;
            for (let i = 0; i < Math.min(oldRows, newRows); i++) {
                for (let j = 0; j < Math.min(oldCols, newCols); j++) {
                    newMatrix[i][j] = matrix[i][j];
                }
            }
        }
        return newMatrix;
    }

    return {
        parseMatrix,
        matrixToText,
        renderGrid,
        getCodeParams,
        copyMatrix,
        getPreset,
        getPresetInfo,
        createMatrix,
        resizeMatrix,
        PRESETS
    };
})();
