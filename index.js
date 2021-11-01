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

const panelPositions = {
  /**
   * @returns {Generator<Pos, void, unknown>}
   */
  *[Symbol.iterator]() {
    for (let y = 0; y < DIMS.H; y+=16) {
      for (let x = 0; x < DIMS.W; x+=16) {
        yield [x * DIMS.S, y * DIMS.S];
      }
    }
  }
}

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
 * Draw a circle at the given `pos` with the given `color` translated to rgb
 * @param {Pos} pos
 * @param {Color} color
 * @param {CanvasRenderingContext2D} ctx
 */
function fillStud([x, y], color, ctx) {
  ctx.fillStyle = ctx.strokeStyle = rgb(color);
  ctx.beginPath();
  ctx.arc(
    x * DIMS.S + DIMS.S / 2,
    y * DIMS.S + DIMS.S / 2,
    (DIMS.S - 2) / 2,
    0,
    2 * Math.PI
  );
  ctx.fill();
  ctx.stroke();
}

/**
 * Given two positions, this returns the start and end x and y positions.
 * @param {Pos} pos1
 * @param {Pos} pos2
 * @returns {[[startX: number, endX: number], [startY: number, endY: number]]}
 */
function startEndPos([x1, y1], [x2, y2]) {
  return [x1 < x2 ? [x1, x2] : [x2, x1], y1 < y2 ? [y1, y2] : [y2, y1]];
}

/**
 * 
 * @param {Pos} pos1 
 * @param {Pos} pos2 
 * @param {Color} color 
 * @param {CanvasRenderingContext2D} ctx 
 */
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

/**
 * 
 * @param {Pos} pos1 
 * @param {Pos} pos2 
 * @param {Color} color 
 * @param {CanvasRenderingContext2D} ctx 
 */
function fillArea(pos1, pos2, color, ctx) {
  const [[sx, ex], [sy, ey]] = startEndPos(pos1, pos2);
  for (let x = sx; x < ex; x++) {
    for (let y = sy; y < ey; y++) {
      fillStud([x, y], color, ctx);
    }
  }
}

/**
 * 
 * @param {CanvasRenderingContext2D} ctx 
 */
function drawStudGrid(ctx) {
  ctx.strokeStyle = rgb(COLORS[1]);
  for (const stud of studPositions) {
    ctx.strokeRect(...stud, DIMS.S, DIMS.S);
  }
}

/**
 * @template {keyof HTMLElementEventMap} K
 * @typedef {(event: HTMLElementEventMap[K]) => void} ControlHandler
 */

/**
 * @template {keyof HTMLElementEventMap} K
 * @typedef {[K, ControlHandler<K>]} ControlHandlerTuple
 */

/** 
 * @typedef {(ControlHandlerTuple<'click'>)[]} StudControlHandlers
 * @typedef {(ControlHandlerTuple<'mousedown'> | ControlHandlerTuple<'mouseup'> | ControlHandlerTuple<'mousemove'>)[]} AreaControlHandlers
 * @typedef {[]} PaintControlHandlers
 * 
 * @typedef {Object} Controls
 * @property {{ handlers: StudControlHandlers }} stud
 * @property {{ handlers: AreaControlHandlers, pos1?: Pos, pos2?: Pos }} area
 * @property {{ handlers: PaintControlHandlers }} paint
 *
 * @typedef {Object} Context
 * @property {string} selectedControl
 * @property {Color} selectedColor
 * @property {Color} clearColor
 * @property {Controls} controls
 * @property {{ studs: boolean, panels: boolean }} borders
 */

/**
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {Context} context 
 * @param {CanvasRenderingContext2D} ctx 
 * @returns {ControlHandler<'click'>}
 */
function studFillEventHandler(canvas, context, ctx) {
  return event => {
    fillStud(mousePosition(canvas, event), context.selectedColor, ctx)
    drawBorders(context, ctx)
  };
}

/**
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {Context} context 
 * @returns {ControlHandler<'mousedown'>}
 */
function areaControlMouseDownEventHandler (canvas, context) {
  return event => {
    context.controls.area.pos1 = context.controls.area.pos2 = mousePosition(canvas, event)
  }
}

/**
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {Context} context 
 * @param {CanvasRenderingContext2D} ctx 
 * @returns {ControlHandler<'mousemove'>}
 */
function areaControlMouseMoveEventHandler (canvas, context, ctx) {
  return event => {
    if (context.controls.area.pos1 !== undefined && context.controls.area.pos2 !== undefined) {
      highlightArea(context.controls.area.pos1, context.controls.area.pos2, context.clearColor, ctx)
      drawBorders(context, ctx)
      context.controls.area.pos2 = mousePosition(canvas, event)
      highlightArea(context.controls.area.pos1, context.controls.area.pos2, context.selectedColor, ctx)
    }
  }
}

/**
 * 
 * @param {Context} context 
 * @param {CanvasRenderingContext2D} ctx 
 * @returns {ControlHandler<'mouseup'>}
 */
function areaControlMouseUpEventHandler (context, ctx) {
  return () => {
    if (context.controls.area.pos1 !== undefined && context.controls.area.pos2 !== undefined) {
      highlightArea(context.controls.area.pos1, context.controls.area.pos2, context.clearColor, ctx);
      fillArea(context.controls.area.pos1, context.controls.area.pos2, context.selectedColor, ctx)
      drawBorders(context, ctx)
      context.controls.area.pos1 = context.controls.area.pos2 = undefined
    }
  }
}

/**
 * 
 * @param {string} name 
 * @returns 
 */
function radioValue (name) {
  return [
    .../** @type {NodeListOf<HTMLInputElement>} */ (
      document.querySelectorAll(`input[name=${name}]`)
    ),
  ].find((e) => e.checked).value
}

function checkboxValue (name) {
  return /** @type {HTMLInputElement} */ (document.querySelector(`input[name=${name}]`)).checked
}

/**
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {Context} context 
 * @param {boolean} enable 
 */
function enableControl (canvas, context, enable) {
  for (const [event, handler] of context.controls[context.selectedControl].handlers) {
    if (enable) {
      canvas.addEventListener(event, handler)
    } else {
      canvas.removeEventListener(event, handler)
    }
  }
}

function drawStudBorders (ctx) {
  for (const stud of studPositions) {
    ctx.strokeRect(...stud, DIMS.S, DIMS.S);
  }
}

function drawPanelBorders (ctx) {
  for (const panel of panelPositions) {
    ctx.strokeRect(...panel, 16 * DIMS.S, 16 * DIMS.S);
  }
}

/**
 * 
 * @param {Context} context 
 * @param {CanvasRenderingContext2D} ctx 
 */
function drawBorders (context, ctx) {
  if (context.borders.studs && context.borders.panels) {
    ctx.strokeStyle = rgb(COLORS[1])
    drawStudBorders(ctx)
    drawPanelBorders(ctx)
  } else if (context.borders.studs && !context.borders.panels) {
    ctx.strokeStyle = rgb(COLORS[0])
    drawPanelBorders(ctx)
    ctx.strokeStyle = rgb(COLORS[1])
    drawStudBorders(ctx)
  } else if (!context.borders.studs && context.borders.panels) {
    ctx.strokeStyle = rgb(COLORS[0])
    drawStudBorders(ctx)
    ctx.strokeStyle = rgb(COLORS[1])
    drawPanelBorders(ctx)
  } else {
    ctx.strokeStyle = rgb(COLORS[0])
    drawStudBorders(ctx)
    drawPanelBorders(ctx)
  }
}

function enableBootstrapTooltips () {
  const tooltipTriggerList = [...document.querySelectorAll('[data-bs-toggle="tooltip"]')]
  const tooltips = tooltipTriggerList.map(tooltipTriggerEl => {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
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

  const borderToggle = /** @type {HTMLFormElement} */ (
    document.getElementById('border-toggle-form')
  )

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext("2d", { alpha: false });

  ctx.lineWidth = 2;
  ctx.strokeStyle = rgb(COLORS[0]);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // drawStudGrid(ctx);

  /**
   * @type {Context}
   */
  const context = {
    selectedControl: 'stud',
    selectedColor: COLORS[radioValue('color-select')],
    clearColor: COLORS[0],
    controls: {
      stud: { handlers: [] },
      area: { handlers: [] },
      paint: { handlers: [] },
    },
    borders: {
      studs: false,
      panels: false
    }
  }

  colorSelect.onchange = () => {
    context.selectedColor = COLORS[radioValue('color-select')];
  }

  const handleStudControlClick = studFillEventHandler(canvas, context, ctx)

  context.controls.stud.handlers = [['click', handleStudControlClick]]

  const handleAreaControlMouseDown = areaControlMouseDownEventHandler(canvas, context)
  const handleAreaControlMouseMove = areaControlMouseMoveEventHandler(canvas, context, ctx)
  const handleAreaControlMouseUp = areaControlMouseUpEventHandler(context, ctx)

  context.controls.area.handlers = [
    ['mousedown', handleAreaControlMouseDown],
    ['mousemove', handleAreaControlMouseMove],
    ['mouseup', handleAreaControlMouseUp],
  ]

  enableControl(canvas, context, true)

  controlSelect.onchange = () => {
    enableControl(canvas, context, false)
    context.selectedControl = radioValue('control-select');
    enableControl(canvas, context, true)
  };

  borderToggle.onchange = () => {
    context.borders = {
      studs: checkboxValue('stud-border-toggle'),
      panels: checkboxValue('panel-border-toggle'),
    }
    drawBorders(context, ctx)
  }

  enableBootstrapTooltips()
};
