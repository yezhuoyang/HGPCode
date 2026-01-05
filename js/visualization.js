/**
 * Visualization Module
 * Renders the HGP code structure matching the standard Hypergraph Product layout
 *
 * Correct Layout (matching hyperUI.png):
 *   C1 (vertical)    |  C2 (horizontal at top)
 *   n bits           |  r checks → n bits
 *     ↓              |       ↓         ↓
 *   r checks         |  [X-stab]    [Qubits n1×n2]
 *                    |  [Qubits r1×r2] [Z-stab]
 *
 * - Top-left: X-stabilizers (pink/magenta)
 * - Top-right: Qubits (n1 × n2) - green
 * - Bottom-left: Qubits (r1 × r2) - green
 * - Bottom-right: Z-stabilizers (orange/yellow)
 * - Total qubits = n1n2 + r1r2
 */

const VizModule = (function() {
    // Color scheme matching hyperUI.png
    const COLORS = {
        qubitBlock: '#90EE90',       // Light green for qubit blocks (like image)
        xStabilizer: '#DDA0DD',      // Pink/plum for X-stabilizers (like image)
        zStabilizer: '#FFD700',      // Gold/yellow for Z-stabilizers (like image)
        error: '#E74C3C',
        syndrome: '#FF4500',
        edge: '#333333',
        highlightEdge: '#E74C3C',
        background: '#fafafa',
        text: '#2c3e50',
        bitNode: '#FFB6C1',          // Pink for bit nodes
        checkNode: '#333333',         // Dark for check nodes
        c1Color: '#2c3e50',
        c2Color: '#2c3e50'
    };

    // Layout constants
    const NODE_SIZE = 28;
    const GRID_SPACING = 36;
    const TANNER_NODE_SIZE = 18;
    const TANNER_SPACING = 30;
    const MARGIN = 100;
    const TANNER_GAP = 80;

    let canvas, ctx;
    let hgpCode = null;
    let xErrors = [];
    let zErrors = [];
    let xSyndrome = [];
    let zSyndrome = [];

    // Layout positions
    let layout = {
        c1: { bits: [], checks: [] },
        c2: { bits: [], checks: [] },
        dataQubits: [],
        checkQubits: [],
        xStabilizers: [],
        zStabilizers: []
    };

    /**
     * Initialize the visualization module
     */
    function init(canvasId) {
        canvas = document.getElementById(canvasId);
        ctx = canvas.getContext('2d');
    }

    /**
     * Calculate layout positions for the HGP visualization
     *
     * Correct layout (matching hyperUI.png):
     *
     * C2 Tanner graph (horizontal at top):
     *   - Check nodes (r2) aligned with X-stab columns AND Qubit2 columns
     *   - Bit nodes (n2) aligned with Qubit1 columns
     *
     * C1 Tanner graph (vertical on left):
     *   - Bit nodes (n1) aligned with Qubit1 rows
     *   - Check nodes (r1) aligned with X-stab rows AND Qubit2 rows
     *
     * HGP blocks:
     *   - X-stab (r1 × n2): top-left, rows align with C1 checks, cols align with C2 bits
     *   - Qubit1 (n1 × n2): top-right, rows align with C1 bits, cols align with C2 bits
     *   - Qubit2 (r1 × r2): bottom-left, rows align with C1 checks, cols align with C2 checks
     *   - Z-stab (n1 × r2): bottom-right, rows align with C1 bits, cols align with C2 checks
     */
    function calculateLayout(code) {
        const { n1, n2, r1, r2 } = code;

        // Grid dimensions for the 4 blocks
        // To form a perfect rectangle:
        // - Left column (X-stab, Qubit2): both have r1 columns (C1 checks)
        // - Right column (Qubit1, Z-stab): both have n1 columns (C1 bits)
        // - Top row (X-stab, Qubit1): X-stab has n2 rows (C2 bits), Qubit1 has n1 rows
        // - Bottom row (Qubit2, Z-stab): Qubit2 has r1 rows, Z-stab has r2 rows (C2 checks)
        //
        // X-stab: r1*n2 checks arranged as n2 rows × r1 cols (transposed from r1×n2)
        // Z-stab: n1*r2 checks arranged as r2 rows × n1 cols (transposed from n1×r2)

        const xStabWidth = r1 * GRID_SPACING;   // X-stab: n2 rows × r1 cols (transposed)
        const xStabHeight = n2 * GRID_SPACING;

        const qubit1Width = n2 * GRID_SPACING;  // Qubit block 1: n1 rows × n2 cols
        const qubit1Height = n1 * GRID_SPACING;

        const qubit2Width = r2 * GRID_SPACING;  // Qubit block 2: r1 rows × r2 cols
        const qubit2Height = r1 * GRID_SPACING;

        const zStabWidth = n1 * GRID_SPACING;   // Z-stab: r2 rows × n1 cols (transposed)
        const zStabHeight = r2 * GRID_SPACING;

        // Gap between blocks
        const blockGap = 30;

        // C1 Tanner graph width (single column of nodes)
        const c1TannerWidth = 40;

        // C2 Tanner graph height (single row of nodes)
        const c2TannerHeight = 40;

        // Calculate total HGP area
        // Left column: X-stab and Qubit2 (both have same column alignment)
        // Right column: Qubit1 and Z-stab (both have same column alignment)
        const leftColWidth = Math.max(xStabWidth, qubit2Width);
        const rightColWidth = Math.max(qubit1Width, zStabWidth);

        // Top row: X-stab and Qubit1
        // Bottom row: Qubit2 and Z-stab
        const topRowHeight = Math.max(xStabHeight, qubit1Height);
        const bottomRowHeight = Math.max(qubit2Height, zStabHeight);

        const hgpWidth = leftColWidth + blockGap + rightColWidth;
        const hgpHeight = topRowHeight + blockGap + bottomRowHeight;

        const totalWidth = MARGIN + c1TannerWidth + TANNER_GAP + hgpWidth + MARGIN;
        const totalHeight = MARGIN + c2TannerHeight + TANNER_GAP + hgpHeight + MARGIN + 50;

        canvas.width = Math.max(totalWidth, 1000);
        canvas.height = Math.max(totalHeight, 800);

        // Starting positions for HGP blocks area
        const hgpStartX = MARGIN + c1TannerWidth + TANNER_GAP;
        const hgpStartY = MARGIN + c2TannerHeight + TANNER_GAP;

        // === Define the 4 block positions ===
        // The 4 blocks form a perfect rectangle:
        // - Left column: X-stab (top) and Qubit2 (bottom)
        // - Right column: Qubit1 (top) and Z-stab (bottom)
        //
        // Alignment with C1 (vertical, left):
        //   - C1 bits (n1) align with Qubit1 rows AND Z-stab columns
        //   - C1 checks (r1) align with X-stab columns AND Qubit2 rows
        //
        // Alignment with C2 (horizontal, top):
        //   - C2 bits (n2) align with X-stab rows AND Qubit1 columns
        //   - C2 checks (r2) align with Qubit2 columns AND Z-stab rows

        // X-stabilizers: top-left (n2 rows × r1 cols) - TRANSPOSED
        // - Rows align with C2 bit nodes (n2 rows)
        // - Cols align with C1 check nodes (r1 cols)
        layout.xStabBounds = {
            x: hgpStartX,
            y: hgpStartY,
            width: xStabWidth,
            height: xStabHeight,
            rows: n2,    // C2 bits
            cols: r1     // C1 checks
        };

        // Qubits block 1 (n1 rows × n2 cols): top-right
        // - Rows align with C1 bit nodes (n1)
        // - Cols align with C2 bit nodes (n2)
        layout.qubit1Bounds = {
            x: hgpStartX + leftColWidth + blockGap,
            y: hgpStartY,
            width: qubit1Width,
            height: qubit1Height,
            rows: n1,
            cols: n2
        };

        // Qubits block 2 (r1 rows × r2 cols): bottom-left
        // - Rows align with C1 check nodes (r1)
        // - Cols align with C2 check nodes (r2)
        layout.qubit2Bounds = {
            x: hgpStartX,
            y: hgpStartY + topRowHeight + blockGap,
            width: qubit2Width,
            height: qubit2Height,
            rows: r1,
            cols: r2
        };

        // Z-stabilizers: bottom-right (r2 rows × n1 cols) - TRANSPOSED
        // - Rows align with C2 check nodes (r2 rows)
        // - Cols align with C1 bit nodes (n1 cols)
        layout.zStabBounds = {
            x: hgpStartX + leftColWidth + blockGap,
            y: hgpStartY + topRowHeight + blockGap,
            width: zStabWidth,
            height: zStabHeight,
            rows: r2,    // C2 checks
            cols: n1     // C1 bits
        };

        // === C1 Tanner Graph (vertical, on left) ===
        // Two separate groups: bit nodes (n1) and check nodes (r1)
        // - Bit nodes (circles, n1) align with Qubit1 rows AND Z-stab columns
        // - Check nodes (squares, r1) align with X-stab columns AND Qubit2 rows
        const c1X = MARGIN + c1TannerWidth / 2;

        // C1 bit nodes - align with Qubit1 rows (n1 nodes)
        layout.c1.bits = [];
        for (let i = 0; i < n1; i++) {
            layout.c1.bits.push({
                x: c1X,
                y: layout.qubit1Bounds.y + i * GRID_SPACING + GRID_SPACING / 2,
                index: i
            });
        }

        // C1 check nodes - align with Qubit2 rows (r1 nodes)
        layout.c1.checks = [];
        for (let i = 0; i < r1; i++) {
            layout.c1.checks.push({
                x: c1X,
                y: layout.qubit2Bounds.y + i * GRID_SPACING + GRID_SPACING / 2,
                index: i
            });
        }

        // === C2 Tanner Graph (horizontal, on top) ===
        // Two separate groups: check nodes (r2) and bit nodes (n2)
        // - Check nodes (squares, r2) align with Qubit2 columns AND Z-stab rows
        // - Bit nodes (circles, n2) align with X-stab rows AND Qubit1 columns
        const c2Y = MARGIN + c2TannerHeight / 2;

        // C2 check nodes - align with Qubit2 columns (r2 nodes, left side)
        layout.c2.checks = [];
        for (let j = 0; j < r2; j++) {
            layout.c2.checks.push({
                x: layout.qubit2Bounds.x + j * GRID_SPACING + GRID_SPACING / 2,
                y: c2Y,
                index: j
            });
        }

        // C2 bit nodes - align with Qubit1 columns (n2 nodes, right side)
        layout.c2.bits = [];
        for (let j = 0; j < n2; j++) {
            layout.c2.bits.push({
                x: layout.qubit1Bounds.x + j * GRID_SPACING + GRID_SPACING / 2,
                y: c2Y,
                index: j
            });
        }

        // === Qubit positions ===
        // Qubit block 1 (n1 × n2) - top right - indices 0 to n1*n2-1
        layout.dataQubits = [];
        for (let i = 0; i < n1; i++) {
            for (let j = 0; j < n2; j++) {
                const idx = i * n2 + j;
                layout.dataQubits.push({
                    x: layout.qubit1Bounds.x + j * GRID_SPACING + GRID_SPACING / 2,
                    y: layout.qubit1Bounds.y + i * GRID_SPACING + GRID_SPACING / 2,
                    row: i,
                    col: j,
                    qubitIdx: idx,
                    block: 1
                });
            }
        }

        // Qubit block 2 (r1 × r2) - bottom left - indices n1*n2 to N-1
        layout.checkQubits = [];
        for (let i = 0; i < r1; i++) {
            for (let j = 0; j < r2; j++) {
                const idx = i * r2 + j;
                const qubitIdx = code.numDataQubits + idx;
                layout.checkQubits.push({
                    x: layout.qubit2Bounds.x + j * GRID_SPACING + GRID_SPACING / 2,
                    y: layout.qubit2Bounds.y + i * GRID_SPACING + GRID_SPACING / 2,
                    row: i,
                    col: j,
                    qubitIdx: qubitIdx,
                    block: 2
                });
            }
        }

        // X-stabilizer positions - TRANSPOSED to (n2 rows × r2 cols)
        // Original: r1*n2 checks indexed as (i,j) where i∈[0,r1), j∈[0,n2)
        // Transposed: displayed as (j,i) where j∈[0,n2) is row, i∈[0,r1) maps to column
        // But we only have r2 columns, so we need to map r1 checks to r2 columns
        // Actually, looking at the structure more carefully:
        // X-stab block has n2 rows (aligned with C2 bits) and r2 cols (aligned with C2 checks)
        // The original r1*n2 X-checks need to be mapped: checkIdx = i*n2 + j
        // In transposed view: row = j (0 to n2-1), col = i (0 to r1-1)
        // But we only have r2 cols! So this needs more thought...
        //
        // Actually, in the HGP structure, X-stab should connect to both qubit blocks
        // Let me reconsider: X-stab columns should align with C2 checks (r2)
        // and X-stab rows should align with C2 bits (n2)
        // So X-stab is n2 × r2, but we have r1*n2 X-checks...
        // This means each cell might represent multiple checks, OR
        // the X-stab block represents something else.
        //
        // Looking at hyperUI.png again: the X-stab block IS r1 rows × n2 cols
        // but it's positioned with columns aligned to C2 checks.
        // Wait - in hyperUI.png, the X-stab has the SAME number of columns as C2 checks (r)
        // So X-stab should be arranged as n2 rows × r2 cols where each cell (row j, col i)
        // represents the check that connects C1 check i with C2 bit j
        // Original checkIdx = i*n2 + j, transposed position: row=j, col=i
        layout.xStabilizers = [];
        for (let i = 0; i < r1; i++) {           // C1 check index (becomes column after transpose)
            for (let j = 0; j < n2; j++) {       // C2 bit index (becomes row after transpose)
                const checkIdx = i * n2 + j;     // Original linear index
                layout.xStabilizers.push({
                    x: layout.xStabBounds.x + i * GRID_SPACING + GRID_SPACING / 2,  // col = i (C1 check)
                    y: layout.xStabBounds.y + j * GRID_SPACING + GRID_SPACING / 2,  // row = j (C2 bit)
                    row: j,      // C2 bit index
                    col: i,      // C1 check index
                    checkIdx: checkIdx
                });
            }
        }

        // Z-stabilizer positions - TRANSPOSED to (r2 rows × n2 cols)
        // Original: n1*r2 checks indexed as (i,j) where i∈[0,n1), j∈[0,r2)
        // Transposed: displayed as (j,i) where j∈[0,r2) is row, i∈[0,n1) is column
        // Z-stab columns should align with C2 bits (n2)
        // Z-stab rows should align with C2 checks (r2)
        // Original checkIdx = i*r2 + j, transposed position: row=j, col=i
        layout.zStabilizers = [];
        for (let i = 0; i < n1; i++) {           // C1 bit index (becomes column after transpose)
            for (let j = 0; j < r2; j++) {       // C2 check index (becomes row after transpose)
                const checkIdx = i * r2 + j;     // Original linear index
                layout.zStabilizers.push({
                    x: layout.zStabBounds.x + i * GRID_SPACING + GRID_SPACING / 2,  // col = i (C1 bit)
                    y: layout.zStabBounds.y + j * GRID_SPACING + GRID_SPACING / 2,  // row = j (C2 check)
                    row: j,      // C2 check index
                    col: i,      // C1 bit index
                    checkIdx: checkIdx
                });
            }
        }

        // Store for backward compatibility
        layout.dataGridBounds = layout.qubit1Bounds;
        layout.checkGridBounds = layout.qubit2Bounds;
    }

    /**
     * Get incident edges for current errors
     */
    function getIncidentEdges() {
        const incidentEdges = [];
        if (!hgpCode) return incidentEdges;

        // For X errors, find incident Z-checks
        for (let q = 0; q < hgpCode.N; q++) {
            if (xErrors[q] === 1) {
                for (let c = 0; c < hgpCode.numZChecks; c++) {
                    if (hgpCode.HZ[c][q] === 1) {
                        incidentEdges.push({ qubitIdx: q, checkIdx: c, checkType: 'z' });
                    }
                }
            }
        }

        // For Z errors, find incident X-checks
        for (let q = 0; q < hgpCode.N; q++) {
            if (zErrors[q] === 1) {
                for (let c = 0; c < hgpCode.numXChecks; c++) {
                    if (hgpCode.HX[c][q] === 1) {
                        incidentEdges.push({ qubitIdx: q, checkIdx: c, checkType: 'x' });
                    }
                }
            }
        }

        return incidentEdges;
    }

    /**
     * Draw the complete visualization
     */
    function draw() {
        if (!hgpCode) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background regions for the 4 blocks
        drawRegions();

        // Draw C1 and C2 Tanner graphs with curved edges
        drawC1TannerGraph();
        drawC2TannerGraph();

        // Draw curved connections between Tanner graphs (highlighted when errors present)
        drawTannerCurvedConnections();

        // Draw the 4 blocks: X-stab, Qubits1, Qubits2, Z-stab
        drawXStabilizers();
        drawQubitBlock1();
        drawQubitBlock2();
        drawZStabilizers();

        // Draw labels
        drawLabels();
    }

    /**
     * Draw background regions for the 4 blocks (matching hyperUI.png style)
     */
    function drawRegions() {
        const padding = 5;

        // X-stabilizer region - top left (pink/plum like in image)
        ctx.fillStyle = 'rgba(221, 160, 221, 0.3)';
        ctx.fillRect(
            layout.xStabBounds.x - padding,
            layout.xStabBounds.y - padding,
            layout.xStabBounds.width + padding * 2,
            layout.xStabBounds.height + padding * 2
        );
        ctx.strokeStyle = '#DDA0DD';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            layout.xStabBounds.x - padding,
            layout.xStabBounds.y - padding,
            layout.xStabBounds.width + padding * 2,
            layout.xStabBounds.height + padding * 2
        );

        // Qubit block 1 - top right (green like in image)
        ctx.fillStyle = 'rgba(144, 238, 144, 0.3)';
        ctx.fillRect(
            layout.qubit1Bounds.x - padding,
            layout.qubit1Bounds.y - padding,
            layout.qubit1Bounds.width + padding * 2,
            layout.qubit1Bounds.height + padding * 2
        );
        ctx.strokeStyle = '#90EE90';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            layout.qubit1Bounds.x - padding,
            layout.qubit1Bounds.y - padding,
            layout.qubit1Bounds.width + padding * 2,
            layout.qubit1Bounds.height + padding * 2
        );

        // Qubit block 2 - bottom left (green like in image)
        ctx.fillStyle = 'rgba(144, 238, 144, 0.3)';
        ctx.fillRect(
            layout.qubit2Bounds.x - padding,
            layout.qubit2Bounds.y - padding,
            layout.qubit2Bounds.width + padding * 2,
            layout.qubit2Bounds.height + padding * 2
        );
        ctx.strokeStyle = '#90EE90';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            layout.qubit2Bounds.x - padding,
            layout.qubit2Bounds.y - padding,
            layout.qubit2Bounds.width + padding * 2,
            layout.qubit2Bounds.height + padding * 2
        );

        // Z-stabilizer region - bottom right (gold/yellow like in image)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.fillRect(
            layout.zStabBounds.x - padding,
            layout.zStabBounds.y - padding,
            layout.zStabBounds.width + padding * 2,
            layout.zStabBounds.height + padding * 2
        );
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            layout.zStabBounds.x - padding,
            layout.zStabBounds.y - padding,
            layout.zStabBounds.width + padding * 2,
            layout.zStabBounds.height + padding * 2
        );
    }

    /**
     * Draw a curved line between two points (like in hyperUI.png)
     */
    function drawCurvedEdge(x1, y1, x2, y2, curvature = 0.3, highlighted = false) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;

        // Control point perpendicular to the line
        const cpX = midX - dy * curvature;
        const cpY = midY + dx * curvature;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);

        if (highlighted) {
            ctx.strokeStyle = COLORS.highlightEdge;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
        } else {
            ctx.strokeStyle = COLORS.edge;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.6;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    /**
     * Draw C1 Tanner graph (vertical, on left) with curved edges
     */
    function drawC1TannerGraph() {
        const { H1 } = hgpCode;

        // Draw curved edges between bit nodes and check nodes
        for (let i = 0; i < hgpCode.r1; i++) {
            for (let j = 0; j < hgpCode.n1; j++) {
                if (H1[i][j] === 1) {
                    // Check if this edge should be highlighted (error on related qubit)
                    const highlighted = isC1EdgeHighlighted(j, i);
                    drawCurvedEdge(
                        layout.c1.bits[j].x, layout.c1.bits[j].y,
                        layout.c1.checks[i].x, layout.c1.checks[i].y,
                        0.4, highlighted
                    );
                }
            }
        }

        // Draw bit nodes (circles - pink)
        for (const bit of layout.c1.bits) {
            ctx.fillStyle = COLORS.bitNode;
            ctx.beginPath();
            ctx.arc(bit.x, bit.y, TANNER_NODE_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#333';
            ctx.font = 'bold 9px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(bit.index.toString(), bit.x, bit.y);
        }

        // Draw check nodes (squares - black)
        for (const check of layout.c1.checks) {
            ctx.fillStyle = COLORS.checkNode;
            ctx.fillRect(
                check.x - TANNER_NODE_SIZE / 2,
                check.y - TANNER_NODE_SIZE / 2,
                TANNER_NODE_SIZE,
                TANNER_NODE_SIZE
            );

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(check.index.toString(), check.x, check.y);
        }
    }

    /**
     * Check if a C1 edge (bit bitIdx to check checkIdx) should be highlighted based on errors
     *
     * A C1 edge connects:
     *   - Bit node bitIdx (aligned with Qubit1 row bitIdx)
     *   - Check node checkIdx (aligned with Qubit2 row checkIdx)
     *
     * This edge should be highlighted if there's an error on ANY qubit that
     * is in BOTH the bit's row (in Qubit1) AND the check's row (in Qubit2)
     * Since these are different blocks, we highlight if error is in EITHER:
     *   - Any qubit in Qubit1 row bitIdx, OR
     *   - Any qubit in Qubit2 row checkIdx
     */
    function isC1EdgeHighlighted(bitIdx, checkIdx) {
        // Check Qubit1 (n1 × n2): row bitIdx
        for (let col = 0; col < hgpCode.n2; col++) {
            const qubitIdx = bitIdx * hgpCode.n2 + col;
            if (xErrors[qubitIdx] === 1 || zErrors[qubitIdx] === 1) {
                return true;
            }
        }

        // Check Qubit2 (r1 × r2): row checkIdx
        for (let col = 0; col < hgpCode.r2; col++) {
            const qubitIdx = hgpCode.numDataQubits + checkIdx * hgpCode.r2 + col;
            if (xErrors[qubitIdx] === 1 || zErrors[qubitIdx] === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Draw C2 Tanner graph (horizontal, on top) with curved edges
     */
    function drawC2TannerGraph() {
        const { H2 } = hgpCode;

        // Draw curved edges between bit nodes and check nodes
        for (let i = 0; i < hgpCode.r2; i++) {
            for (let j = 0; j < hgpCode.n2; j++) {
                if (H2[i][j] === 1) {
                    // Check if this edge should be highlighted
                    const highlighted = isC2EdgeHighlighted(j, i);
                    drawCurvedEdge(
                        layout.c2.bits[j].x, layout.c2.bits[j].y,
                        layout.c2.checks[i].x, layout.c2.checks[i].y,
                        0.4, highlighted
                    );
                }
            }
        }

        // Draw bit nodes (circles - pink)
        for (const bit of layout.c2.bits) {
            ctx.fillStyle = COLORS.bitNode;
            ctx.beginPath();
            ctx.arc(bit.x, bit.y, TANNER_NODE_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#333';
            ctx.font = 'bold 9px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(bit.index.toString(), bit.x, bit.y);
        }

        // Draw check nodes (squares - black)
        for (const check of layout.c2.checks) {
            ctx.fillStyle = COLORS.checkNode;
            ctx.fillRect(
                check.x - TANNER_NODE_SIZE / 2,
                check.y - TANNER_NODE_SIZE / 2,
                TANNER_NODE_SIZE,
                TANNER_NODE_SIZE
            );

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(check.index.toString(), check.x, check.y);
        }
    }

    /**
     * Check if a C2 edge (bit bitIdx to check checkIdx) should be highlighted based on errors
     *
     * A C2 edge connects:
     *   - Bit node bitIdx (aligned with Qubit1 column bitIdx)
     *   - Check node checkIdx (aligned with Qubit2 column checkIdx)
     *
     * This edge should be highlighted if there's an error on ANY qubit that
     * is in EITHER:
     *   - Any qubit in Qubit1 column bitIdx, OR
     *   - Any qubit in Qubit2 column checkIdx
     */
    function isC2EdgeHighlighted(bitIdx, checkIdx) {
        // Check Qubit1 (n1 × n2): column bitIdx
        for (let row = 0; row < hgpCode.n1; row++) {
            const qubitIdx = row * hgpCode.n2 + bitIdx;
            if (xErrors[qubitIdx] === 1 || zErrors[qubitIdx] === 1) {
                return true;
            }
        }

        // Check Qubit2 (r1 × r2): column checkIdx
        for (let row = 0; row < hgpCode.r1; row++) {
            const qubitIdx = hgpCode.numDataQubits + row * hgpCode.r2 + checkIdx;
            if (xErrors[qubitIdx] === 1 || zErrors[qubitIdx] === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Draw curved connections between Tanner graphs
     * These are the main visualization of information propagation
     * No edges inside the HGP blocks - only between the two Tanner graphs
     */
    function drawTannerCurvedConnections() {
        // The curved edges are already drawn within the Tanner graphs themselves
        // with highlighting based on errors
        // This function can be used for additional visual connections if needed
    }

    /**
     * Draw X-stabilizers block (top-left, r1 × n2)
     */
    function drawXStabilizers() {
        for (const stab of layout.xStabilizers) {
            const isTriggered = xSyndrome[stab.checkIdx] === 1;

            ctx.fillStyle = isTriggered ? COLORS.syndrome : COLORS.xStabilizer;
            ctx.globalAlpha = isTriggered ? 1 : 0.7;
            ctx.fillRect(
                stab.x - NODE_SIZE / 2,
                stab.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );
            ctx.globalAlpha = 1;

            ctx.strokeStyle = '#BA55D3';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                stab.x - NODE_SIZE / 2,
                stab.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );

            // Label
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('X', stab.x, stab.y);
        }
    }

    /**
     * Draw Qubit block 1 (top-right, n1 × n2)
     */
    function drawQubitBlock1() {
        for (const qubit of layout.dataQubits) {
            const hasXError = xErrors[qubit.qubitIdx] === 1;
            const hasZError = zErrors[qubit.qubitIdx] === 1;
            const hasError = hasXError || hasZError;

            ctx.fillStyle = hasError ? COLORS.error : COLORS.qubitBlock;
            ctx.fillRect(
                qubit.x - NODE_SIZE / 2,
                qubit.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );

            ctx.strokeStyle = hasError ? '#C0392B' : '#228B22';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                qubit.x - NODE_SIZE / 2,
                qubit.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );

            // Draw error label or qubit label
            ctx.fillStyle = hasError ? '#fff' : '#333';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (hasXError && hasZError) {
                ctx.fillText('Y', qubit.x, qubit.y);
            } else if (hasXError) {
                ctx.fillText('X', qubit.x, qubit.y);
            } else if (hasZError) {
                ctx.fillText('Z', qubit.x, qubit.y);
            }
        }
    }

    /**
     * Draw Qubit block 2 (bottom-left, r1 × r2)
     */
    function drawQubitBlock2() {
        for (const qubit of layout.checkQubits) {
            const hasXError = xErrors[qubit.qubitIdx] === 1;
            const hasZError = zErrors[qubit.qubitIdx] === 1;
            const hasError = hasXError || hasZError;

            ctx.fillStyle = hasError ? COLORS.error : COLORS.qubitBlock;
            ctx.fillRect(
                qubit.x - NODE_SIZE / 2,
                qubit.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );

            ctx.strokeStyle = hasError ? '#C0392B' : '#228B22';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                qubit.x - NODE_SIZE / 2,
                qubit.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );

            // Draw error label
            ctx.fillStyle = hasError ? '#fff' : '#333';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (hasXError && hasZError) {
                ctx.fillText('Y', qubit.x, qubit.y);
            } else if (hasXError) {
                ctx.fillText('X', qubit.x, qubit.y);
            } else if (hasZError) {
                ctx.fillText('Z', qubit.x, qubit.y);
            }
        }
    }

    /**
     * Draw Z-stabilizers block (bottom-right, n1 × r2)
     */
    function drawZStabilizers() {
        for (const stab of layout.zStabilizers) {
            const isTriggered = zSyndrome[stab.checkIdx] === 1;

            ctx.fillStyle = isTriggered ? COLORS.syndrome : COLORS.zStabilizer;
            ctx.globalAlpha = isTriggered ? 1 : 0.7;
            ctx.fillRect(
                stab.x - NODE_SIZE / 2,
                stab.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );
            ctx.globalAlpha = 1;

            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                stab.x - NODE_SIZE / 2,
                stab.y - NODE_SIZE / 2,
                NODE_SIZE,
                NODE_SIZE
            );

            // Label
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Z', stab.x, stab.y);
        }
    }

    /**
     * Draw labels for all blocks and Tanner graphs
     */
    function drawLabels() {
        const { n1, n2, r1, r2 } = hgpCode;

        ctx.font = 'bold 14px Segoe UI, sans-serif';
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';

        // C1 label (vertical, on left)
        ctx.save();
        ctx.translate(MARGIN - 20, (layout.qubit1Bounds.y + layout.qubit2Bounds.y + layout.qubit2Bounds.height) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`C₁ (n=${n1}, r=${r1})`, 0, 0);
        ctx.restore();

        // C2 label (horizontal, on top)
        const c2CenterX = (layout.qubit2Bounds.x + layout.qubit1Bounds.x + layout.qubit1Bounds.width) / 2;
        ctx.fillText(`C₂ (n=${n2}, r=${r2})`, c2CenterX, MARGIN - 20);

        // Block labels
        ctx.font = '11px Segoe UI, sans-serif';

        // X-stabilizers label (top-left) - transposed: n2 rows × r1 cols
        ctx.fillStyle = '#8B008B';
        ctx.fillText(
            `X-stab (${n2}×${r1})`,
            layout.xStabBounds.x + layout.xStabBounds.width / 2,
            layout.xStabBounds.y + layout.xStabBounds.height + 15
        );

        // Qubit block 1 label (top-right)
        ctx.fillStyle = '#228B22';
        ctx.fillText(
            `Qubits (${n1}×${n2})`,
            layout.qubit1Bounds.x + layout.qubit1Bounds.width / 2,
            layout.qubit1Bounds.y + layout.qubit1Bounds.height + 15
        );

        // Qubit block 2 label (bottom-left)
        ctx.fillStyle = '#228B22';
        ctx.fillText(
            `Qubits (${r1}×${r2})`,
            layout.qubit2Bounds.x + layout.qubit2Bounds.width / 2,
            layout.qubit2Bounds.y + layout.qubit2Bounds.height + 15
        );

        // Z-stabilizers label (bottom-right) - transposed: r2 rows × n1 cols
        ctx.fillStyle = '#B8860B';
        ctx.fillText(
            `Z-stab (${r2}×${n1})`,
            layout.zStabBounds.x + layout.zStabBounds.width / 2,
            layout.zStabBounds.y + layout.zStabBounds.height + 15
        );

        // Total qubits info
        ctx.font = 'bold 12px Segoe UI, sans-serif';
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.fillText(
            `Total Qubits: N = ${n1}×${n2} + ${r1}×${r2} = ${hgpCode.N}`,
            MARGIN,
            canvas.height - 20
        );
    }

    /**
     * Set the HGP code and initialize visualization
     */
    function setCode(code) {
        hgpCode = code;
        xErrors = new Array(code.N).fill(0);
        zErrors = new Array(code.N).fill(0);
        xSyndrome = new Array(code.numXChecks).fill(0);
        zSyndrome = new Array(code.numZChecks).fill(0);
        calculateLayout(code);
        draw();
    }

    /**
     * Toggle error on a qubit
     */
    function toggleError(qubitIdx, errorType) {
        if (!hgpCode || qubitIdx < 0 || qubitIdx >= hgpCode.N) return;

        if (errorType === 'X') {
            xErrors[qubitIdx] = xErrors[qubitIdx] === 1 ? 0 : 1;
            zSyndrome = HGPModule.calcXSyndrome(hgpCode, xErrors);
        } else if (errorType === 'Z') {
            zErrors[qubitIdx] = zErrors[qubitIdx] === 1 ? 0 : 1;
            xSyndrome = HGPModule.calcZSyndrome(hgpCode, zErrors);
        }

        draw();
    }

    /**
     * Clear all errors
     */
    function clearErrors() {
        if (!hgpCode) return;
        xErrors = new Array(hgpCode.N).fill(0);
        zErrors = new Array(hgpCode.N).fill(0);
        xSyndrome = new Array(hgpCode.numXChecks).fill(0);
        zSyndrome = new Array(hgpCode.numZChecks).fill(0);
        draw();
    }

    /**
     * Handle canvas click
     */
    function handleClick(event) {
        if (!hgpCode) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Check data qubits
        for (const qubit of layout.dataQubits) {
            if (Math.abs(x - qubit.x) <= NODE_SIZE / 2 && Math.abs(y - qubit.y) <= NODE_SIZE / 2) {
                return { type: 'qubit', qubitIdx: qubit.qubitIdx };
            }
        }

        // Check check qubits
        for (const qubit of layout.checkQubits) {
            if (Math.abs(x - qubit.x) <= NODE_SIZE / 2 && Math.abs(y - qubit.y) <= NODE_SIZE / 2) {
                return { type: 'qubit', qubitIdx: qubit.qubitIdx };
            }
        }

        return null;
    }

    /**
     * Get current error state
     */
    function getErrorState() {
        return {
            xErrors: [...xErrors],
            zErrors: [...zErrors],
            xSyndrome: [...xSyndrome],
            zSyndrome: [...zSyndrome]
        };
    }

    return {
        init,
        setCode,
        draw,
        toggleError,
        clearErrors,
        handleClick,
        getErrorState,
        COLORS
    };
})();


/**
 * Tanner Graph Visualization Module
 * Renders classical code Tanner graphs with curved edges (like hyperUI.png)
 */
const TannerVizModule = (function() {
    const NODE_RADIUS = 12;
    const PADDING = 30;

    const COLORS = {
        bitNode: '#FFB6C1',
        checkNode: '#333333',
        edge: '#333333',
        text: '#2c3e50'
    };

    /**
     * Draw a curved edge between two points
     */
    function drawCurvedEdge(ctx, x1, y1, x2, y2, curvature = 0.2) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;

        // Control point perpendicular to the line
        const cpX = midX - dy * curvature;
        const cpY = midY + dx * curvature;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpX, cpY, x2, y2);
        ctx.stroke();
    }

    /**
     * Draw a Tanner graph for a classical code with curved edges
     */
    function drawTannerGraph(canvasId, H) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !H || H.length === 0) return;

        const ctx = canvas.getContext('2d');
        const r = H.length;
        const n = H[0].length;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bipartite layout
        const bitY = PADDING + NODE_RADIUS + 10;
        const checkY = canvas.height - PADDING - NODE_RADIUS - 10;

        const bitSpacing = (canvas.width - 2 * PADDING) / (n + 1);
        const checkSpacing = (canvas.width - 2 * PADDING) / (r + 1);

        const bitPositions = [];
        for (let j = 0; j < n; j++) {
            bitPositions.push({
                x: PADDING + (j + 1) * bitSpacing,
                y: bitY
            });
        }

        const checkPositions = [];
        for (let i = 0; i < r; i++) {
            checkPositions.push({
                x: PADDING + (i + 1) * checkSpacing,
                y: checkY
            });
        }

        // Draw curved edges (like in hyperUI.png)
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.7;

        for (let i = 0; i < r; i++) {
            for (let j = 0; j < n; j++) {
                if (H[i][j] === 1) {
                    // Vary curvature slightly based on position for visual variety
                    const curvature = 0.15 + (j - i) * 0.02;
                    drawCurvedEdge(ctx, bitPositions[j].x, bitPositions[j].y,
                                   checkPositions[i].x, checkPositions[i].y, curvature);
                }
            }
        }
        ctx.globalAlpha = 1;

        // Draw bit nodes (circles - pink)
        for (let j = 0; j < n; j++) {
            ctx.fillStyle = COLORS.bitNode;
            ctx.beginPath();
            ctx.arc(bitPositions[j].x, bitPositions[j].y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(j.toString(), bitPositions[j].x, bitPositions[j].y);
        }

        // Draw check nodes (squares - black)
        const size = NODE_RADIUS * 2;
        for (let i = 0; i < r; i++) {
            ctx.fillStyle = COLORS.checkNode;
            ctx.fillRect(
                checkPositions[i].x - NODE_RADIUS,
                checkPositions[i].y - NODE_RADIUS,
                size,
                size
            );

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toString(), checkPositions[i].x, checkPositions[i].y);
        }

        // Labels
        ctx.fillStyle = COLORS.text;
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`n = ${n} bits`, 5, 12);
        ctx.fillText(`r = ${r} checks`, 5, canvas.height - 3);
    }

    return {
        drawTannerGraph
    };
})();
