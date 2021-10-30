const { createMachine, send, spawn, assign, interpret } = XState;

const canvas = document.getElementById("canvas");

const STUD = {
  SIZE: 15,
};

const PANEL = {
  WIDTH: 16,
  HEIGHT: 16,
};

const BOARD = {
  WIDTH: 8,
  HEIGHT: 5,
};

const PANEL_WIDTH = PANEL.WIDTH * STUD.SIZE;
const PANEL_HEIGHT = PANEL.HEIGHT * STUD.SIZE;

const BOARD_WIDTH = BOARD.WIDTH * PANEL_WIDTH;
const BOARD_HEIGHT = BOARD.HEIGHT * PANEL_HEIGHT;

canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

const ctx = canvas.getContext("2d");

ctx.lineWidth = 2;
ctx.strokeStyle = "black";
ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

const studs = [];
const panels = [];

for (let x = 0; x < BOARD.WIDTH * PANEL.WIDTH; x++) {
  for (let y = 0; y < BOARD.HEIGHT * PANEL.HEIGHT; y++) {
    studs.push([x * STUD.SIZE, y * STUD.SIZE, STUD.SIZE, STUD.SIZE]);

    if (x % PANEL.WIDTH === 0 && y % PANEL.HEIGHT === 0) {
      panels.push([
        (x / PANEL.WIDTH) * PANEL_WIDTH,
        (y / PANEL.HEIGHT) * PANEL_HEIGHT,
        PANEL_WIDTH,
        PANEL_HEIGHT,
      ]);
    }
  }
}

function getSelectedColor() {
  return [...document.querySelectorAll("input[type=radio]")].find(
    (e) => e.checked
  ).value;
}

function drawStud(x, y, color = getSelectedColor()) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(
    x * STUD.SIZE + STUD.SIZE / 2,
    y * STUD.SIZE + STUD.SIZE / 2,
    (STUD.SIZE - 2) / 2,
    0,
    2 * Math.PI
  );
  ctx.fill();
}

canvas.onclick = function ({ clientX, clientY }) {
  const { left, top } = canvas.getBoundingClientRect();

  const x = Math.round((clientX - left) / STUD.SIZE);
  const y = Math.round((clientY - top) / STUD.SIZE);

  drawStud(x - 1, y - 1);
};

function drawItems(items) {
  for (const item of items) {
    ctx.strokeRect(...item);
  }
}

const boardMachine = createMachine(
  {
    initial: "both_hidden",
    states: {
      both_hidden: {
        entry: ["hidePanels", "hideStuds"],
        on: {
          SHOW_PANELS: {
            target: "panels_visible",
          },
          SHOW_STUDS: {
            target: "studs_visible",
          },
        },
      },
      panels_visible: {
        entry: ["hideStuds", "showPanels"],
        on: {
          HIDE_PANELS: {
            target: "both_hidden",
          },
          SHOW_STUDS: {
            target: "both_visible",
          },
        },
      },
      studs_visible: {
        entry: ["hidePanels", "showStuds"],
        on: {
          HIDE_STUDS: {
            target: "both_hidden",
          },
          SHOW_PANELS: {
            target: "both_visible",
          },
        },
      },
      both_visible: {
        entry: ["showStuds", "showPanels"],
        on: {
          HIDE_STUDS: {
            target: "panels_visible",
          },
          HIDE_PANELS: {
            target: "studs_visible",
          },
        },
      },
    },
  },
  {
    actions: {
      hidePanels: () => {
        ctx.strokeStyle = "black";
        drawItems(panels);
      },
      hideStuds: () => {
        ctx.strokeStyle = "black";
        drawItems(studs);
      },
      showPanels: () => {
        ctx.strokeStyle = "white";
        drawItems(panels);
      },
      showStuds: () => {
        ctx.strokeStyle = "white";
        drawItems(studs);
      },
    },
  }
);

const boardService = interpret(boardMachine);

boardService.start();

document.getElementById("togglePanels").onclick = function togglePanels() {
  switch (boardService.state.value) {
    case "both_hidden":
    case "studs_visible":
      boardService.send("SHOW_PANELS");
      break;
    case "panels_visible":
    case "both_visible":
      boardService.send("HIDE_PANELS");
      break;
  }
};

document.getElementById("toggleStuds").onclick = function toggleStuds() {
  switch (boardService.state.value) {
    case "both_hidden":
    case "panels_visible":
      boardService.send("SHOW_STUDS");
      break;
    case "both_visible":
    case "studs_visible":
      boardService.send("HIDE_STUDS");
      break;
  }
};

document.getElementById("save").onclick = function save() {
  const data = []
  for (let c = 0; c < BOARD.WIDTH; c++) {
    data.push([])
    for (let r = 0; r < BOARD.HEIGHT; r++) {
      data[c].push([])
      for (let pr = 0; pr < PANEL.HEIGHT; pr++) {
        data[c][r].push([])
        for (let pc = 0; pc < PANEL.WIDTH; pc++) {
          const {
            data: [red, green, blue, alpha],
          } = ctx.getImageData(
            (pc + c * PANEL.WIDTH) * STUD.SIZE + STUD.SIZE / 2,
            (pr + r * PANEL.HEIGHT) * STUD.SIZE + STUD.SIZE / 2,
            1,
            1,
          );
          // console.log(`rgba(${red}, ${green}, ${blue}, ${alpha / 255})`)
          if (red === 255 && green === 255 && blue === 255) {
            data[c][r][pr].push(1)
          } else if (red === 18 && green === 52 && blue === 93) {
            data[c][r][pr].push(2)
          } else {
            data[c][r][pr].push(0)
          }
        }
      }
    }
  }
  const b = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
  const u = URL.createObjectURL(b)
  const e = document.createElement('a')
  e.href = u
  e.download = 'map.json'
  e.style.display = 'none'
  document.body.appendChild(e)
  e.click()
  document.body.removeChild(e)
};

fetch("map.json")
  .then((resp) => resp.json())
  .then((data) => {
    for (let panelSetI = 0; panelSetI < data.length; panelSetI++) {
      const panelSet = data[panelSetI];
      for (let panelI = 0; panelI < panelSet.length; panelI++) {
        const panel = panelSet[panelI];
        for (let rowI = 0; rowI < panel.length; rowI++) {
          const row = panel[rowI];
          for (let colI = 0; colI < row.length; colI++) {
            const stud = row[colI];
            switch (stud) {
              case 1:
                drawStud(
                  colI + panelSetI * PANEL.WIDTH,
                  rowI + panelI * PANEL.HEIGHT,
                  "white"
                );
                break;
              case 2:
                drawStud(
                  colI + panelSetI * PANEL.WIDTH,
                  rowI + panelI * PANEL.HEIGHT,
                  "rgb(18, 52, 93)"
                );
                break;
            }
          }
        }
      }
    }
  });
