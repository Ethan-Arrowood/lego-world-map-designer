// @ts-check

/** @type {import('xstate')} XState */
var XState;
/** @type {import('bootstrap')} */
var bootstrap;

/**
 * @typedef {[red: number, green: number, blue: number]} Color
 * @type {Color[]}
 */
const COLORS = [
  [0, 0, 0],
  [255, 255, 255],
  [18, 52, 93],
  [87, 184, 202],
  [74, 165, 158],
  [79, 169, 87],
  [164, 199, 82],
  [216, 191, 142],
  [237, 173, 65],
  [227, 129, 58],
  [224, 117, 116],
];

/**
 *
 * @param {Color} color
 * @returns color tuple transformed to rgb string
 */
const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

/** Board Dimensions */
const DIMS = {
  /** Height of board in studs */
  H: 80,
  /** Width of board in studs */
  W: 128,
  /** Stud pixel size */
  S: 16,
};

const WIDTH = DIMS.W * DIMS.S;
const HEIGHT = DIMS.H * DIMS.S;

/**
 * Exact position within canvas of a stud
 * @typedef {[x: number, y: number]} Pos
 *
 * Exact position translated `(DIMS.S / 2)`
 * @typedef {Pos} CenterPos
 * */

const studPositions = {
  /**
   * @returns {Generator<Pos, void, unknown>}
   */
  *[Symbol.iterator]() {
    for (let y = 0; y < DIMS.H; y++) {
      for (let x = 0; x < DIMS.W; x++) {
        yield [x * DIMS.S, y * DIMS.S];
      }
    }
  },
};

/**
 * Get the value of the stud based on the COLORS constant
 * @param {Pos} pos
 * @param {CanvasRenderingContext2D} ctx
 * @returns
 */
function studValue([x, y], ctx) {
  const {
    data: [r, g, b],
  } = ctx.getImageData(x + DIMS.S / 2, y + DIMS.S / 2, 1, 1);

  return COLORS.findIndex(([_r, _g, _b]) => _r === r && _g === g && _b === b);
}

/**
 *
 * @param {CanvasRenderingContext2D} ctx
 */
function saveBoard(ctx) {
  const board = {
    dimensions: {
      height: DIMS.H,
      width: DIMS.W,
      size: DIMS.S,
    },
    data: [],
  };
  for (const pos of studPositions) {
    board.data.push(studValue(pos, ctx));
  }
  const blob = new Blob([JSON.stringify(board)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = "board";
  a.rel = "noopener";
  a.href = url;
  a.dispatchEvent(new MouseEvent("click"));
  URL.revokeObjectURL(url);
}

/**
 * The position is calculated based on the user viewport and the calculated
 * scale of the board. The MouseEvent `event` gives the exact pixel position
 * of the user's cursor. This value is divided by the scaled size of a stud.
 * The scaled sized is calculated by multiplying the stud size by the ratio
 * of the client width and the canvas width.
 * @param {HTMLCanvasElement} canvas
 * @param {MouseEvent} event
 * @returns {Pos} stud position mouse is over
 */
function mousePosition(canvas, event) {
  const client = canvas.getBoundingClientRect();
  return [
    Math.floor(event.offsetX / (DIMS.S * (client.width / canvas.width))),
    Math.floor(event.offsetY / (DIMS.S * (client.height / canvas.height))),
  ];
}

/**
 *
 * @param {Pos} pos
 * @param {Color} color
 * @param {CanvasRenderingContext2D} ctx
 */
function fillStud([x, y], color, ctx) {
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.arc(
    x * DIMS.S + DIMS.S / 2,
    y * DIMS.S + DIMS.S / 2,
    (DIMS.S - 2) / 2,
    0,
    2 * Math.PI
  );
  ctx.fill();
}

function startEndPos([x1, y1], [x2, y2]) {
  return [x1 < x2 ? [x1, x2] : [x2, x1], y1 < y2 ? [y1, y2] : [y2, y1]];
}

function highlightArea(pos1, pos2, color, ctx) {
  const [[sx, ex], [sy, ey]] = startEndPos(pos1, pos2);
  ctx.strokeStyle = rgb(color);
  ctx.strokeRect(
    sx * DIMS.S,
    sy * DIMS.S,
    (ex - sx) * DIMS.S,
    (ey - sy) * DIMS.S
  );
}

function fillArea(pos1, pos2, color, ctx) {
  const [[sx, ex], [sy, ey]] = startEndPos(pos1, pos2);
  for (let x = sx; x < ex; x++) {
    for (let y = sy; y < ey; y++) {
      fillStud([x, y], color, ctx);
    }
  }
}

function drawStudGrid(ctx) {
  ctx.strokeStyle = rgb(COLORS[1]);
  for (const stud of studPositions) {
    ctx.strokeRect(...stud, DIMS.S, DIMS.S);
  }
}

function studFillEventHandler(canvas, context, ctx) {
  return event => {
    fillStud(mousePosition(canvas, event), context.selectedColor, ctx)
  };
}

function areaControlMouseDownEventHandler (canvas, context) {
  return event => {
    context.pos1 = context.pos2 = mousePosition(canvas, event)
  }
}

function areaControlMouseMoveEventHandler (canvas, context, ctx) {
  return event => {
    if (context.pos1 !== undefined && context.pos2 !== undefined) {
      highlightArea(context.pos1, context.pos2, context.clearColor, ctx)
      context.pos2 = mousePosition(canvas, event)
      highlightArea(context.pos1, context.pos2, context.selectedColor, ctx)
    }
  }
}

function areaControlMouseUpEventHandler (context, ctx) {
  return () => {
    if (context.pos1 !== undefined && context.pos2 !== undefined) {
      highlightArea(context.pos1, context.pos2, context.clearColor, ctx);
      fillArea(context.pos1, context.pos2, context.selectedColor, ctx)
      context.pos1 = context.pos2 = undefined
    }
  }
}

function radioValue (name) {
  return [
    .../** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll(`input[name=${name}]`)
    ),
  ].find((e) => e.checked).value
}

window.onload = function () {
  const canvas = /** @type {HTMLCanvasElement} */ (
    document.getElementById("canvas")
  );

  const colorSelect = /** @type {HTMLFormElement} */ (
    document.getElementById("color-select-form")
  )

  const controlSelect = /** @type {HTMLFormElement} */ (
    document.getElementById("control-select-form")
  )

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d", { alpha: false });

  ctx.lineWidth = 2;
  ctx.strokeStyle = rgb(COLORS[0]);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // drawStudGrid(ctx);

  const context = {
    selectedControl: 'stud',
    selectedColor: COLORS[radioValue('color-select')],
    clearColor: COLORS[0],
  }

  colorSelect.onchange = () => {
    context.selectedColor = COLORS[radioValue('color-select')];
  }

  const handleStudControlClick = studFillEventHandler(canvas, context, ctx)

  const handleAreaControlMouseDown = areaControlMouseDownEventHandler(canvas, context)
  const handleAreaControlMouseMove = areaControlMouseMoveEventHandler(canvas, context, ctx)
  const handleAreaControlMouseUp = areaControlMouseUpEventHandler(context, ctx)

  controlSelect.onchange = () => {
    switch (context.selectedControl) {
      case 'stud':
        canvas.removeEventListener('click', handleStudControlClick)
        break
      case 'area':
        canvas.removeEventListener('mousedown', handleAreaControlMouseDown)
        canvas.removeEventListener('mousemove', handleAreaControlMouseMove)
        canvas.removeEventListener('mouseup', handleAreaControlMouseUp)
        break
      case 'paint':
        break
    }
    context.selectedControl = [
      .../** @type {NodeListOf<HTMLInputElement>} */ (
        document.querySelectorAll("input[name=control-select]")
      ),
    ].find((e) => e.checked).value;

    switch (context.selectedControl) {
      case 'stud':
        canvas.addEventListener('click', handleStudControlClick)
        break
      case 'area':
        canvas.addEventListener('mousedown', handleAreaControlMouseDown)
        canvas.addEventListener('mousemove', handleAreaControlMouseMove)
        canvas.addEventListener('mouseup', handleAreaControlMouseUp)
        break
      case 'paint':
        break
    }
  };

  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  console.log(tooltipTriggerList)
  console.log(bootstrap)
  const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
};
