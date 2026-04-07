/**
 * Shard Circuit: 5 mission stages + boss (6 total). Lab, training sim, portal to planet, Cinder.
 * # wall  . empty  m mud  ^ spike  G gate  ~ ice  > boost
 * S chip  E exit  P spawn  * pulse  T/U teleporter  C scrap  H Z powerups  R sidearm
 */
(function () {
  "use strict";

  const COLS = 20;
  const ROWS = 11;

  const RAW_LEVELS = [
    {
      id: 1,
      name: "ARC Lab Deck",
      sector: 1,
      objective: { kind: "collect_exit" },
      enemies: [{ type: "patrol", tx: 10, ty: 8, axis: "h", speed: 20 }],
      lines: [
        "####################",
        "#..................#",
        "#..S............S..#",
        "#..................#",
        "#.......P..........#",
        "#..................#",
        "#..................#",
        "#..S............S..#",
        "#..............E...#",
        "#..................#",
        "####################",
      ],
    },
    {
      id: 2,
      name: "Training Sim",
      sector: 1,
      objective: { kind: "collect_exit" },
      enemies: [{ type: "patrol", tx: 9, ty: 5, axis: "v", speed: 24 }],
      lines: [
        "####################",
        "#..................#",
        "#..^^..........^^..#",
        "#..S............S..#",
        "#.......P..........#",
        "#.......S..........#",
        "#..S............S..#",
        "#..^^..........^^..#",
        "#..............E...#",
        "#..................#",
        "####################",
      ],
    },
    {
      id: 3,
      name: "Dust Step",
      sector: 2,
      objective: { kind: "collect_exit" },
      enemies: [
        { type: "patrol", tx: 4, ty: 9, axis: "h", speed: 22 },
        { type: "pursuer", tx: 15, ty: 8, speed: 20 },
      ],
      lines: [
        "####################",
        "#S..............S..#",
        "#P..............S..#",
        "#..^^^^....^^^^....#",
        "#..................#",
        "#..^^^^..##..^^^^..#",
        "#........##........#",
        "#...T....##....U...#",
        "#...S....##....S.E.#",
        "#..................#",
        "####################",
      ],
    },
    {
      id: 4,
      name: "Rift Trench",
      sector: 3,
      objective: { kind: "collect_exit" },
      enemies: [
        { type: "patrol", tx: 2, ty: 4, axis: "h", speed: 32 },
        { type: "patrol", tx: 16, ty: 6, axis: "h", speed: 32 },
      ],
      lines: [
        "####################",
        "#S..............S..#",
        "#G*G*G............#",
        "#P^...^............#",
        "#G*G*G............#",
        "#^...^.......S.....#",
        "#G.G.G............#",
        "#^...^............#",
        "#G*G*G............#",
        "#S......>....R..C.E#",
        "####################",
      ],
    },
    {
      id: 5,
      name: "Citadel Approach",
      sector: 4,
      objective: { kind: "collect_exit" },
      enemies: [
        { type: "titan", tx: 9, ty: 5, speed: 15 },
        { type: "sentry", tx: 1, ty: 8, period: 1.4 },
        { type: "sentry", tx: 17, ty: 8, period: 1.4 },
      ],
      lines: [
        "####################",
        "#S.*.....R.....*.S.#",
        "#..G............G..#",
        "#S......mm......S..#",
        "#..G............G..#",
        "#P*...............*#",
        "#..G....^^^^....G..#",
        "#S......mm......S..#",
        "#..G............G..#",
        "#S.*...........*.E.#",
        "####################",
      ],
    },
    {
      id: 6,
      name: "Cinder Core",
      sector: 4,
      objective: { kind: "boss_exit", damagePerShard: 11 },
      enemies: [{ type: "boss", tx: 10, ty: 4, hp: 99, speed: 13 }],
      lines: [
        "####################",
        "#..................#",
        "#.........E........#",
        "#..................#",
        "#..##........##....#",
        "#..##........##....#",
        "#..................#",
        "#S.S.S.S.S.S.S.S.S.#",
        "#..S.....S.....S...#",
        "#P.................#",
        "####################",
      ],
    },
  ];

  function buildLevel(def) {
    const tiles = [];
    const shardSpawns = [];
    const scrapSpawns = [];
    const powerSpawns = [];
    const pulses = [];
    const teleT = [];
    const teleU = [];
    let exit = { tx: 18, ty: 8 };
    let spawn = { tx: 2, ty: 5 };

    for (let r = 0; r < ROWS; r++) {
      const row = def.lines[r] || ".".repeat(COLS);
      tiles[r] = [];
      for (let c = 0; c < COLS; c++) {
        const ch = row[c] || ".";
        if (ch === "#") tiles[r][c] = 1;
        else if (ch === "m") tiles[r][c] = 2;
        else if (ch === "^") tiles[r][c] = 3;
        else if (ch === "G") tiles[r][c] = 4;
        else if (ch === "~") tiles[r][c] = 5;
        else if (ch === ">") tiles[r][c] = 6;
        else if (ch === "S") {
          tiles[r][c] = 0;
          shardSpawns.push({ tx: c, ty: r });
        } else if (ch === "C") {
          tiles[r][c] = 0;
          scrapSpawns.push({ tx: c, ty: r });
        } else if (ch === "H") {
          tiles[r][c] = 0;
          powerSpawns.push({ tx: c, ty: r, kind: "life" });
        } else if (ch === "Z") {
          tiles[r][c] = 0;
          powerSpawns.push({ tx: c, ty: r, kind: "haste" });
        } else if (ch === "R") {
          tiles[r][c] = 0;
          powerSpawns.push({ tx: c, ty: r, kind: "raygun" });
        } else if (ch === "F") {
          tiles[r][c] = 0;
          powerSpawns.push({ tx: c, ty: r, kind: "haste" });
        } else if (ch === "E") {
          tiles[r][c] = 0;
          exit = { tx: c, ty: r };
        } else if (ch === "P") {
          tiles[r][c] = 0;
          spawn = { tx: c, ty: r };
        } else if (ch === "*") {
          tiles[r][c] = 0;
          pulses.push({ tx: c, ty: r });
        } else if (ch === "T") {
          tiles[r][c] = 0;
          teleT.push({ tx: c, ty: r });
        } else if (ch === "U") {
          tiles[r][c] = 0;
          teleU.push({ tx: c, ty: r });
        } else tiles[r][c] = 0;
      }
    }

    const teleporterPairs = [];
    const nTele = Math.min(teleT.length, teleU.length);
    for (let i = 0; i < nTele; i++) teleporterPairs.push({ a: teleT[i], b: teleU[i] });

    const shardTotal = shardSpawns.length;
    const minShards =
      def.objective.kind === "subset_exit" ? def.objective.min : def.objective.kind === "collect_exit" ? shardTotal : 0;

    return {
      id: def.id,
      name: def.name,
      sector: def.sector,
      objective: def.objective,
      enemies: def.enemies || [],
      tiles,
      shardSpawns,
      scrapSpawns,
      powerSpawns,
      pulses,
      teleporterPairs,
      exit,
      spawn,
      shardTotal,
      scrapTotal: scrapSpawns.length,
      minShards,
      isBoss: def.objective.kind === "boss_exit",
    };
  }

  const LEVELS = RAW_LEVELS.map(buildLevel);

  window.GRPLevels = {
    COLS,
    ROWS,
    LEVELS,
    getLevel(index) {
      return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
    },
    count: LEVELS.length,
  };
})();
