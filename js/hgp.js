/**
 * HGP Code Logic Module
 * Implements the Hypergraph Product construction for QLDPC codes
 */

const HGPModule = (function() {
    /**
     * Compute Kronecker (tensor) product of two matrices
     * A ⊗ B
     */
    function kronecker(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const rowsB = B.length;
        const colsB = B[0].length;

        const result = [];
        for (let i = 0; i < rowsA * rowsB; i++) {
            result.push(new Array(colsA * colsB).fill(0));
        }

        for (let i = 0; i < rowsA; i++) {
            for (let j = 0; j < colsA; j++) {
                for (let k = 0; k < rowsB; k++) {
                    for (let l = 0; l < colsB; l++) {
                        result[i * rowsB + k][j * colsB + l] = (A[i][j] * B[k][l]) % 2;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Create identity matrix of size n
     */
    function identity(n) {
        const I = [];
        for (let i = 0; i < n; i++) {
            const row = new Array(n).fill(0);
            row[i] = 1;
            I.push(row);
        }
        return I;
    }

    /**
     * Transpose a matrix
     */
    function transpose(M) {
        if (M.length === 0) return [];
        const rows = M.length;
        const cols = M[0].length;
        const result = [];
        for (let j = 0; j < cols; j++) {
            const row = [];
            for (let i = 0; i < rows; i++) {
                row.push(M[i][j]);
            }
            result.push(row);
        }
        return result;
    }

    /**
     * Horizontally concatenate two matrices [A | B]
     */
    function hconcat(A, B) {
        if (A.length !== B.length) {
            throw new Error('Matrices must have same number of rows for horizontal concatenation');
        }
        return A.map((row, i) => [...row, ...B[i]]);
    }

    /**
     * Construct HGP code from two parity check matrices
     * H1: r1 x n1 matrix for code C1
     * H2: r2 x n2 matrix for code C2
     *
     * Returns the HGP code structure
     */
    function constructHGP(H1, H2) {
        const r1 = H1.length;
        const n1 = H1[0].length;
        const r2 = H2.length;
        const n2 = H2[0].length;

        // Code parameters
        const k1 = n1 - r1;
        const k2 = n2 - r2;

        // Physical qubits: n1*n2 data qubits + r1*r2 check qubits
        const N = n1 * n2 + r1 * r2;
        const K = k1 * k2;

        // Build X-check matrix: HX = [H1 ⊗ I_n2 | I_r1 ⊗ H2^T]
        const I_n2 = identity(n2);
        const I_r1 = identity(r1);
        const H2T = transpose(H2);

        const HX_left = kronecker(H1, I_n2);   // r1*n2 x n1*n2
        const HX_right = kronecker(I_r1, H2T); // r1*n2 x r1*r2

        const HX = hconcat(HX_left, HX_right);

        // Build Z-check matrix: HZ = [I_n1 ⊗ H2 | H1^T ⊗ I_r2]
        const I_n1 = identity(n1);
        const I_r2 = identity(r2);
        const H1T = transpose(H1);

        const HZ_left = kronecker(I_n1, H2);   // n1*r2 x n1*n2
        const HZ_right = kronecker(H1T, I_r2); // n1*r2 x r1*r2

        const HZ = hconcat(HZ_left, HZ_right);

        return {
            H1, H2,
            n1, r1, k1,
            n2, r2, k2,
            N, K,
            HX, HZ,
            numDataQubits: n1 * n2,
            numCheckQubits: r1 * r2,
            numXChecks: r1 * n2,
            numZChecks: n1 * r2
        };
    }

    /**
     * Calculate syndrome for X errors
     * X errors are detected by Z checks
     * syndrome = HZ * error (mod 2)
     */
    function calcXSyndrome(hgpCode, xErrors) {
        const syndrome = [];
        for (let i = 0; i < hgpCode.HZ.length; i++) {
            let sum = 0;
            for (let j = 0; j < hgpCode.HZ[i].length; j++) {
                sum += hgpCode.HZ[i][j] * xErrors[j];
            }
            syndrome.push(sum % 2);
        }
        return syndrome;
    }

    /**
     * Calculate syndrome for Z errors
     * Z errors are detected by X checks
     * syndrome = HX * error (mod 2)
     */
    function calcZSyndrome(hgpCode, zErrors) {
        const syndrome = [];
        for (let i = 0; i < hgpCode.HX.length; i++) {
            let sum = 0;
            for (let j = 0; j < hgpCode.HX[i].length; j++) {
                sum += hgpCode.HX[i][j] * zErrors[j];
            }
            syndrome.push(sum % 2);
        }
        return syndrome;
    }

    /**
     * Get the qubits involved in a specific X-check
     * X-check indexed by (i, j) where i ∈ [0, r1) and j ∈ [0, n2)
     */
    function getXCheckQubits(hgpCode, checkIdx) {
        const { n1, r1, n2, r2, HX } = hgpCode;
        const qubits = [];

        for (let q = 0; q < HX[checkIdx].length; q++) {
            if (HX[checkIdx][q] === 1) {
                qubits.push(q);
            }
        }
        return qubits;
    }

    /**
     * Get the qubits involved in a specific Z-check
     * Z-check indexed by (i, j) where i ∈ [0, n1) and j ∈ [0, r2)
     */
    function getZCheckQubits(hgpCode, checkIdx) {
        const { n1, r1, n2, r2, HZ } = hgpCode;
        const qubits = [];

        for (let q = 0; q < HZ[checkIdx].length; q++) {
            if (HZ[checkIdx][q] === 1) {
                qubits.push(q);
            }
        }
        return qubits;
    }

    /**
     * Convert linear qubit index to grid position
     * Data qubits: index 0 to n1*n2-1, position (i,j) where i ∈ [0,n1), j ∈ [0,n2)
     * Check qubits: index n1*n2 to N-1, position (i,j) where i ∈ [0,r1), j ∈ [0,r2)
     */
    function qubitToGrid(hgpCode, qubitIdx) {
        const { n1, n2, r1, r2, numDataQubits } = hgpCode;

        if (qubitIdx < numDataQubits) {
            // Data qubit
            const i = Math.floor(qubitIdx / n2);
            const j = qubitIdx % n2;
            return { type: 'data', i, j };
        } else {
            // Check qubit
            const idx = qubitIdx - numDataQubits;
            const i = Math.floor(idx / r2);
            const j = idx % r2;
            return { type: 'check', i, j };
        }
    }

    /**
     * Convert grid position to linear qubit index
     */
    function gridToQubit(hgpCode, type, i, j) {
        const { n2, r2, numDataQubits } = hgpCode;

        if (type === 'data') {
            return i * n2 + j;
        } else {
            return numDataQubits + i * r2 + j;
        }
    }

    return {
        constructHGP,
        calcXSyndrome,
        calcZSyndrome,
        getXCheckQubits,
        getZCheckQubits,
        qubitToGrid,
        gridToQubit,
        kronecker,
        identity,
        transpose
    };
})();
